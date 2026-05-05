"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveOnboardingStepAction } from "./actions";

export function Step5Done({ hour, tz }: { hour: number; tz: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function finish() {
    start(async () => {
      await saveOnboardingStepAction(5, {});
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-2xl">🎉</p>
      <p className="text-sm text-muted-foreground">
        Tout est prêt. Ton premier briefing arrivera demain à
        <strong className="ml-1">
          {String(hour).padStart(2, "0")}:00 ({tz})
        </strong>
        .
      </p>
      <Button onClick={finish} disabled={pending} className="w-full">
        {pending ? "…" : "Aller au dashboard"}
      </Button>
    </div>
  );
}
