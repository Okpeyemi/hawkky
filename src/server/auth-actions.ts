"use server";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hash } from "bcryptjs";
import { emailSchema, signupSchema } from "@/src/domain/profile/schemas";
import { env } from "@/src/env";
import { prisma } from "@/src/infra/prisma";
import { sendTransactional } from "@/src/infra/resend";

const VERIFY_TOKEN_TTL_MIN = 60 * 24;

function makeVerifyToken(email: string): string {
  const payload = `${email}|${Date.now()}|${randomBytes(16).toString("hex")}`;
  const hmac = createHmac("sha256", env.AUTH_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${hmac}`).toString("base64url");
}

function parseVerifyToken(token: string): { email: string; issuedAt: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [email, ts, nonce, hmac] = parts;
    const expected = createHmac("sha256", env.AUTH_SECRET)
      .update(`${email}|${ts}|${nonce}`)
      .digest("hex");
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { email, issuedAt: Number(ts) };
  } catch {
    return null;
  }
}

export async function signupAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Entrée invalide" };
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.emailVerified) {
    return { ok: false, error: "Un compte existe déjà avec cet email" };
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      passwordHash,
      profile: { create: {} },
    },
  });

  const token = makeVerifyToken(email);
  const verifyUrl = `${env.NEXTAUTH_URL}/api/verify-email?token=${token}`;

  await sendTransactional({
    to: email,
    subject: "Confirme ton email pour Hawkky",
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:22px;margin:0 0 16px;">Bienvenue sur Hawkky 👋</h1>
        <p style="color:#444;line-height:1.5;">
          Confirme ton email pour activer ton compte et recevoir ton premier briefing demain matin.
        </p>
        <p style="margin:24px 0;">
          <a href="${verifyUrl}"
             style="display:inline-block;padding:12px 20px;background:#111;color:#fff;
                    border-radius:8px;text-decoration:none;font-weight:500;">
            Confirmer mon email
          </a>
        </p>
        <p style="color:#888;font-size:13px;">
          Ou colle ce lien dans ton navigateur :<br/>
          <span style="word-break:break-all">${verifyUrl}</span>
        </p>
      </div>
    `,
  });

  return { ok: true };
}

export async function consumeVerifyToken(
  token: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const parsed = parseVerifyToken(token);
  if (!parsed) return { ok: false, error: "Lien invalide" };
  const ageMin = (Date.now() - parsed.issuedAt) / 1000 / 60;
  if (ageMin > VERIFY_TOKEN_TTL_MIN) return { ok: false, error: "Lien expiré" };

  const emailParse = emailSchema.safeParse(parsed.email);
  if (!emailParse.success) return { ok: false, error: "Email invalide" };
  const email = emailParse.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, error: "Compte introuvable" };
  if (user.emailVerified) return { ok: true, email };

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });
  return { ok: true, email };
}

export async function resendVerifyAction(emailRaw: unknown): Promise<{ ok: true }> {
  const email = emailSchema.parse(emailRaw);
  const user = await prisma.user.findUnique({ where: { email } });
  // Don't leak whether the account exists — silently no-op if already verified or unknown.
  if (!user || user.emailVerified) return { ok: true };
  const token = makeVerifyToken(email);
  const verifyUrl = `${env.NEXTAUTH_URL}/api/verify-email?token=${token}`;
  await sendTransactional({
    to: email,
    subject: "Nouveau lien de confirmation Hawkky",
    html: `<p>Voici un nouveau lien de confirmation : <a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
  return { ok: true };
}
