import { NextResponse } from "next/server";
import { prisma } from "@/src/infra/prisma";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" || !process.env.E2E_TEST_SECRET) {
    return new NextResponse("Not found", { status: 404 });
  }
  const auth = req.headers.get("x-test-secret");
  if (auth !== process.env.E2E_TEST_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { email } = (await req.json()) as { email: string };
  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });
  return NextResponse.json({ ok: true });
}
