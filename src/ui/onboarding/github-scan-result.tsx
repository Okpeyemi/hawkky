"use client";

interface Props {
  languages: string[];
  onAccept: (langs: string[]) => void;
}

export function GithubScanResult({ languages, onAccept }: Props) {
  if (languages.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="mb-2 font-medium">Langages détectés depuis tes repos :</div>
      <div className="flex flex-wrap gap-2">
        {languages.map((l) => (
          <span key={l} className="rounded-full bg-background px-2 py-1 text-xs">
            {l}
          </span>
        ))}
      </div>
      <button type="button" onClick={() => onAccept(languages)} className="mt-3 text-xs underline">
        Pré-remplir ma stack avec ces langages
      </button>
    </div>
  );
}
