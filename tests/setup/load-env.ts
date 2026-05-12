import { config as loadDotenv } from "dotenv";

// Load .env.local first (Next.js convention), then fall back to .env
loadDotenv({ path: ".env.local", override: false });
loadDotenv({ path: ".env", override: false });
