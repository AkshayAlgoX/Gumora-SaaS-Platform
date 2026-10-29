import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Outbound HTTP(S) GET for user-influenced URLs (product image import).
 *
 * Guards against server-side request forgery:
 * - only http: and https: URLs, on any port;
 * - every address a hostname resolves to is checked against a block list of
 *   loopback, private, link-local, CGNAT, multicast and reserved ranges. The
 *   check runs inside the socket's DNS lookup, so the address that is
 *   checked is the address that is connected to (no DNS-rebinding gap);
 * - literal IP hosts are checked before connecting;
 * - redirects are followed (at most `maxRedirects`), each hop re-validated;
 * - the body is streamed and aborted once it exceeds `maxBytes`;
 * - one overall deadline covers all hops.
 */

export class BlockedUrlError extends Error {
  constructor(reason: string) {
    super(`Blocked outbound request: ${reason}`);
    this.name = "BlockedUrlError";
  }
}

function defaultBlockList(): net.BlockList {
  const list = new net.BlockList();
  const v4: Array<[string, number]> = [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
    ["224.0.0.0", 4], ["240.0.0.0", 4],
  ];
  for (const [addr, prefix] of v4) list.addSubnet(addr, prefix, "ipv4");
  const v6: Array<[string, number]> = [
    // No ::ffff:0:0/96 entry: BlockList matches IPv4 rules against
    // IPv4-mapped IPv6 addresses itself, and that prefix would also match
    // every plain IPv4 address.
    ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64],
    ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
  ];
  for (const [addr, prefix] of v6) list.addSubnet(addr, prefix, "ipv6");
  return list;
}

const DEFAULT_BLOCK_LIST = defaultBlockList();

export function isBlockedAddress(address: string, blockList: net.BlockList = DEFAULT_BLOCK_LIST): boolean {
  const family = net.isIP(address);
  if (family === 0) return true; // not an IP at all: refuse
  return blockList.check(address, family === 6 ? "ipv6" : "ipv4");
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  /** Test hook; production code uses the default block list. */
  isBlocked?: (address: string) => boolean;
}

export interface SafeFetchResult {
  buffer: Buffer;
  contentType: string | undefined;
  finalUrl: string;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

export async function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const { maxBytes, timeoutMs, maxRedirects = 3 } = options;
  const isBlocked = options.isBlocked ?? ((a: string) => isBlockedAddress(a));
  const deadline = Date.now() + timeoutMs;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const outcome = await requestOnce(current, { maxBytes, deadline, isBlocked });
    if (outcome.kind === "body") return { ...outcome.result, finalUrl: current };
    current = outcome.location;
  }
  throw new BlockedUrlError(`more than ${maxRedirects} redirects`);
}

type Outcome = { kind: "body"; result: Omit<SafeFetchResult, "finalUrl"> } | { kind: "redirect"; location: string };

function requestOnce(
  rawUrl: string,
  ctx: { maxBytes: number; deadline: number; isBlocked: (address: string) => boolean }
): Promise<Outcome> {
  return new Promise((resolveOuter, rejectOuter) => {
    let timer: NodeJS.Timeout | undefined;
    const resolve = (o: Outcome) => { clearTimeout(timer); resolveOuter(o); };
    const reject = (e: unknown) => { clearTimeout(timer); rejectOuter(e); };
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return reject(new BlockedUrlError("invalid URL"));
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return reject(new BlockedUrlError(`scheme ${url.protocol} not allowed`));
    }
    if (url.username || url.password) return reject(new BlockedUrlError("credentials in URL"));

    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && ctx.isBlocked(host)) return reject(new BlockedUrlError(`address ${host} is not public`));

    const remaining = ctx.deadline - Date.now();
    if (remaining <= 0) return reject(new Error("timeout"));

    const guardedLookup = (hostname: string, opts: dns.LookupOptions, cb: LookupCallback) => {
      dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
        if (err) return cb(err, "");
        const list = addresses as dns.LookupAddress[];
        const bad = list.find((a) => ctx.isBlocked(a.address));
        if (bad || list.length === 0) {
          return cb(new BlockedUrlError(`${hostname} resolves to a non-public address`), "");
        }
        if (opts.all) return cb(null, list);
        cb(null, list[0].address, list[0].family);
      });
    };

    const client = url.protocol === "https:" ? https : http;
    const req = client.get(url, { lookup: guardedLookup as unknown as typeof dns.lookup, timeout: remaining }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ kind: "redirect", location: new URL(res.headers.location, url).toString() });
      }
      if (status < 200 || status >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${status}`));
      }
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > ctx.maxBytes) {
        res.destroy();
        return reject(new Error("response too large"));
      }

      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > ctx.maxBytes) {
          res.destroy();
          reject(new Error("response too large"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ kind: "body", result: { buffer: Buffer.concat(chunks), contentType: res.headers["content-type"] } }));
      res.on("error", reject);
    });

    // Hard deadline for the whole hop; the socket `timeout` above only covers idle time.
    timer = setTimeout(() => req.destroy(new Error("timeout")), remaining);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
