# NIREO — PASSE DE FINITION

**21/08/2026** · Rien n'a été commité, poussé ni déployé. Aucun secret ni aucune
configuration de production n'a été modifié. Aucune migration n'a été appliquée.

Ce n'est pas une refonte : l'identité, le design, les fonctionnalités et la
structure de Nireo sont inchangés. **53 fichiers touchés**, dont ~740 lignes de
code mort retirées.

---

## Le résultat en un coup d'œil

| Vérification | Avant | Après |
|---|---|---|
| Accessibilité — 13 pages publiques | 143/182 | **182/182** |
| Espace connecté — 18 pages privées, 5 largeurs | 230/259 | **259/259** |
| Parcours réels dans l'interface | 11/16 | **22/22** |
| Performance — 6 pages | 36/36 | **36/36** |
| Isolation entre comptes (base de production) | 41/41 | **41/41** |
| Parcours métier en base | 28/28 | **28/28** |
| TypeScript | 0 erreur | **0 erreur** |
| ESLint | 0 erreur, 6 avertissements | **identique** |
| Build | ✓ | **✓** |

---

## Comment cet audit a été mené

Tout ce qui suit a été **mesuré dans un vrai navigateur** (Edge headless piloté
en CDP), sur un build de production, avec de vraies sessions et de vrais
comptes — pas lu dans le code. Cinq outils rejouables ont été écrits :

| Outil | Ce qu'il vérifie |
|---|---|
| `scripts/a11y-audit.mjs` | 13 pages publiques : repères, titres, noms accessibles, étiquettes, contrastes **calculés**, cibles tactiles, **parcours Tab réel** |
| `scripts/app-audit.mjs` | 18 pages privées avec session : sémantique, focus, erreurs console, requêtes en échec, **5 largeurs**, états vides |
| `scripts/ui-flow-audit.mjs` | **Les actions réellement effectuées** : création, quota, modification, suppression, double clic, retour arrière, session expirée |
| `scripts/perf-audit.mjs` | Octets par type, requêtes, FCP, CLS, ressources demandées deux fois |
| `scripts/_cdp.mjs` | Socle commun — aucune dépendance npm ajoutée |

---

## Le défaut le plus sérieux : le double clic

**Constat.** Sur la création d'un logement, un triple clic sur « Continuer vers
les documents » crée **deux logements** — et franchit le quota du plan Gratuit,
limité à un seul. Vérifié en base : `2 logement(s) : Studio de test, Studio de test`.

**Cause.** Le garde-fou reposait sur un état React :

```
if (busy) return;   // busy vaut encore false
…
setBusy(true);      // programme un rendu, ne change rien dans ce tick
```

Trois clics dans le même tick lisent tous `busy === false` et partent tous.
Le composant `SubmitButton` affirmait d'ailleurs le contraire dans son
commentaire — « `pending` la désactive […] aucun appelant n'a donc à réinventer
ce garde-fou ». C'était faux : `disabled` ne prend effet qu'au rendu suivant.

**Correction, à deux niveaux.**

1. Dans l'assistant de création : un verrou par référence, écrit et relu dans
   le même tick.
2. Dans `SubmitButton` : un verrou de rafale de 500 ms — **un seul endroit**,
   qui couvre les **50 formulaires** partageant ce motif. Un clic délibéré
   ultérieur passe normalement ; seule la rafale est absorbée.

**Pourquoi il avait échappé aux passes précédentes** : il dépend du timing. Ma
première exécution du test était passée, la seconde a échoué. Un build vert ne
montre jamais ça.

---

## La trouvaille d'accessibilité : le focus qui s'éteint

Trois tentatives ont échoué avant d'en trouver la cause réelle.

Sur un `<input type="date">`, la tabulation ne s'arrête pas une fois : elle
traverse le jour, puis le mois, puis l'année. Mesuré au parcours Tab :

```
arrêt 13   INPUT[date]   fv=true    outline = solid 2px   ← anneau visible
arrêt 14   INPUT[date]   fv=false   outline = none        ← MÊME CHAMP, éteint
```

