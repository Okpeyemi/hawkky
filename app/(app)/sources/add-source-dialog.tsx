"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSourceAction } from "./actions";

const KINDS = [
  { value: "rss", label: "Flux RSS", placeholder: "https://example.com/feed.xml" },
  { value: "hn_top", label: "Hacker News — Top", placeholder: "global" },
  { value: "reddit_subreddit", label: "Subreddit", placeholder: "programming" },
  { value: "github_trending_lang", label: "GitHub Trending (langage)", placeholder: "typescript" },
  { value: "github_repo", label: "GitHub Repo", placeholder: "vercel/next.js" },
] as const;

export function AddSourceDialog() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("rss");
  const current = KINDS.find((k) => k.value === kind) ?? KINDS[0];

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Ajouter une source</Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Ajouter une source</h2>
            <form
              action={async (fd) => {
                await addSourceAction(fd);
                setOpen(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label htmlFor="kind">Type</Label>
                <select
                  id="kind"
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="key">Identifiant</Label>
                <Input id="key" name="key" placeholder={current.placeholder} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">Ajouter</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
