import { auth } from "@/src/auth";
import { listForUser } from "@/src/server/sources-service";
import { AddSourceDialog } from "./add-source-dialog";
import { SourceRow } from "./source-row";

export default async function SourcesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const subs = await listForUser(session.user.id);

  const grouped = subs.reduce<Record<string, typeof subs>>((acc, s) => {
    const bucket = acc[s.source.kind] ?? [];
    bucket.push(s);
    acc[s.source.kind] = bucket;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <AddSourceDialog />
      </header>

      {subs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune source pour l'instant — ajoute un flux RSS, un subreddit ou un repo GitHub.
        </p>
      )}

      {Object.entries(grouped).map(([kind, items]) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {kind}
          </h2>
          <div className="space-y-2">
            {items.map((s) => (
              <SourceRow
                key={s.id}
                id={s.id}
                displayName={s.source.displayName}
                kind={s.source.kind}
                lastFetchedAt={s.source.fetchState?.lastFetchedAt?.toISOString() ?? null}
                lastError={s.source.fetchState?.lastError ?? null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
