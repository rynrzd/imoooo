# ImmoPilot — V1 : progression

## Terminé (ce pass)
- Bug calcul : `grossYield` divisait par `purchasePrice` sans garde (Infinity/NaN si prix = 0) → corrigé dans `finance.ts` et `statistiques/page.tsx`.
- Faux succès : le formulaire Profil (Paramètres) affichait « Profil mis à jour » sans écrire en base → écrit désormais réellement (`updateProfileRow` + `store.updateProfile`), bouton désactivé pendant l'envoi, erreur réelle affichée. E-mail passé en lecture seule (géré par l'auth).
- Fausse donnée : plan « actuel » codé en dur (`investisseur`) sur /abonnement → lit maintenant le vrai `profiles.plan` (défaut `free`). Bouton paiement = toast « bientôt (Stripe) », assumé.
- Import mort `Percent` supprimé.
- Vérifs : **TypeScript 0 erreur, lint 0 erreur, build OK (18 routes)**.

## Déjà conforme (vérifié, pas de changement)
- Mode démo strictement derrière `isSupabaseConfigured=false` : jamais servi en prod (env configuré).
- Journal d'activité : réel (dérivé au chargement + ajout à chaque action).
- Boutons/liens dashboard, quick-actions, user-menu : destinations réelles. Password/logout/exports : réels.
- Data layer + RLS : tables OK, lecture anon = `[]`, écriture anon = 401/42501 (pass précédent).

## Restant (non traité — nécessite session navigateur connectée)
- Isolation RLS **runtime à 2 comptes** (preuve anon faite, pas la preuve inter-comptes).
- Responsive/a11y : audit sur appareils réels (code déjà `overflow-x-auto`, `aria-label`, focus visibles — non re-testé écran par écran).
- Pagination des longues listes (documents, paiements, dépenses, locataires, logements).
- Tests automatisés (aucun runner présent) : cible = mappers, calculs financiers, validations Zod.
- Notifications (Paramètres) : toggles = toast sans persistance (pas de colonne prévue) — mineur.

## Prochaine action exacte
Se connecter avec 2 comptes de test, valider chaque module de bout en bout (création logement→bail→loyer→dépense→doc→photo), puis ajouter la pagination et un runner de tests unitaires léger (vitest) sur `finance.ts`/`insights.ts`/mappers.

## Tests effectués
`npx tsc --noEmit` (0), `npm run lint` (0 err), `npm run build` (OK, 18 routes). API PostgREST anon : tables + RLS (pass précédent). Pas de test navigateur ce pass.
