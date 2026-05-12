import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequest = vi.hoisted(() => vi.fn());

vi.mock("undici", () => ({
  request: mockRequest,
}));

vi.mock("@/src/infra/ssrf", () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
}));

import { safeFetch } from "@/src/infra/fetcher";

describe("safeFetch", () => {
  beforeEach(() => mockRequest.mockReset());

  it("returns ok with body and caching headers on 200", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: { etag: '"abc"', "last-modified": "Wed, 21 Oct 2024 07:28:00 GMT" },
      body: { text: async () => "hello" },
    });
    const r = await safeFetch("https://example.com/feed", {});
    expect(r).toEqual({
      status: "ok",
      body: "hello",
      etag: '"abc"',
      lastModified: "Wed, 21 Oct 2024 07:28:00 GMT",
    });
  });

  it("returns not_modified on 304", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 304,
      headers: {},
      body: { text: async () => "" },
    });
    const r = await safeFetch("https://example.com/feed", { etag: '"abc"' });
    expect(r).toEqual({ status: "not_modified" });
  });

  it("sends If-None-Match and If-Modified-Since when present", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: { text: async () => "x" },
    });
    await safeFetch("https://example.com/feed", {
      etag: '"abc"',
      lastModified: "Wed, 21 Oct 2024 07:28:00 GMT",
    });
    const call = mockRequest.mock.calls[0];
    expect(call[1].headers["If-None-Match"]).toBe('"abc"');
    expect(call[1].headers["If-Modified-Since"]).toBe("Wed, 21 Oct 2024 07:28:00 GMT");
  });

  it("returns error on non-2xx/304", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 500,
      headers: {},
      body: { text: async () => "" },
    });
    const r = await safeFetch("https://example.com/feed", {});
    expect(r.status).toBe("error");
  });
});
