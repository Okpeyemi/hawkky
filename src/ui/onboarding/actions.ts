"use server";

import { auth } from "@/src/auth";
import type { OnboardingStep } from "@/src/domain/profile/types";
import { saveOnboardingStep } from "@/src/server/profile-service";

export async function saveOnboardingStepAction(step: OnboardingStep, data: unknown) {
  const session = await auth();
  if (!session?.user.id) throw new Error("Not authenticated");
  await saveOnboardingStep(session.user.id, step, data);
  return { ok: true };
}