La personne continue de saisir **sans savoir où elle se trouve**. Un
`<video controls>` se comporte pareil pour sa barre de lecture.

- `:focus-visible` → ne corrige rien (c'est le sélecteur fautif)
- `:focus` → ne corrige rien non plus
- **`:focus-within`** → corrige

Dès que le focus descend dans le **shadow DOM du navigateur**, l'hôte cesse de
correspondre à `:focus` *comme* à `:focus-visible`. Corrigé en un seul endroit
(`globals.css`), pour **tous les champs de date de l'application**.

Après correction, l'anneau tient à chaque arrêt :

```
arrêt 14   INPUT[date]   fv=true    outline = solid 2px
arrêt 15   INPUT[date]   fv=false   outline = solid 2px
```

---

## Corrigé

### Accessibilité

| Correction | Le défaut constaté |
|---|---|
| **Lien d'évitement « Aller au contenu »** sur les 31 pages | WCAG 2.4.1 (A) : **aucune page n'en avait**. Au clavier, il fallait retraverser une trentaine de liens avant le contenu, sur chaque page |
| **`<main>` sur les 5 écrans d'authentification** | `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/verification-email` n'avaient **aucun point de repère principal** |
| **Focus des champs de date et du lecteur vidéo** | Voir ci-dessus |
| **Champ photo de profil** (`sr-only`, tabulable, sans étiquette) | Une personne au clavier tombait sur un champ de fichier anonyme *avant* le bouton qui le déclenche |
| **`Close` → `Fermer`** (boîtes et panneaux) | Seul texte anglais restant dans une interface entièrement française |
| **Cibles tactiles** du pied de page, du fil d'Ariane et du lien de contact | 16 à 22 px mesurés, sous le minimum de 24 px (WCAG 2.5.8) |

### Fiabilité

| Correction | Le défaut constaté |
|---|---|
| **Double clic** (assistant + `SubmitButton`) | Voir ci-dessus — duplication et quota franchi |

### Performance

| Correction | Mesure |
|---|---|
| **Préchargement du pied de page désactivé** | Les ~20 liens étaient tous préchargés dès qu'il entrait dans l'écran. `/contact` : **61 requêtes → 16** |

### Référencement

| Correction | Le défaut constaté |
|---|---|
| **`og:title` propre à `/tarifs`, `/contact`, `/a-propos`, `/entreprise`** | Partager la page Tarifs affichait le slogan générique du layout racine |

### Simplification

| Correction | Justification |
|---|---|
| **4 fichiers supprimés** (~740 lignes) | `product-previews`, `site-header`, `passport-preview` : plus jamais importés. `SiteFooter` : **plus rendu nulle part** depuis l'unification de la vitrine — seules ses données servaient encore. Deux pieds de page dont un mort, c'était un piège : une retouche pouvait atterrir dans celui que personne n'affiche (c'est arrivé) |

---

## Sécurité

**Aucune faille trouvée, aucune couche de sécurité modifiée.**

Les protections ont été re-prouvées, pas relues : **41/41** contre la base de
production (comptes jetables, supprimés).

