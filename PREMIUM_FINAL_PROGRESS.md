# SaaS Premium — état (2026-07-16)

## Terminé (TS 0 erreur · lint 0 erreur, 2 warnings RHF bénins · build 38 routes)
- **Dashboard** : section « Aujourd'hui » (loyers du mois restants, interventions
  prévues/en cours, documents expirant ≤ 30 j, fins de bail ≤ 60 j — 100 %
  données Supabase) ; KPI complétés : loyers encaissés/attendus du mois avec
  progression, occupés/vacants sur la carte occupation. HealthScore, graphique,
  logements prioritaires, aperçus travaux/documents conservés.
- **Alertes** : niveaux Critique/Important/Info (badges colorés) dans
  « À traiter aujourd'hui » — chaque ligne garde sa vraie action
  (encaisser, relancer, ajouter locataire/document).
- **Timeline** : activité enrichie — paiements, retards, travaux, documents,
  locataires (entrée/sortie de bail), dépenses, photos ; filtrée au passé,
  triée, plafonnée à 30 ; état vide propre.
- **Recherche globale** : Ctrl/⌘+K (bouton sidebar + icône mobile) —
  logements, locataires, baux, loyers, documents, travaux ; insensible aux
  accents, groupée, navigation clavier (↑ ↓ Entrée), accès direct aux dossiers.
- **Actions rapides** : déjà réelles (AddMenu → vrais dialogues logement/
  locataire/travaux/dépense/document/photo + encaissement) — vérifiées.
- **Statistiques** : + taux d'encaissement 12 mois (KPI), rendement brut moyen,
  évolution des revenus vs année précédente (année civile, « — » si aucune
  base de comparaison — jamais de chiffre inventé).
- **Dossiers** : déjà complets (logement : 7 onglets résumé/locataire/loyers/
  documents/photos/finances/historique ; locataire : paiements/documents/
  timeline/notes + garant) — aucun changement nécessaire.
- **UX/Perf** : graphiques déjà lazy (recharts hors bundle initial), skeletons
  en place, états vides ajoutés (timeline, aujourd'hui, recherche), recherche
  100 % côté client (zéro requête supplémentaire).

## QA
Pages publiques 200 ; pages app → 307 vers /connexion sans session (guard
auth normal) ; build prerender 38/38 OK. Test visuel connecté à faire à la
main (dashboard, recherche, alertes) — aucune erreur console au build.

## Prochaine action
Recharger l'app connectée : vérifier « Aujourd'hui », badges d'alerte,
Ctrl+K, puis Statistiques (encaissement, évolution annuelle).
