import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { auth, signOut } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user.id) redirect("/signin");

  const profile = await getOrInitProfile(session.user.id);
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-border p-4 flex flex-col gap-2 bg-muted/20">
        <div className="font-semibold text-lg mb-4">Hawkky</div>
        <Link href="/dashboard" className="text-sm hover:underline">
          Dashboard
        </Link>
        <Link href="/sources" className="text-sm hover:underline">
          Sources
        </Link>
        <Link href="/profile" className="text-sm hover:underline">
          Profil
        </Link>
        <Separator className="my-3" />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button variant="ghost" size="sm" type="submit" className="w-full justify-start">
            Se déconnecter
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">{children}</main>
    </div>
  );
}
