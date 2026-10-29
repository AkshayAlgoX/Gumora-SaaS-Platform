/**
 * Post-login destination from a `?next=` value. Only same-origin paths are
 * accepted ("/library", not "//evil.example" or "https://..."), so the
 * parameter cannot be used as an open redirect.
 */
export const DEFAULT_AFTER_LOGIN = "/dashboard/products";

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  return raw;
}

export function nextFromLocation(): string {
  if (typeof window === "undefined") return DEFAULT_AFTER_LOGIN;
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}
