-- =============================================================
--  Tunnel d'acquisition — deux étapes de plus dans landing_events
--
--  Parcours mesuré : landing → CTA → inscription → PREMIER LOGEMENT.
--  Les cinq premières étapes existaient déjà (exposure, cta_click,
--  signup_started, signup_completed…) ; il manquait la fin du tunnel.
--
--  Migration ADDITIVE et idempotente :
--    - aucune donnée existante n'est lue, modifiée ou supprimée ;
--    - aucune colonne ajoutée (les deux événements réutilisent les colonnes
--      existantes : element, meta->>'plan') ;
--    - aucune vue, aucun quota, aucun tarif, aucun droit n'est touché.
--
--  Tant qu'elle n'est pas appliquée, les deux nouveaux événements sont
--  simplement refusés par la contrainte : ils sont envoyés SEULS dans leur
--  requête (cf. src/lib/funnel.ts), donc aucun autre événement n'est perdu,
--  et l'échec est journalisé côté serveur sans jamais gêner l'utilisateur.
-- =============================================================

alter table public.landing_events
  drop constraint if exists landing_events_event_type_check;

alter table public.landing_events
  add constraint landing_events_event_type_check check (event_type in (
    -- Cycle de vie de la page
    'exposure',
    'engage',
    'scroll',
    'section_view',
    'section_dwell',
    'click',
    'cta_click',
    'video_play',
    'video_progress',
    'exit',
    -- Tunnel de conversion
    'signup_started',
    'plan_selected',
    'signup_completed',
    'payment_started',
    'payment_success',
    -- Fin du tunnel : activation réelle du compte (plan Gratuit)
    'first_property_started',   -- le formulaire du premier logement est ouvert
    'first_property_created'    -- le premier logement est enregistré
  ));

-- Lecture du tunnel complet par jour (les index existants couvrent déjà
-- (event_type, created_at desc) : rien à ajouter).
