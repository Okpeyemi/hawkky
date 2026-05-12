import { NextResponse } from "next/server";

const FIXTURE = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item><title>Hello E2E</title><link>https://example.com/e2e-1</link><pubDate>Mon, 12 May 2026 09:00:00 GMT</pubDate></item>
</channel></rss>`;

export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(FIXTURE, { headers: { "Content-Type": "application/rss+xml" } });
}
