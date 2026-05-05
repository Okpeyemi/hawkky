import { env } from "@/src/env";

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

const RESEND_API_BASE = "https://api.resend.com/emails";

/**
 * Sends a transactional email via Resend HTTP API.
 * Throws on non-2xx responses (caller's responsibility to retry / log).
 */
export async function sendTransactional(input: SendInput): Promise<{ messageId: string }> {
  const from = `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;

  const res = await fetch(RESEND_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable>");
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as { id?: string };
  return { messageId: json.id ?? "unknown" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
