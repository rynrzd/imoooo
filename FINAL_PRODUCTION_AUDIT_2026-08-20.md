# NIREO — FINAL PRODUCTION AUDIT

**Date** : 20/08/2026 · **Rien n'a été commité, poussé ni déployé. Aucun secret ni aucune configuration de production n'a été modifié.**
Tests menés contre la base **de production** (comptes jetables, supprimés), contre `https://nireo.fr` en ligne,
et contre un **build de production local** dans un **vrai navigateur** (Edge, 4 tailles d'écran).

## Score

| | |
|---|---|
| Audit sécurité initial | 93 / 100 |
| Passe cookies / promotion | 91 / 100 |
| Passe identité légale | 96 / 100 |
| **Score final** | **96 / 100** |

Le score **ne bouge pas** : cette dernière passe était une vérification, pas une
refonte. Elle n'a produit qu'une correction technique mineure — et elle a
révélé **deux incohérences de configuration Stripe** qui ne peuvent être
corrigées que depuis votre tableau de bord.

---

## Corrections finales

Une seule modification de code, justifiée par un risque réel de divergence :

| Fichier | Changement | Pourquoi |
|---|---|---|
| `src/config/legal.ts` | Ajout de `SUPABASE_REGION` (à `null`) et de `hostingRegionSentence()` | La région d'hébergement était réclamée **à deux endroits** (mentions légales **et** confidentialité) par deux textes séparés. Le jour où vous la renseignez, vous en auriez corrigé un et laissé l'autre afficher « À COMPLÉTER » en ligne. Elle se renseigne désormais **une seule fois**. |
| `src/app/(legal)/mentions-legales/page.tsx` | Utilise `hostingRegionSentence()` | idem |
| `src/app/(legal)/confidentialite/page.tsx` | Utilise `hostingRegionSentence()` | idem |
| `scripts/legal-pages-test.mjs` | **Nouveau** — 35 assertions rejouables | Le contrôle des pages légales était jusque-là un script jetable. Il est maintenant permanent : `node scripts/legal-pages-test.mjs [url]`. |

**Rien d'autre n'a été touché.** Architecture, design, composants, routes,
tables, RLS, cookies, monitoring, Stripe et promotion sont inchangés.

### Vérifications sans modification

- **SIREN** — `979 992 443`, présent **une seule fois** dans tout le projet
  (`src/config/legal.ts`), jamais transformé en SIRET.
- **SIRET** — aucun nombre de 14 chiffres n'apparaît sur la page rendue.
  Vérifié par assertion automatique, pas à l'œil.
- **Vercel** — informations inchangées, aucun téléphone ajouté. La page dit
  explicitement que cet hébergeur n'en publie pas.
- **Cookies** — mécanisme non touché. Cohérence vérifiée sur les cinq
  surfaces : le proxy conditionne et efface exactement les trois cookies
  (`nireo_vid`, `nireo_vst`, `nireo_ref`) que `/cookies` déclare soumis au
  consentement, et que `/confidentialite` décrit de la même façon.
- **TTC** — mention conservée. Elle est exacte dans les deux régimes de TVA :
  elle annonce que rien ne s'ajoute au paiement.
- **Portabilité** — la distinction outil d'export / droit légal est intacte.
- **Marqueurs de développement** — 0 `TODO`, 0 `FIXME`, 0 `MOCK`, 0 `FAKE`,
  0 `localhost` dans le code exécuté. La seule occurrence de « localhost » est
  un commentaire expliquant pourquoi le cookie `Secure` n'y est pas posé.
- **« À compléter »** — les deux occurrences restantes hors pages légales sont
  du **texte d'interface légitime** (badge « À compléter » sur un dossier de
  logement incomplet), pas des emplacements oubliés.

---

## Tests

| Suite | Résultat |
|---|---|
| `scripts/isolation-audit-test.mjs` — isolation entre comptes | **41/41 PASS** |
| `scripts/functional-audit-test.mjs` — parcours métier | **28/28 PASS** |
| `scripts/legal-pages-test.mjs` — pages légales en navigateur réel | **35/35 PASS** |
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur**, 6 avertissements = **baseline** |
| `npm run build` | **✓ Compiled successfully** |
| Erreurs console sur les pages légales | **0** |
| Débordement horizontal (mobile + desktop) | **0** |

