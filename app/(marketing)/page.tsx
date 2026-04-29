export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-semibold tracking-tight">Hawkky</h1>
        <p className="text-xl text-muted-foreground">Ta veille tech, distillée chaque matin.</p>
        <div className="flex gap-3 justify-center pt-4">
          <a
            href="/signup"
            className="px-5 py-2.5 rounded-md bg-foreground text-background font-medium"
          >
            Commencer
          </a>
          <a href="/signin" className="px-5 py-2.5 rounded-md border border-border font-medium">
            Se connecter
          </a>
        </div>
      </div>
    </main>
  );
}
