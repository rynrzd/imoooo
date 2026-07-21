-- =============================================================
-- Abonnements — source de vérité UNIQUE : la table `subscriptions`
-- =============================================================
-- Correctif : jusqu'ici les quotas serveur (plan_of_owner) lisaient
-- `profiles.plan`, un cache secondaire pouvant diverger de l'abonnement réel
-- (ex. Fondateur activé mais profil non resynchronisé → ancien plan encore
-- appliqué). Désormais le plan EFFECTIF est dérivé de `subscriptions`, comme
-- côté application (resolvePlan) : Fondateur à vie > abonnement actif > Gratuit.
--
-- Idempotent. Aucune donnée supprimée. Ne modifie aucune migration existante.
-- `subscriptions.user_id` est déjà UNIQUE : un seul abonnement par utilisateur.

begin;

-- Plan effectif d'un utilisateur, calculé depuis la table `subscriptions`.
-- Miroir exact de resolvePlan (statuts actifs : active, trialing, past_due).
create or replace function public.plan_of_owner(p_owner uuid)
returns text
language sql
stable security definer set search_path = ''
as $$
  select coalesce(
    (
      select case
        when s.lifetime_access then s.plan
        when s.status in ('active', 'trialing', 'past_due') then s.plan
        else 'free'
      end
      from public.subscriptions s
      where s.user_id = p_owner
    ),
    'free'
  )
$$;

-- Resynchronise le cache `profiles.plan` sur le plan effectif, afin de lever
-- toute incohérence historique (profil et abonnement contradictoires).
-- profiles.plan n'est plus une autorité, mais reste cohérent pour l'affichage.
update public.profiles p
set plan = public.plan_of_owner(p.id)
where p.plan is distinct from public.plan_of_owner(p.id);

commit;
