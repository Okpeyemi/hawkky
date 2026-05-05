"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOnboardingStepAction } from "./actions";

export function Step3NonDevSources() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rss, setRss] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [rssInput, setRssInput] = useState("");
  const [subInput, setSubInput] = useState("");

  function addRss() {
    const url = rssInput.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      return;
    }
    if (!rss.includes(url)) setRss((p) => [...p, url]);
    setRssInput("");
  }
  function addSub() {
    const s = subInput.trim().replace(/^r\//, "");
    if (!/^[a-zA-Z0-9_]+$/.test(s)) return;
    if (!subs.includes(s)) setSubs((p) => [...p, s]);
    setSubInput("");
  }

  function next() {
    start(async () => {
      await saveOnboardingStepAction(3, { rssUrls: rss, subreddits: subs });
      router.push("/onboarding?step=4");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Tes sources préférées (optionnel — tu pourras en ajouter plus tard).
      </p>

      <div>
        <label className="text-sm font-medium block mb-1" htmlFor="rss-input">
          Flux RSS
        </label>
        <div className="flex gap-2">
          <Input
            id="rss-input"
            value={rssInput}
            onChange={(e) => setRssInput(e.target.value)}
            placeholder="https://blog.exemple.com/feed.xml"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRss();
              }
            }}
          />
          <Button variant="outline" onClick={addRss}>
            +
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {rss.map((u) => (
            <Badge key={u} variant="secondary" className="font-mono text-xs">
              {u.replace(/^https?:\/\//, "").slice(0, 40)}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1" htmlFor="sub-input">
          Subreddits
        </label>
        <div className="flex gap-2">
          <Input
            id="sub-input"
            value={subInput}
            onChange={(e) => setSubInput(e.target.value)}
            placeholder="programming"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSub();
              }
            }}
          />
          <Button variant="outline" onClick={addSub}>
            +
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {subs.map((s) => (
            <Badge key={s} variant="secondary">
              r/{s}
            </Badge>
          ))}
        </div>
      </div>

      <Button onClick={next} disabled={pending} className="w-full">
        {pending ? "…" : "Continuer"}
      </Button>
    </div>
  );
}
