import { auth } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user.id) return null;
  const profile = await getOrInitProfile(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bonjour 👋</h1>
      <div className="rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground mb-2">Prochain briefing</p>
        <p className="text-lg font-medium">
          Demain à {String(profile.briefingHourLocal).padStart(2, "0")}:00 ({profile.timezone})
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Le pipeline d'ingestion et de génération sera branché aux prochains plans.
        </p>
      </div>
    </div>
  );
}
