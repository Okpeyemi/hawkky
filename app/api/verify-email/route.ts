import { NextResponse } from "next/server";
import { consumeVerifyToken } from "@/src/server/auth-actions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/verify?status=missing", url));
  }
  const result = await consumeVerifyToken(token);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/verify?status=error&msg=${encodeURIComponent(result.error)}`, url),
    );
  }
  return NextResponse.redirect(new URL("/verify?status=ok", url));
}
