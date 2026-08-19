/**
 * Injection d'un graphe schema.org dans le HTML rendu côté serveur.
 * Composant serveur : le balisage est présent dans la source de la page,
 * sans dépendre du JavaScript.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // `JSON.stringify` n'échappe PAS `<` : une chaîne contenant
      // « </script> » refermerait la balise et le reste serait exécuté comme
      // du HTML. Les données actuelles viennent toutes du code, mais il
      // suffirait qu'un jour un titre éditable passe par ici pour ouvrir une
      // faille — l'échappement coûte un caractère et la ferme définitivement.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
