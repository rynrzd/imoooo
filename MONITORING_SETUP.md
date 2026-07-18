# Monitoring — architecture prête, rien d'installé sans clé

## Point de branchement unique
Toutes les erreurs serveur importantes passent par `src/lib/logger.ts`
(`logger.error(scope, err)` → `report()`). Brancher un service externe =
compléter `report()` — aucun autre fichier à modifier.
Scopes existants : `auth/*`, `stripe/*`, `storage/*`, `supabase/*`,
`account/*`, `cron/*`, `founder-waitlist/*`, `app/*`.

## À connecter plus tard (dans l'ordre utile)
1. **Vercel** (inclus, 0 config) : Analytics + logs des fonctions — activer dans le dashboard.
2. **Sentry** (quand DSN disponible) : `npx @sentry/wizard@latest -i nextjs`,
   puis appeler `Sentry.captureException(err)` dans `report()`. Ne PAS installer avant.
3. **Supabase** : Dashboard → Reports (requêtes lentes, erreurs Auth) + alertes e-mail projet.
4. **E-mails** : la table `email_logs` trace déjà sent/failed par utilisateur —
   surveiller les `status = 'failed'`.
5. **Stripe** (après activation) : Dashboard → Webhooks (échecs de livraison) ;
   les erreurs applicatives arrivent déjà dans `logger.error("stripe/*")`.

## Règles
- Aucune donnée personnelle sensible dans les logs (jamais d'e-mail complet
  dans les messages, jamais de token/clé/URL signée — déjà respecté).
- Les erreurs affichées à l'utilisateur restent des messages français clairs ;
  le détail technique ne va que dans les logs serveur.