*(La suite légale est passée de 30 à 35 assertions : cinq contrôles ajoutés —
exécution immédiate du service, portabilité non conditionnée au plan, absence
de téléphone Vercel inventé, `nireo_vst` documenté, disparition de « Aucun à ce
jour ».)*

**Aucune régression.** Les trois suites ont été rejouées après la modification.

---

## Informations manquantes

Aucune n'a été devinée, déduite ni complétée. Chacune est signalée **à l'écran**
comme manquante.

| Information | Où | Pourquoi elle n'est pas inventée |
|---|---|---|
| **SIRET** (14 chiffres) | mentions légales | SIREN + 5 chiffres d'établissement que nous n'avons pas. Un numéro fabriqué aurait l'apparence d'un vrai |
| **Ville et code postal** | mentions légales, confidentialité | « 1 avenue d'Alsace » existe dans de nombreuses communes |
| **Médiateur de la consommation** | CGU | L'adhésion doit être réellement souscrite avant de nommer un organisme |
| **Régime de TVA** | mentions légales | Aucune mention de TVA n'est affichée tant qu'il n'est pas confirmé |
| **Région Supabase** | source unique désormais | Non exposée par l'API ; à relever dans la console |
| Délais de purge et de conservation comptable | CGU, confidentialité | Dépendent d'obligations propres à l'éditeur |
| Clauses de limitation de responsabilité | CGU | Une clause mal rédigée est réputée non écrite |

---

## ACTIONS MANUELLES AVANT LANCEMENT

```text
INFORMATIONS LÉGALES
[ ] 1. SIRET — 14 chiffres, à mettre dans src/config/legal.ts (champ `siret`).
       Le SIREN 979 992 443 est déjà publié ; le SIRET ne peut PAS en être déduit.

[ ] 2. ADRESSE — code postal et ville de "1 avenue d'Alsace"
       (champ `addressCityLine` dans src/config/legal.ts).

[ ] 3. MÉDIATEUR DE LA CONSOMMATION — adhérer à un dispositif, puis renseigner
       nom, coordonnées et site. Obligation pour tout professionnel vendant
       à des consommateurs.

[ ] 4. RÉGIME DE TVA — franchise en base ou assujettissement, et le cas échéant
       le numéro de TVA intracommunautaire (champs `vatRegime` et `vatNumber`).

[ ] 5. RÉGION SUPABASE — Settings > General > Region, puis renseigner
       `SUPABASE_REGION` dans src/config/legal.ts (un seul endroit).

[ ] 6. DÉLAIS — conservation des données de facturation (obligations
       comptables) et purge des sauvegardes.

[ ] 7. VALIDATION JURIDIQUE — faire relire les CGU par un professionnel,
       en particulier la rétractation et les clauses de responsabilité.

STRIPE  (voir la section « Stripe » — configuration, pas code)
[ ] 8. NOM CLIENT STRIPE — modifier le branding / nom client de "Immopilot"
       vers "Nireo". UN SEUL champ : business_profile.name
       (Stripe > Paramètres > Détails du compte > Nom commercial public).
       Le relevé bancaire affiche déjà NIREO, les produits et les prix sont
       propres : ne renommer rien d'autre.

[ ] 9. RÉGIME DE TVA — confirmer AVANT toute modification de Stripe Tax ou
       création de nouveaux Prices. Les 5 prix sont en `tax_behavior:
       exclusive` (HT) alors que le site annonce TTC. Sans effet aujourd'hui
       (automatic_tax jamais activé), mais `tax_behavior` est immuable :
       le corriger imposerait de créer de nouveaux Prices.
       NE RIEN MODIFIER tant que le régime n'est pas tranché.

[ ] 10. CLÉS TEST — configurer les clés Stripe TEST en local, puis jouer le
        parcours E2E (checkout, webhook, changement de plan, annulation, échec).

[ ] 11. CLÉS LIVE — basculer .env.local sur les clés TEST et supprimer
        .env.local.bak-avant-expediteur.

EXPLOITATION
[ ] 12. MONITORING — définir MONITORING_WEBHOOK_URL sur Vercel, puis vérifier :
        curl https://nireo.fr/api/health  ->  "monitoring":true

[ ] 13. BLOC PROMO — corriger le texte, créer le code dans Stripe ET dans
        promo_codes, PUIS appliquer 20260724140000_marketing_promo.sql.

[ ] 14. STORAGE — purger les 7 dossiers orphelins de comptes supprimés.
```

