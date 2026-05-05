"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OnboardingShell({
  step,
  total,
  title,
  children,
}: {
  step: number;
  total: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="text-xs text-muted-foreground mb-2">
            Étape {step} / {total}
          </div>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
