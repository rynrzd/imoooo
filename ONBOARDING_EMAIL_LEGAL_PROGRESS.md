# Onboarding, e-mails, notifications, légal — état (2026-07-17)

## Terminé (compile, build 34 routes OK)
- **Onboarding** : assistant 4 étapes (progression, ignorable, jamais bloquant),
  affiché une seule fois (`profiles.onboarding_completed`), « Créer mon premier
  logement » → page Logements (vrai formulaire, aucun doublon), « Revoir le
  guide » dans Paramètres (événement `immopilot:onboarding`).
- **Visite guidée** : tooltips ancrés sur les liens réels de la sidebar,
  Suivant/Précédent/Ignorer/Terminer, cible absente = carte centrée (jamais
  bloquant), `profiles.product_tour_completed`, « Revoir la visite » dans
  Paramètres, `motion-safe` respecté.
- **Centre de notifications** : table + RLS, cloche (sidebar + mobile),
  compteur non-lus, lu / tout lu / suppression, pagination 15, alertes
  dérivées matérialisées avec dedupe_key (aucun doublon, rien de codé en dur).
- **Préférences** : double canal Appli/E-mail par type (7 types), persistées ;
  relances configurables (mode notification/e-mail proprio/e-mail locataire,
  jalons J+3/7/15, copie, message personnalisé).
- **E-mails** : provider.ts (Resend/Brevo/Postmark via EMAIL_PROVIDER, HTML +
  texte brut, `provider_not_configured` explicite, zéro envoi sans clé),
  templates.ts centralisés (bienvenue, confirmations, mot de passe, suppression,
  abonnement, contact, loyer dû/en retard, bail, document, travaux, rapport).
- **Relance manuelle** : bouton sur échéance en retard (dialogue loyer) →
  `/api/rent-reminder` (destinataire réel, message ponctuel, email_logs,
  notification interne, aucun succès avant retour fournisseur ; 503 sans clé).
- **Relances automatiques** : `/api/cron/rent-reminders` (Bearer CRON_SECRET,
  idempotent via email_logs unique, bail actif + reste dû vérifiés, désactivé
  par défaut, 503 documenté sans CRON_SECRET/fournisseur/clé admin).
- **Légal/cookies** : /cookies créée (honnête : cookies nécessaires uniquement,
  PAS de bannière mensongère — sera requise seulement si un outil tiers est
  ajouté), lien footer, sitemap, proxy. Pages légales existantes conservées.
- **Contact/support** : déjà réels (mailto configurable, support dans Paramètres).

## Migration à exécuter manuellement (SQL Editor)
`supabase/migrations/20260717150000_notifications.sql`
(+ `20260717090000_account_settings.sql` si pas encore fait — prérequis).

## Gates
TypeScript 0 erreur · Lint 0 erreur (2 warnings RHF bénins) · Build 34 routes.

## Prochaine action manuelle
Exécuter la migration ci-dessus, recharger l'app connectée : l'onboarding
s'ouvre (compte avec onboarding_completed=false), cloche visible, préférences
persistantes. E-mails : renseigner EMAIL_PROVIDER/EMAIL_FROM/clé pour activer.
