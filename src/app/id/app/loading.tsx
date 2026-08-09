/** État de chargement de l'espace Nireo ID (squelette sobre, non animé à l'excès). */
export default function NireoIdAppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement en cours…</span>
      <div className="h-8 w-52 rounded-lg bg-muted" />
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="nid-panel flex items-center gap-4 rounded-lg p-4">
            <div className="size-14 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
