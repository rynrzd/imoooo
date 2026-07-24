-- =============================================================
-- Nireo — montant EXACT de réduction par utilisation de code promo.
-- Stripe expose `total_details.amount_discount` sur la session Checkout :
-- on le stocke pour des statistiques fiables (jamais estimées).
-- Idempotent.
-- =============================================================

begin;

alter table public.promo_code_redemptions
  add column if not exists discount_cents integer;

commit;
