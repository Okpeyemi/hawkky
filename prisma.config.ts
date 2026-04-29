import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (Next.js convention), then fall back to .env
loadDotenv({ path: ".env.local", override: false });
loadDotenv({ path: ".env", override: false });

const migrationUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];
if (!migrationUrl) {
  throw new Error(
    "prisma.config.ts: DIRECT_URL or DATABASE_URL must be set in .env.local or the environment",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
