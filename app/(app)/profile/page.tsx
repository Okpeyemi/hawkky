import { auth } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user.id) return null;
  const profile = await getOrInitProfile(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profil</h1>
      <pre className="text-xs bg-muted p-4 rounded">{JSON.stringify(profile, null, 2)}</pre>
      <p className="text-sm text-muted-foreground">
        Édition fine ajoutée au Plan 2 (en même temps que la gestion des sources).
      </p>
    </div>
  );
}
