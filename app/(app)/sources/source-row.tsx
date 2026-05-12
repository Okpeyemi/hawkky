"use client";

import { Button } from "@/components/ui/button";
import { removeSourceAction } from "./actions";

interface Props {
  id: string;
  displayName: string;
  kind: string;
  lastFetchedAt: string | null;
  lastError: string | null;
}

export function SourceRow({ id, displayName, kind, lastFetchedAt, lastError }: Props) {
  const status = lastError ? "error" : lastFetchedAt ? "ok" : "pending";
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="space-y-1">
        <div className="font-medium">{displayName}</div>
        <div className="text-xs text-muted-foreground">
          {kind} ·{" "}
          {status === "error"
            ? `erreur : ${lastError}`
            : status === "ok"
              ? `OK — ${new Date(lastFetchedAt as string).toLocaleString("fr-FR")}`
              : "en attente du premier fetch"}
        </div>
      </div>
      <form action={removeSourceAction}>
        <input type="hidden" name="id" value={id} />
        <Button variant="ghost" size="sm" type="submit">
          Supprimer
        </Button>
      </form>
    </div>
  );
}
