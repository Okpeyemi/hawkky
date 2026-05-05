import { z } from "zod";

export const emailSchema = z.string().email().toLowerCase().max(254);
export const passwordSchema = z.string().min(8, "Au moins 8 caractères").max(200, "Trop long");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const onboardingStep1Schema = z.object({
  isDeveloper: z.boolean(),
});

export const onboardingStep2Schema = z.object({
  interests: z.array(z.string().min(1).max(40)).min(1).max(20),
});

export const onboardingStep3DevSchema = z.object({
  stackTags: z.array(z.string().min(1).max(40)).max(40),
  projectsDescription: z.string().max(2000).optional(),
});

export const onboardingStep3NonDevSchema = z.object({
  rssUrls: z.array(z.string().url().max(2048)).max(20).default([]),
  subreddits: z
    .array(
      z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, "Subreddit invalide"),
    )
    .max(20)
    .default([]),
});

export const onboardingStep4Schema = z.object({
  timezone: z.string().min(1).max(60),
  briefingHourLocal: z.number().int().min(0).max(23),
  whatsappEnabled: z.boolean().default(false),
  whatsappNumber: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Numéro E.164 attendu (+...)")
    .optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
