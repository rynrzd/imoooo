/**
 * Injection d'un graphe schema.org dans le HTML rendu côté serveur.
 * Composant serveur : le balisage est présent dans la source de la page,
 * sans dépendre du JavaScript.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Contenu contrôlé par l'application (aucune donnée utilisateur).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
