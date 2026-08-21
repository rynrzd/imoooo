/**
 * LIEN D'ÉVITEMENT — « Aller au contenu ».
 *
 * Toute page de Nireo commence par la même trentaine de liens : marque,
 * navigation, menu. Sans ce raccourci, une personne qui navigue au clavier ou
 * au lecteur d'écran les retraverse À CHAQUE page avant d'atteindre ce qu'elle
 * est venue lire. C'est le critère WCAG 2.4.1 (« contourner des blocs »).
 *
 * Il est le premier élément du `<body>` : c'est là qu'on l'attend, et c'est la
 * seule position qui lui donne son sens.
 *
 * POURQUOI PAS `sr-only` : cet utilitaire impose `padding: 0` pour réduire
 * l'élément à 1 px, mais les classes de marge intérieure (`px-4 py-2.5`) le
 * remportent. Le lien occupait alors une boîte invisible de 32 × 20 px posée
 * en haut à gauche de chaque page. On le sort donc franchement de l'écran, et
 * on le ramène au focus — sans que ses dimensions dépendent d'un arbitrage
 * entre utilitaires.
 *
 * `tabIndex={-1}` est posé sur le `<main>` cible (et non ici) : sans lui, le
 * navigateur fait défiler la page mais NE DÉPLACE PAS le focus, et la
 * tabulation suivante repartirait du début — le raccourci n'aurait alors
 * servi à rien.
 */
export function SkipLink() {
  return (
    <a
      href="#contenu"
      className="fixed top-3 left-3 z-[100] -translate-y-[200%] rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg outline-none transition-transform focus-visible:translate-y-0 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
    >
      Aller au contenu
    </a>
  );
}
