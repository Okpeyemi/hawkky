import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/src/env";
import { encrypt } from "@/src/infra/crypto";
import { prisma } from "@/src/infra/prisma";

const STATE_TTL_MS = 10 * 60 * 1000;

interface StatePayload {
  userId: string;
  ts: number;
  nonce: string;
}

function signState(p: StatePayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  const mac = createHmac("sha256", env.FEEDBACK_SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyState(state: string): StatePayload {
  const [body, mac] = state.split(".");
  if (!body || !mac) throw new Error("bad state");
  const expected = createHmac("sha256", env.FEEDBACK_SECRET).update(body).digest("base64url");
  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) {
    throw new Error("bad signature");
  }
  const p = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as StatePayload;
  if (Date.now() - p.ts > STATE_TTL_MS) throw new Error("state expired");
  return p;
}

export function buildAuthorizeUrl(userId: string): string {
  if (!env.AUTH_GITHUB_ID) throw new Error("AUTH_GITHUB_ID missing");
  const state = signState({ userId, ts: Date.now(), nonce: randomBytes(8).toString("hex") });
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", env.AUTH_GITHUB_ID);
  u.searchParams.set("scope", "read:user public_repo");
  u.searchParams.set("state", state);
  u.searchParams.set(
    "redirect_uri",
    new URL("/api/github-link/callback", env.NEXTAUTH_URL).toString(),
  );
  return u.toString();
}

export async function exchangeCodeAndScan(userId: string, code: string) {
  if (!env.AUTH_GITHUB_ID || !env.AUTH_GITHUB_SECRET) {
    throw new Error("github oauth not configured");
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.AUTH_GITHUB_ID,
      client_secret: env.AUTH_GITHUB_SECRET,
      code,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) throw new Error(tokenJson.error ?? "no access_token");

  const headers = {
    Authorization: `Bearer ${tokenJson.access_token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Hawkky/0.2",
  };

  const me = (await (await fetch("https://api.github.com/user", { headers })).json()) as {
    login?: string;
  };

  const repos = (await (
    await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", { headers })
  ).json()) as Array<{
    language: string | null;
    full_name: string;
    fork: boolean;
    archived: boolean;
  }>;

  const langCount = new Map<string, number>();
  for (const r of repos) {
    if (r.fork || r.archived || !r.language) continue;
    langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1);
  }
  const topLanguages = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang);

  const encToken = encrypt(tokenJson.access_token);
  await prisma.profile.update({
    where: { userId },
    data: {
      githubLogin: me.login ?? null,
      githubAccessTokenEnc: encToken,
    },
  });

  return { topLanguages, repoCount: repos.length };
}
