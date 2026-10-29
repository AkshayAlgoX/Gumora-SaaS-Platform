import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { BlockedUrlError, isBlockedAddress, safeFetch } from "../src/lib/safeFetch";

/**
 * safeFetch against a real local HTTP server. The server listens on all
 * interfaces; tests allow only 127.0.0.1 so that 127.0.0.2 (same machine,
 * different address) stands in for an internal host.
 */

let server: http.Server;
let port: number;
let png: Buffer;
const allowOnly127001 = (a: string) => a !== "127.0.0.1";

beforeAll(async () => {
  png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ff00ff" } }).png().toBuffer();
  server = http.createServer((req, res) => {
    if (req.url === "/image.png") {
      res.writeHead(200, { "content-type": "image/png" });
      return res.end(png);
    }
    if (req.url === "/redirect-internal") {
      res.writeHead(302, { location: `http://127.0.0.2:${port}/image.png` });
      return res.end();
    }
    if (req.url === "/redirect-ok") {
      res.writeHead(302, { location: "/image.png" });
      return res.end();
    }
    if (req.url === "/loop") {
      res.writeHead(302, { location: "/loop" });
      return res.end();
    }
    if (req.url === "/big-chunked") {
      res.writeHead(200, { "content-type": "application/octet-stream" });
      const chunk = Buffer.alloc(64 * 1024);
      let sent = 0;
      const pump = () => {
        while (sent < 2 * 1024 * 1024) {
          sent += chunk.length;
          if (!res.write(chunk)) return res.once("drain", pump);
        }
        res.end();
      };
      return pump();
    }
    if (req.url === "/slow") return setTimeout(() => res.end("late"), 3000);
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, "0.0.0.0", r));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});

describe("default block list", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1",
  ])("blocks %s", (addr) => {
    expect(isBlockedAddress(addr)).toBe(true);
  });

  it.each(["93.184.215.14", "1.1.1.1", "2606:4700:4700::1111"])("allows public %s", (addr) => {
    expect(isBlockedAddress(addr)).toBe(false);
  });

  it("refuses non-IP strings", () => {
    expect(isBlockedAddress("localhost")).toBe(true);
  });
});

describe("safeFetch with the default policy", () => {
  it.each([
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://10.0.0.5:8080/admin",
    "http://localhost/", // resolves to loopback
  ])("refuses %s before any data is read", async (url) => {
    await expect(safeFetch(url, { maxBytes: 1024, timeoutMs: 2000 })).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it.each(["file:///etc/passwd", "ftp://example.com/x", "gopher://example.com/", "not a url", "http://user:pass@example.com/"])(
    "refuses %s",
    async (url) => {
      await expect(safeFetch(url, { maxBytes: 1024, timeoutMs: 2000 })).rejects.toBeInstanceOf(BlockedUrlError);
    }
  );

  it("refuses the local test server too (it is loopback)", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/image.png`, { maxBytes: 1024, timeoutMs: 2000 })).rejects.toBeInstanceOf(BlockedUrlError);
  });
});

describe("safeFetch with a policy that allows only 127.0.0.1", () => {
  const opts = { maxBytes: 1024 * 1024, timeoutMs: 2000, isBlocked: allowOnly127001 };

  it("downloads an allowed image", async () => {
    const res = await safeFetch(`http://127.0.0.1:${port}/image.png`, opts);
    expect(res.buffer.equals(png)).toBe(true);
    expect(res.contentType).toBe("image/png");
  });

  it("follows a redirect to an allowed address", async () => {
    const res = await safeFetch(`http://127.0.0.1:${port}/redirect-ok`, opts);
    expect(res.buffer.equals(png)).toBe(true);
    expect(res.finalUrl).toBe(`http://127.0.0.1:${port}/image.png`);
  });

  it("re-validates redirects and refuses one to a blocked address", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/redirect-internal`, opts)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("stops after the redirect limit", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/loop`, opts)).rejects.toThrow(/redirects/);
  });

  it("aborts a chunked body once it exceeds maxBytes", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/big-chunked`, { ...opts, maxBytes: 256 * 1024 })).rejects.toThrow(/too large/);
  });

  it("enforces the overall deadline", async () => {
    const started = Date.now();
    await expect(safeFetch(`http://127.0.0.1:${port}/slow`, { ...opts, timeoutMs: 300 })).rejects.toThrow(/timeout/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("rejects non-2xx responses", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/missing`, opts)).rejects.toThrow(/HTTP 404/);
  });
});
