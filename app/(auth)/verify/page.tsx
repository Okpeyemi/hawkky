import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Search = { status?: "ok" | "error" | "missing"; msg?: string };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { status, msg } = await searchParams;

  if (status === "ok") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email vérifié ✅</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ton compte est activé. Tu peux maintenant{" "}
            <a href="/signin" className="underline">
              te connecter
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "error" || status === "missing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lien invalide</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{msg ?? "Le lien est invalide ou expiré."}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Re-tente une inscription ou contacte le support.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vérification email</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Si tu viens de t'inscrire, vérifie ta boîte mail et clique sur le lien reçu.
        </p>
      </CardContent>
    </Card>
  );
}
