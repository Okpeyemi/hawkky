"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOnboardingStepAction } from "./actions";

const PRESETS = [
  "IA",
  "IA agentique",
  "LLMs",
  "Frontend",
  "Backend",
  "DevOps",
  "Sécurité",
  "Web3",
  "Design",
  "Startups",
  "Open source",
  "Mobile",
  "Data",
  "Cloud",
  "Performance",
  "Accessibilité",
  "Productivité",
];

export function Step2Interests({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");

  function toggle(tag: string) {
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function addCustom() {
    const t = custom.trim();
    if (!t) return;
    if (!selected.includes(t)) setSelected((p) => [...p, t]);
    setCustom("");
  }

  function next() {
    start(async () => {
      await saveOnboardingStepAction(2, { interests: selected });
      router.push("/onboarding?step=3");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choisis au moins un sujet (et ajoute les tiens si besoin).
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set([...PRESETS, ...selected])).map((tag) => (
          <Badge
            key={tag}
            variant={selected.includes(tag) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggle(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Ajouter un sujet personnalisé"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button variant="outline" onClick={addCustom}>
          +
        </Button>
      </div>
      <Button onClick={next} disabled={pending || selected.length === 0} className="w-full">
        {pending ? "…" : "Continuer"}
      </Button>
    </div>
  );
}
