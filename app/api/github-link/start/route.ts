import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { env } from "@/src/env";
import { buildAuthorizeUrl } from "@/src/server/github-link-service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/signin", env.NEXTAUTH_URL));
  }
  return NextResponse.redirect(buildAuthorizeUrl(session.user.id));
}