---

## Stripe

Tout ce qui suit a été relevé **en lecture seule** sur l'API live.
**Aucune écriture, aucune session de paiement, aucun débit, aucune
modification de configuration fiscale.**

### Nom client — Immopilot → Nireo

Bonne nouvelle : « Immopilot » ne vient **que d'un seul champ**. Tout le reste
est déjà à Nireo.

| Champ | Valeur actuelle | Ce que le client en voit |
|---|---|---|
| **`business_profile.name`** | **« Immopilot »** | **Page de paiement Stripe, reçus, factures** |
| `settings.dashboard.display_name` | « Nireo » | Tableau de bord et e-mails Stripe — déjà correct |
| `settings.payments.statement_descriptor` | « NIREO » | **Relevé bancaire — déjà correct** |
| `settings.card_payments.statement_descriptor_prefix` | « NIR » | Préfixe relevé — déjà correct |
| `business_profile.url` | nireo.fr | correct |
| `business_profile.support_phone` | +33781697477 | correct |

C'est justement parce que le nom du tableau de bord affiche « Nireo » que
l'incohérence est passée inaperçue : le champ réellement montré au client est
`business_profile.name`, et lui seul est resté à l'ancien nom.

**Les produits et les prix sont propres** — aucun ne porte « Immopilot » :

```
prod_UwxMdUSpyi4v68  « Gratuit »      prod_UwxOrzq3poMsBV  « Pro »
prod_UwxN3degC9UxR1  « Starter »      prod_UwxOZ5cacCAL9t  « Business+ »
prod_UwxQCuoR2NjwHv  « Fondateur »    prod_UwxRb71rWAzwJQ  « FONDATEUR »
```

**Corriger ce champ ne casse rien** : il ne touche ni les Price IDs, ni les
Product IDs, ni les abonnements en cours, ni les webhooks, ni les factures
déjà émises. C'est une propriété d'affichage du compte.

> **ACTION MANUELLE REQUISE — modifier le branding / nom client Stripe de
> « Immopilot » vers « Nireo ».**
> Stripe → Paramètres → Détails du compte → *Nom commercial public*
> (`business_profile.name`). Ne rien renommer d'autre.

*Détail mineur relevé au passage : les deux produits Fondateur s'appellent
« Fondateur » et « FONDATEUR ». La casse apparaît sur la ligne de facture du
client. Cosmétique, à harmoniser si vous le souhaitez.*

### TVA — en attente de confirmation du régime fiscal

