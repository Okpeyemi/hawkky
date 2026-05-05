import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";
import { OnboardingShell } from "@/src/ui/onboarding/OnboardingShell";
import { Step1ProfileType } from "@/src/ui/onboarding/Step1ProfileType";
import { Step2Interests } from "@/src/ui/onboarding/Step2Interests";
import { Step3DevStack } from "@/src/ui/onboarding/Step3DevStack";
import { Step3NonDevSources } from "@/src/ui/onboarding/Step3NonDevSources";
import { Step4Delivery } from "@/src/ui/onboarding/Step4Delivery";
import { Step5Done } from "@/src/ui/onboarding/Step5Done";

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

  switch (step) {
    case 1:
      return (
        <OnboardingShell step={1} total={TOTAL} title="Tu es plutôt…">
          <Step1ProfileType initial={profile.isDeveloper} />
        </OnboardingShell>
      );
    case 2:
      return (
        <OnboardingShell step={2} total={TOTAL} title="Tes centres d'intérêt">
          <Step2Interests initial={profile.interests} />
        </OnboardingShell>
      );
    case 3:
      return (
        <OnboardingShell
          step={3}
          total={TOTAL}
          title={profile.isDeveloper ? "Ton stack et tes projets" : "Tes sources préférées"}
        >
          {profile.isDeveloper ? (
            <Step3DevStack
              initialTags={profile.stackTags}
              initialDescription={profile.projectsDescription}
            />
          ) : (
            <Step3NonDevSources />
          )}
        </OnboardingShell>
      );
    case 4:
      return (
        <OnboardingShell step={4} total={TOTAL} title="Quand recevoir ton briefing ?">
          <Step4Delivery
            initialTimezone={profile.timezone}
            initialHour={profile.briefingHourLocal}
            initialWhatsappEnabled={profile.whatsappEnabled}
            initialWhatsappNumber={profile.whatsappNumber}
          />
        </OnboardingShell>
      );
    case 5:
      return (
        <OnboardingShell step={5} total={TOTAL} title="C'est prêt !">
          <Step5Done hour={profile.briefingHourLocal} tz={profile.timezone} />
        </OnboardingShell>
      );
  }
}
