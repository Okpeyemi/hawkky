"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveOnboardingStepAction } from "./actions";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function Step4Delivery({
  initialTimezone,
  initialHour,
  initialWhatsappEnabled,
  initialWhatsappNumber,
}: {
  initialTimezone: string;
  initialHour: number;
  initialWhatsappEnabled: boolean;
  initialWhatsappNumber: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tz, setTz] = useState(initialTimezone);
  const [hour, setHour] = useState(String(initialHour));
  const [waEnabled, setWaEnabled] = useState(initialWhatsappEnabled);
  const [waNumber, setWaNumber] = useState(initialWhatsappNumber ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTimezone === "Europe/Paris") {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) setTz(detected);
      } catch {
        // keep default
      }
    }
  }, [initialTimezone]);

  function next() {
    setError(null);
    if (waEnabled && !/^\+[1-9]\d{6,14}$/.test(waNumber)) {
      setError("Numéro WhatsApp attendu au format E.164 (+33...)");
      return;
    }
    start(async () => {
      await saveOnboardingStepAction(4, {
        timezone: tz,
        briefingHourLocal: Number(hour),
        whatsappEnabled: waEnabled,
        whatsappNumber: waEnabled ? waNumber : undefined,
      });
      router.push("/onboarding?step=5");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        On t'envoie ton briefing chaque matin à l'heure que tu préfères.
      </p>

      <div className="space-y-1">
        <Label htmlFor="tz">Fuseau horaire</Label>
        <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Format IANA (ex: Europe/Paris, America/New_York). Auto-détecté.
        </p>
      </div>

      <div className="space-y-1">
        <Label>Heure de réception</Label>
        <Select
          value={hour}
          onValueChange={(v) => {
            if (v) setHour(v);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, "0")}:00
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="wa" checked={waEnabled} onCheckedChange={(c) => setWaEnabled(c === true)} />
        <Label htmlFor="wa" className="cursor-pointer">
          Recevoir aussi par WhatsApp
        </Label>
      </div>
      {waEnabled && (
        <div className="space-y-1">
          <Label htmlFor="wa-num">Numéro WhatsApp (E.164)</Label>
          <Input
            id="wa-num"
            value={waNumber}
            onChange={(e) => setWaNumber(e.target.value)}
            placeholder="+33612345678"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={next} disabled={pending} className="w-full">
        {pending ? "…" : "Recevoir mon premier briefing demain matin"}
      </Button>
    </div>
  );
}
