import { NextResponse } from "next/server";
import { runIngestSource } from "@/src/inngest/functions/ingest-source";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("forbidden", { status: 403 });
  const { sourceId } = (await req.json()) as { sourceId: string };
  const out = await runIngestSource(sourceId);
  return NextResponse.json(out);
}
