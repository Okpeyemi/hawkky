import { NextResponse } from "next/server";
import { exchangeCodeAndScan, verifyState } from "@/src/server/github-link-service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const onboarding = new URL("/onboarding?step=3", url.origin);

  if (!code || !state) {
    onboarding.searchParams.set("gh_error", "missing_params");
    return NextResponse.redirect(onboarding);
  }

  let payload: { userId: string };
  try {
    payload = verifyState(state);
  } catch {
    onboarding.searchParams.set("gh_error", "bad_state");
    return NextResponse.redirect(onboarding);
  }

  try {
    const scan = await exchangeCodeAndScan(payload.userId, code);
    onboarding.searchParams.set("gh_langs", scan.topLanguages.join(","));
    return NextResponse.redirect(onboarding);
  } catch (e) {
    onboarding.searchParams.set("gh_error", e instanceof Error ? e.message : "unknown");
    return NextResponse.redirect(onboarding);
  }
}
