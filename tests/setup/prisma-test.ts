import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../../generated/prisma";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const TEST_URL = process.env.TEST_DATABASE_URL;

export const isTestDbConfigured =
  !!TEST_URL && TEST_URL.length > 0 && TEST_URL !== process.env.DATABASE_URL;

let _testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!isTestDbConfigured) {
    throw new Error(
      "TEST_DATABASE_URL is not set or matches DATABASE_URL — refusing to run DB tests against the dev/prod DB. Provision a dedicated Neon test branch and set TEST_DATABASE_URL in .env.local.",
    );
  }
  if (!_testPrisma) {
    const adapter = new PrismaNeon({ connectionString: TEST_URL });
    _testPrisma = new PrismaClient({ adapter });
  }
  return _testPrisma;
}

export async function resetDb(): Promise<void> {
  const p = getTestPrisma();
  await p.session.deleteMany();
  await p.account.deleteMany();
  await p.verificationToken.deleteMany();
  await p.profile.deleteMany();
  await p.user.deleteMany();
}
