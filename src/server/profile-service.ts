import {
  onboardingStep1Schema,
  onboardingStep2Schema,
  onboardingStep3DevSchema,
  onboardingStep3NonDevSchema,
  onboardingStep4Schema,
} from "@/src/domain/profile/schemas";
import type { OnboardingStep, ProfileSnapshot } from "@/src/domain/profile/types";
import { prisma } from "@/src/infra/prisma";

export async function getOrInitProfile(userId: string): Promise<ProfileSnapshot> {
  const profile = await prisma.profile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return {
    isDeveloper: profile.isDeveloper,
    timezone: profile.timezone,
    briefingHourLocal: profile.briefingHourLocal,
    interests: profile.interests,
    stackTags: profile.stackTags,
    projectsDescription: profile.projectsDescription,
    followedRepos: profile.followedRepos,
    whatsappEnabled: profile.whatsappEnabled,
    whatsappNumber: profile.whatsappNumber,
    onboardingCompletedAt: profile.onboardingCompletedAt,
  };
}

export async function saveOnboardingStep(
  userId: string,
  step: OnboardingStep,
  data: unknown,
): Promise<void> {
  switch (step) {
    case 1: {
      const parsed = onboardingStep1Schema.parse(data);
      await prisma.profile.update({
        where: { userId },
        data: { isDeveloper: parsed.isDeveloper },
      });
      return;
    }
    case 2: {
      const parsed = onboardingStep2Schema.parse(data);
      await prisma.profile.update({
        where: { userId },
        data: { interests: parsed.interests },
      });
      return;
    }
    case 3: {
      const profile = await prisma.profile.findUniqueOrThrow({ where: { userId } });
      if (profile.isDeveloper) {
        const parsed = onboardingStep3DevSchema.parse(data);
        await prisma.profile.update({
          where: { userId },
          data: {
            stackTags: parsed.stackTags,
            projectsDescription: parsed.projectsDescription ?? null,
          },
        });
      } else {
        // Non-dev branch: validate shape but don't persist yet — Source/Subscription
        // tables land in Plan 2. Throwing on invalid shape preserves the contract.
        onboardingStep3NonDevSchema.parse(data);
      }
      return;
    }
    case 4: {
      const parsed = onboardingStep4Schema.parse(data);
      await prisma.profile.update({
        where: { userId },
        data: {
          timezone: parsed.timezone,
          briefingHourLocal: parsed.briefingHourLocal,
          whatsappEnabled: parsed.whatsappEnabled,
          whatsappNumber: parsed.whatsappEnabled ? (parsed.whatsappNumber ?? null) : null,
        },
      });
      return;
    }
    case 5: {
      await prisma.profile.update({
        where: { userId },
        data: { onboardingCompletedAt: new Date() },
      });
      return;
    }
  }
}
