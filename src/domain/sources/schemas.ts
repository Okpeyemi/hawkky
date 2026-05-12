import { z } from "zod";

export const sourceKindSchema = z.enum([
  "rss",
  "hn_top",
  "reddit_subreddit",
  "github_trending_lang",
  "github_repo",
]);

export const addSubscriptionInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rss"), key: z.string().url() }),
  z.object({ kind: z.literal("hn_top"), key: z.literal("global") }),
  z.object({
    kind: z.literal("reddit_subreddit"),
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_]+$/, "invalid subreddit name"),
  }),
  z.object({
    kind: z.literal("github_trending_lang"),
    key: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9+-]+$/, "lowercase letters, digits, + or -"),
  }),
  z.object({
    kind: z.literal("github_repo"),
    key: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "expected owner/name"),
  }),
]);

export type AddSubscriptionInput = z.infer<typeof addSubscriptionInputSchema>;
