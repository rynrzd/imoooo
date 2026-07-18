-- =============================================================
-- ImmoPilot — index correctifs de performance (bêta).
-- Idempotent. N'altère aucune migration déjà appliquée.
-- =============================================================

begin;

-- Synchronisation chantier ↔ dépense : updateWorkRow / deleteWorkRow
-- filtrent expenses par maintenance_record_id (aucun index jusqu'ici).
create index if not exists expenses_maintenance_record_idx
  on public.expenses (maintenance_record_id)
  where maintenance_record_id is not null;

-- Compteur de notifications non lues (badge cloche) : requête fréquente
-- filtrée sur read = false uniquement.
create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where read = false;

-- Relances automatiques (cron) : rent_payments filtrés owner + statut retard.
create index if not exists rent_payments_late_idx
  on public.rent_payments (owner_id)
  where status = 'retard';

commit;