Les cinq prix portent `tax_behavior = exclusive` (« montant hors taxe, la taxe
s'ajoute ») alors que le site annonce « Prix en euros **TTC** ».

| Prix | Montant | `tax_behavior` |
|---|---|---|
| Starter | 9,99 € | `exclusive` |
| Pro | 14,99 € | `exclusive` |
| Business+ | 23,99 € | `exclusive` |
| Fondateur T1 / T2 | 99,99 € / 119,99 € | `exclusive` |

**Rien n'a été modifié, et rien ne doit l'être avant confirmation du régime.**

> **ACTION MANUELLE REQUISE — confirmer le régime de TVA applicable à Nireo
> avant toute modification de Stripe Tax ou création de nouveaux Prices.**

Je ne devine pas si Nireo est exonéré, assujetti, en franchise en base ou
soumis à TVA : cette réponse vient des informations fiscales réelles de
l'entreprise, pas d'une déduction.

### Prix — ne pas modifier tant que le régime TVA n'est pas confirmé

`tax_behavior` est **immuable** sur un prix Stripe : le corriger imposerait de
créer de nouveaux Prices et de mettre à jour les variables `STRIPE_PRICE_*`.
Fait dans le mauvais sens, cela rendrait le montant payé différent du montant
affiché. Aucun prix n'a donc été créé, remplacé ni supprimé.

### Le montant payé correspond-il au montant affiché ? — **Oui, vérifié**

| Plan | Affiché par Nireo | Prix Stripe | |
|---|---|---|---|
| Starter | 9,99 € | 9,99 € | identique |
| Pro | 14,99 € | 14,99 € | identique |
| Business+ | 23,99 € | 23,99 € | identique |

Aucune taxe n'est ajoutée aujourd'hui : le code n'active **jamais**
`automatic_tax` (vérifié, zéro occurrence dans `src/`), les trois abonnements
existants portent `automatic_tax=false`, aucune facture ne comporte de ligne de
taxe, et aucun taux de taxe par défaut n'est configuré sur le compte.

Le risque reste **latent** : Stripe Tax est `active` sur le compte. Activer la
taxe automatique — une case à cocher — ferait silencieusement passer les prix
en HT, et un client voyant « 9,99 € TTC » serait débité de 9,99 € **plus** la
TVA. D'où l'interdiction ci-dessus tant que le régime n'est pas tranché.

*Note sur les factures existantes : les montants payés observés (0,00 € et
0,50 €) proviennent de **remises au niveau de la facture** — les coupons
résiduels du client de test déjà documentés — et non d'un problème de prix ou
de taxe. Les sous-totaux facturés sont bien 9,99 € et 14,99 €.*

---

## Risques résiduels

### 🟡 Risques déjà connus, inchangés

- **Nom client Stripe** et **`tax_behavior`** : voir la section Stripe ci-dessus.

- **Cookie de session non `HttpOnly`** — imposé par `createBrowserClient` de
  `@supabase/ssr`. Raison de plus pour ne jamais relâcher la CSP.
- **`nanoid`** (high) via `next → postcss` : build-time, jamais appelé.
- **Rate limiting** en mémoire par instance, sauf connexion admin et accès
  partenaire (compteur SQL partagé).
- **Export RGPD** réservé aux plans payants — le texte distingue désormais
  l'outil du droit, honoré gratuitement sur demande. À arbitrer commercialement.
- **7 dossiers Storage orphelins** de comptes supprimés.
- **Parcours Stripe non testé de bout en bout** : clés `live`, aucun test
  débitant une vraie carte n'a été effectué, aucun résultat simulé.
- **Refus de cookies = pas de commission partenaire** — conséquence normale
  d'un refus de suivi marketing, assumée et isolée sur une ligne.

---

## Verdict

# ⚠️ READY WITH CONDITIONS — EN ATTENTE DES INFORMATIONS LÉGALES

**Aucune anomalie technique nouvelle n'a été trouvée dans le code.** Les trois
suites passent intégralement après modification : 41/41, 28/28, 35/35, avec
tsc, lint et build au niveau de référence.

La passe Stripe s'est révélée **rassurante** : « Immopilot » ne vient que d'un
seul champ (`business_profile.name`). Le relevé bancaire affiche déjà « NIREO »,
le nom du tableau de bord aussi, les six produits et les cinq prix sont propres.
Le corriger ne touche ni les Price IDs, ni les Product IDs, ni les abonnements
en cours, ni les webhooks, ni les factures émises.

Et **le montant payé correspond exactement au montant affiché** : 9,99 / 14,99 /
23,99 € de part et d'autre, aucune taxe ajoutée, aucun taux par défaut sur le
compte. Le seul risque est latent — Stripe Tax est `active`, et cocher la taxe
automatique ferait passer les prix en HT. D'où l'interdiction de toucher à quoi
que ce soit de fiscal avant que le régime soit tranché. **Rien n'a été
modifié.**

Le reste tient aux informations que vous seul détenez : SIRET, ville et code
postal, médiateur, régime de TVA.

**Ce document n'est pas une certification juridique.** Je ne suis pas juriste.
Les CGU reprennent le régime légal applicable aux contrats de service conclus à
distance ; leur rédaction — en particulier l'articulation entre exécution
immédiate et droit de rétractation, et les clauses de limitation de
responsabilité — doit être relue par un professionnel du droit.

Le score reste à **96/100** : le gonfler n'aurait servi à rien tant que ces
informations manquent.