- Lecture, écriture et suppression croisées refusées sur les 6 tables
- Référence croisée (bail, document, loyer sur le bien d'autrui) refusée côté SQL
- Auto-attribution d'un plan, d'un abonnement ou du rôle administrateur refusée
- Storage : téléchargement, signature d'URL, suppression et écriture dans le
  dossier d'autrui refusés ; SVG et HTML refusés par le serveur ; traversée de
  chemin neutralisée
- Quota serveur tenu, y compris sur 5 créations simultanées

Vérifié en plus dans le navigateur, session réelle : un compte B qui ouvre l'URL
du logement de A n'obtient rien ; une route privée sans session renvoie vers
`/connexion?next=…` ; une session invalidée en cours de navigation redirige
proprement sans écran d'erreur.

À noter : le seul contournement de quota trouvé venait du double clic côté
client, désormais fermé — la barrière serveur, elle, a toujours tenu.

---

## Fonctionnel — les actions réellement effectuées

| Parcours | Résultat |
|---|---|
| Formulaire vide | Refusé, **5 messages en français**, 5 champs marqués invalides, aucune erreur technique affichée |
| Code postal à 4 chiffres, surface négative | Refusés avec un message explicite |
| Création complète en 3 étapes (bien + locataire + bail) | Créés, valeurs saisies = valeurs enregistrées |
| **Triple clic** sur l'envoi | **Un seul** logement créé |
| Quota du plan Gratuit | 2ᵉ logement refusé, explication affichée |
| Modification depuis la fiche | Persistée en base |
| Suppression | Confirmation annonçant les conséquences, puis suppression réelle |
| Retour arrière du navigateur | Revient sur la bonne page, avec son contenu |
| Rafraîchissement en pleine saisie | Aucune casse |
| Ressource inexistante | Message clair, ni page blanche ni erreur technique |
| Session expirée | Redirection propre vers la connexion |

---

## Ce que j'ai décidé de NE PAS changer

Quatre « défauts » se sont révélés faux après vérification. J'ai corrigé mes
outils, pas votre produit.

| Signalement | Vérification | Décision |
|---|---|---|
| Contrastes « 1:1 » sur `/tarifs`, `/connexion`, la landing | **Capture d'écran** : texte clair sur carte en dégradé et sur photo voilée, parfaitement lisible. Ma sonde ne voyait ni les dégradés ni les calques photo | Sonde corrigée |
| Meta descriptions trop courtes sur les 4 pages légales | Ces pages sont en **`noindex`** | Contrôle corrigé |
| `<h1>` manquant et squelettes infinis sur 3 pages privées | Ma sonde mesurait **pendant le chargement** | Sonde corrigée (attente de `aria-busy`) |
| Case à cocher de 16 px sur `/connexion` | Elle est enveloppée dans un `<label>` de 44 px : **toute l'étiquette est cliquable** | Sonde corrigée |

---

## À surveiller

| Point | Nature |
|---|---|
| **Mémoire de cette machine** | Un `next build` a échoué sur `memory allocation failed`, et un autre a produit un résultat **incomplet** que j'ai d'abord pris pour un défaut du produit. Cause : **215 processus Edge orphelins** laissés par mes propres outils. Corrigé dans `scripts/_cdp.mjs` (fermeture par CDP + arbre de processus + purge du profil) — vérifié : **0 fuite** après le dernier run. À retenir : sous mémoire saturée, un build local est trompeur, pas seulement lent |
| `HSTS` et `upgrade-insecure-requests` en build local | Le garde-fou teste `NODE_ENV === "development"`, mais `next start` tourne en production : les deux en-têtes sont donc posés sur `http://localhost`, contrairement à l'intention écrite en commentaire. **Sans effet en production.** Non modifié volontairement : retirer un en-tête de sécurité pour conforter un test local est un mauvais échange — à vous de trancher |
| 49 autres formulaires au motif du double clic | Le verrou de `SubmitButton` les couvre tous. Les corriger un par un serait le gros refactor que vous excluiez, et aucun autre n'a été **prouvé** vulnérable |
| Les 6 points légaux ouverts | SIRET, ville et code postal, médiateur, régime de TVA, région Supabase, délais de conservation — inchangés depuis le 20/08, toujours signalés **à l'écran** comme manquants |

---

## Vérifications finales

| | Résultat |
|---|---|
| **TypeScript** | 0 erreur |
| **ESLint** | 0 erreur, 6 avertissements — **référence inchangée** |
| **Build** | ✓ Compiled successfully, 0 asset manquant |
| **Navigateur** | 0 erreur console, 0 requête en échec |
| **Mobile** | 0 débordement sur **5 largeurs** (320 / 390 / 768 / 1280 / 1920) |
| **Accessibilité** | **182/182** (contre 143 avant) |
| **Sécurité** | **41/41** — isolation prouvée en base de production |
| **Fonctionnel** | **28/28** en base · **22/22** en parcours d'interface |
| **Performance** | **36/36** — 233 à 251 Ko de JS, CLS ≈ 0, 16 à 23 requêtes par page |
