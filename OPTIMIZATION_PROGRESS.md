# ImmoPilot — optimisation (2026-07-16)

## Mesures réalisées
- Recharts pesait ~355 Ko (non compressé) dans le JS initial du dashboard,
  des statistiques et de l'onglet loyers du dossier logement.
- Vérifié après correction : les chunks contenant recharts sont **absents du
  HTML initial** de `/` et `/statistiques` (chargés à la demande via import()).
- Tailles par route non fournies par le build Turbopack : comparaison
  chiffrée par route indisponible (indiqué, non fabriqué).

## Optimisations terminées
1. **Graphiques en dynamic import** (`components/charts/lazy.tsx` + MainChart
   dynamique) avec skeleton ; constantes de séries déplacées dans
   `chart-theme.ts` pour que les légendes n'embarquent pas recharts.
2. **Colonnes Supabase explicites** dans `fetchAppData` (fini `select("*")`
   sur les 7 tables) — payloads réduits, contrat schéma figé.
3. **Pagination réelle** (`shared/pagination-bar.tsx`, hook + barre) :
   loyers (24/page), documents (25/page), photos (24/page — visionneuse
   cohérente par page, moins d'images chargées d'un coup).
   Filtres/recherche conservés, retour page 1 par dérivation (pas d'effet).

## Constats d'audit (sans changement nécessaire)
- Recherches/filtres : opèrent sur le store local → aucune requête par frappe,
  debounce inutile. URLs signées : déjà générées en 1 requête batch (photos)
  et à la demande (documents/justificatifs). Index DB : couverture déjà
  complète (owner_id, property_id, tenant_id, lease_id, month, date, status).
- `ensureRentSchedule` : 2 requêtes par chargement, idempotent — acceptable.

## Gains constatés
- JS initial dashboard/stats/dossier : − chunk recharts (~355 Ko brut) différé.
- Lint : 1 erreur « setState dans effet » corrigée. TS 0 erreur, build OK.

## Restant
- Pagination logements/locataires/travaux (croissance lente, priorité basse).
- Miniatures serveur pour les photos (transformation d'images Supabase — payant).
- Agrégations serveur des stats si le volume dépasse quelques milliers de lignes.

## Prochaine action exacte
Tester en navigateur connecté : dashboard (skeleton graphique), pagination
loyers/documents/photos avec filtres, puis passer aux étapes Stripe/déploiement.
