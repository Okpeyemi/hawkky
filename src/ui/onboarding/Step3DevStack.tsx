"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveOnboardingStepAction } from "./actions";

const PRESETS = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Go",
  "Rust",
  "Postgres",
  "Redis",
  "Tailwind",
  "Prisma",
  "Docker",
  "Kubernetes",
  "Vercel",
  "AWS",
  "GCP",
  "Supabase",
  "tRPC",
  "GraphQL",
];

export function Step3DevStack({
  initialTags,
  initialDescription,
}: {
  initialTags: string[];
  initialDescription: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [custom, setCustom] = useState("");

  function toggle(t: string) {
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  }
  function addCustom() {
    const t = custom.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags((p) => [...p, t]);
    setCustom("");
  }

  function next() {
    start(async () => {
      await saveOnboardingStepAction(3, {
        stackTags: tags,
        projectsDescription: description || undefined,
      });
      router.push("/onboarding?step=4");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ton stack (langues, frameworks, libs). Plus c'est précis, plus le briefing sera ciblé.
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set([...PRESETS, ...tags])).map((t) => (
          <Badge
            key={t}
            variant={tags.includes(t) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggle(t)}
          >
            {t}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Ajouter une techno"
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
      <div>
        <label className="text-sm font-medium mb-1 block" htmlFor="projects-description">
          Tes projets en cours <span className="text-muted-foreground">(optionnel)</span>
        </label>
        <Textarea
          id="projects-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Ex: SaaS de gestion d'événements en Next.js, app mobile de méditation en React Native…"
        />
      </div>
      <Button onClick={next} disabled={pending} className="w-full">
        {pending ? "…" : "Continuer"}
      </Button>
    </div>
  );
}
