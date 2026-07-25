-- =============================================================
-- Nireo — INTÉGRITÉ FINANCIÈRE (audit affiliation 25/07/2026).
--
-- Règle : une commission partenaire ne peut JAMAIS exister, être modifiée
-- ni annulée sans être liée à un payment_intent Stripe VALIDE.
--
-- Faille corrigée : une commission créée avec stripe_payment_intent_id = ''
-- (quand la résolution du PI échouait) n'était jamais rattachée à un
-- remboursement — reverseCommissionForRefund matche par payment_intent →
-- un partenaire pouvait rester rémunéré pour un paiement remboursé.
--
-- Cette contrainte s'applique AUSSI au service_role (webhook Stripe) : une
-- contrainte CHECK n'est jamais contournée par BYPASSRLS. Toute insertion
-- OU mise à jour d'une commission est donc refusée sans « pi_… » valide.
--
-- Idempotent. Pré-prod : 0 commission existante (vérifié le 25/07/2026).
-- =============================================================

begin;

-- 1. Neutralise d'éventuelles lignes héritées sans payment_intent valide
--    (0 en pré-prod). Elles ne peuvent pas être remboursées correctement :
--    on les ANNULE avec un PI sentinelle traçable — jamais supprimées
--    (traçabilité financière). N'affecte que les lignes fautives.
update public.partner_commissions
set status = 'cancelled',
    reversal_reason = left(
      'Annulée (intégrité) : commission sans payment_intent Stripe valide, '
      || 'non rattachable à un remboursement. ' || coalesce(reversal_reason, ''),
      500
    ),
    stripe_payment_intent_id = 'pi' || 'invalid' || replace(id::text, '-', '')
where stripe_payment_intent_id is null
   or stripe_payment_intent_id !~ '^pi_[A-Za-z0-9]+$';

-- 2. Contrainte : payment_intent Stripe obligatoire et bien formé (« pi_… »).
--    Validée immédiatement (aucune ligne fautive ne subsiste après l'étape 1).
alter table public.partner_commissions
  drop constraint if exists partner_commissions_pi_required;
alter table public.partner_commissions
  add constraint partner_commissions_pi_required
  check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$');

-- 3. Le défaut '' n'a plus lieu d'être (il violerait la contrainte) : toute
--    insertion doit désormais fournir explicitement un payment_intent valide.
alter table public.partner_commissions
  alter column stripe_payment_intent_id drop default;

commit;

-- Vérification (facultatif) — doit refuser l'insertion :
-- insert into public.partner_commissions
--   (partner_id, stripe_invoice_id, stripe_payment_intent_id, gross_amount,
--    eligible_amount, commission_type, commission_amount)
-- values (gen_random_uuid(), 'in_test', '', 0, 0, 'percent', 0);
--   → ERROR: new row violates check constraint "partner_commissions_pi_required"
