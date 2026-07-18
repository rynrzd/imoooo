# AUTH_ONBOARDING_FIX_REPORT — 17/07/2026

## Causes identifiées
1. **Confirmation cassée** : template Supabase par défaut (`{{ .ConfirmationURL }}` + PKCE) — le lien échoue hors du navigateur d'origine (téléphone, autre navigateur) ; erreurs GoTrue (`?error_code=otp_expired`) ignorées par le callback ; quota SMTP intégré (~2 e-mails/h) atteint — reproduit : 429 `over_email_send_rate_limit` sur l'API signup.
2. **Accès sans compte** : routes privées correctement protégées par le proxy (vérifié : 307 → /connexion sur les 11 routes + API en 401). Failles réelles corrigées : mode démo « tout ouvert » si variables env absentes ; fausse identité « Rayan Bailleur » affichée en mode réel ; e-mail confirmé jamais vérifié côté serveur ; sessions anonymes non filtrées (désactivées côté Supabase — vérifié).
3. **Fausse création (e-mail existant)** : Supabase renvoie un utilisateur factice sans envoyer d'e-mail ; l'UI affichait « e-mail envoyé à X » ; erreurs brutes en anglais (reproduit : `email_address_invalid`, 429).
4. **Visite à chaque connexion** : `protect_plan_column.sql` a révoqué UPDATE sur `profiles` en ne ré-autorisant que 3 colonnes ; si les grants suivants manquent en base, `onboarding_completed` n'est jamais persisté et l'assistant revient à chaque login (échec silencieux, masqué par l'UI).

## Corrections (code)
- `proxy.ts` : e-mail confirmé obligatoire côté serveur (redirection /verification-email), sessions anonymes ignorées, /verification-email public.
- `auth/callback/route.ts` : réécrit — erreurs GoTrue en query, token_hash prioritaire, lien expiré vs invalide distingués, « déjà confirmé » → poursuite, jamais d'erreur brute.
- `inscription` : écran de succès neutre (« Si cette adresse peut être utilisée… ») + liens Connexion / Mot de passe oublié, anti double clic, erreurs FR mappées (`auth-errors.ts`).
- `connexion` : « Adresse e-mail ou mot de passe incorrect. », non confirmé → /verification-email, `next` protégé contre `//hote`, messages callback FR.
- `/verification-email` (nouveau) : renvoi du lien avec cooldown 60 s, message neutre.
- `reinitialiser-mot-de-passe` : lien mort détecté à l'arrivée (plus d'échec à la soumission).
- Onboarding : 4 étapes courtes (Bienvenue / Profil / Premier logement / Terminé + visite proposée UNE fois : Lancer / Ne plus proposer), échec de persistance signalé honnêtement, statut en base uniquement.
- Visite guidée : 9 → 6 étapes réelles (Dashboard, Logements, Loyers, Documents, Notifications, Paramètres), jamais automatique, relance manuelle dans Paramètres → Aide.
- `config.ts` : mode démo uniquement si `NEXT_PUBLIC_DEMO_MODE=true` — variables absentes = démarrage refusé.
- Templates e-mails (3) prêts à coller : `supabase/email-templates/` (token_hash, design sobre ImmoPilot, FR).
- SQL réparation idempotent : `supabase/verifier_reparer_auth.sql` (grants, triggers, backfill profils/abonnements, requêtes de vérification et de nettoyage).

## Tests
- PASS : TypeScript (0 erreur) ; ESLint (0 erreur, 2 warnings préexistants) ; build production ; 11 routes privées sans session → 307 /connexion ; API privées → 401 ; /auth/callback (code invalide, code absent, otp_expired, next=//evil.com) → messages FR distincts, aucune redirection ouverte ; /verification-email rendue ; landing anonyme sur « / ».
- FAIL (constats environnement, hors code) : clé `SUPABASE_SECRET_KEY` rejetée (401) — suppression de compte et webhook Stripe cassés ; quota e-mail Supabase épuisé (429).
- NON TESTABLE ICI (nécessite un clic sur un e-mail reçu) : parcours E→H du plan (confirmation réelle, onboarding unique multi-appareils). Procédure exacte fournie dans AUTH_SETUP.md.

## Actions manuelles restantes (AUTH_SETUP.md)
1. Exécuter `verifier_reparer_auth.sql` (corrige la visite répétée). 2. Vérifier Site URL + Redirect URLs. 3. Coller les 3 templates d'e-mails (corrige la confirmation multi-appareils). 4. Régénérer `SUPABASE_SECRET_KEY` dans `.env.local`. 5. SMTP Resend avant production. 6. Test mobile via preview Vercel (jamais de lien localhost sur téléphone).

## Verdict
**AUTH READY WITH LIMITATIONS** — aucun accès privé sans compte valide (vérifié serveur) ; la confirmation multi-appareils et la persistance de l'onboarding dépendent des actions Dashboard 1-3 ci-dessus, non applicables depuis le code.
