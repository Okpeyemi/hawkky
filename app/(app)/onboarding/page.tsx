import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";
import { OnboardingShell } from "@/src/ui/onboarding/OnboardingShell";
import { Step1ProfileType } from "@/src/ui/onboarding/Step1ProfileType";

const TOTAL = 5;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/signin");

  const profile = await getOrInitProfile(session.user.id);
  if (profile.onboardingCompletedAt) redirect("/dashboard");

  const sp = await searchParams;
  const step = Math.min(Math.max(Number(sp.step ?? 1), 1), TOTAL);

  if (step === 1) {
    return (
      <OnboardingShell step={1} total={TOTAL} title="Tu es plutôt…">
        <Step1ProfileType initial={profile.isDeveloper} />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={step} total={TOTAL} title="…">
      <p className="text-sm text-muted-foreground">À venir (Task 12)</p>
    </OnboardingShell>
  );
}
