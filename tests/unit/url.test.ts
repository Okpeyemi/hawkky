import { describe, expect, it } from "vitest";
import { canonicalizeUrl, urlHash } from "@/src/domain/sources/url";

describe("canonicalizeUrl", () => {
  it("lowercases host and scheme, strips trailing slash and fragment", () => {
    expect(canonicalizeUrl("HTTPS://Example.COM/Path/#frag")).toBe("https://example.com/Path");
  });

  it("strips utm_ and tracking params", () => {
    const out = canonicalizeUrl(
      "https://example.com/a?utm_source=hn&utm_medium=x&id=42&gclid=abc&fbclid=xyz",
    );
    expect(out).toBe("https://example.com/a?id=42");
  });

  it("keeps non-tracking query params and sorts them", () => {
    expect(canonicalizeUrl("https://example.com/a?b=2&a=1")).toBe("https://example.com/a?a=1&b=2");
  });

  it("normalizes default port", () => {
    expect(canonicalizeUrl("https://example.com:443/x")).toBe("https://example.com/x");
    expect(canonicalizeUrl("http://example.com:80/x")).toBe("http://example.com/x");
  });

  it("throws on invalid URL", () => {
    expect(() => canonicalizeUrl("not a url")).toThrow();
  });
});

describe("urlHash", () => {
  it("is stable for the same input", () => {
    expect(urlHash("https://example.com/a")).toBe(urlHash("https://example.com/a"));
  });

  it("differs for different inputs", () => {
    expect(urlHash("https://example.com/a")).not.toBe(urlHash("https://example.com/b"));
  });

  it("returns 64 hex chars (sha256)", () => {
    expect(urlHash("https://example.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});
