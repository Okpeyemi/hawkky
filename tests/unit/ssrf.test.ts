import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns", () => ({
  promises: {
    lookup: vi.fn(async (host: string) => {
      if (host === "cloudflare.com") return [{ address: "1.1.1.1", family: 4 }];
      throw new Error("ENOTFOUND");
    }),
  },
}));

import { assertSafeUrl, isPrivateIp } from "@/src/infra/ssrf";

describe("isPrivateIp", () => {
  it("flags loopback v4", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.255.255.255")).toBe(true);
  });

  it("flags RFC1918 ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("flags link-local and cloud metadata", () => {
    expect(isPrivateIp("169.254.169.254")).toBe(true);
  });

  it("flags loopback v6 and unique-local v6", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
  });

  it("does not flag public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow(/scheme/i);
    await expect(assertSafeUrl("gopher://example.com/")).rejects.toThrow(/scheme/i);
  });

  it("rejects localhost host literal", async () => {
    await expect(assertSafeUrl("http://localhost/x")).rejects.toThrow();
    await expect(assertSafeUrl("http://127.0.0.1/x")).rejects.toThrow();
  });

  it("accepts a clearly public host", async () => {
    await expect(assertSafeUrl("https://cloudflare.com/")).resolves.toBeUndefined();
  });
});
