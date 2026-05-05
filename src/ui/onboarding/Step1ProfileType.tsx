"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveOnboardingStepAction } from "./actions";

export function Step1ProfileType({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(isDev: boolean) {
    startTransition(async () => {
      await saveOnboardingStepAction(1, { isDeveloper: isDev });
      router.push("/onboarding?step=2");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        On adapte les sources et les conseils à ton profil.
      </p>
      <div className="grid grid-cols-1 gap-3 mt-4">
        <Card
          className={`cursor-pointer hover:border-foreground transition ${initial ? "border-foreground" : ""}`}
          onClick={() => pick(true)}
        >
          <CardContent className="p-4">
            <div className="font-medium">Développeur·se</div>
            <div className="text-sm text-muted-foreground">
              On va te demander ton stack et tes projets pour personnaliser.
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:border-foreground transition ${!initial ? "border-foreground" : ""}`}
          onClick={() => pick(false)}
        >
          <CardContent className="p-4">
            <div className="font-medium">Curieux·se tech (non-dev)</div>
            <div className="text-sm text-muted-foreground">
              On se base sur tes centres d'intérêt et tes sources préférées.
            </div>
          </CardContent>
        </Card>
      </div>
      <Button variant="ghost" disabled={pending} className="w-full mt-2">
        {pending ? "…" : "Choisis pour continuer"}
      </Button>
    </div>
  );
}
