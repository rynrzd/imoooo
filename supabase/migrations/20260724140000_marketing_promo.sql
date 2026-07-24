-- =============================================================
-- Nireo — bloc marketing éditable depuis l'admin (P6).
-- Clé site_settings `marketing_promo` (titre/sous-titre/message/code),
-- exposée aux pages publiques via public_site_settings(). Idempotent.
-- =============================================================

begin;

insert into public.site_settings (key, value) values
  (
    'marketing_promo',
    '{"enabled":false,"title":"","subtitle":"","message":"","code":""}'::jsonb
  )
on conflict (key) do nothing;

-- Ajout de marketing_promo aux clés d'affichage publiques (les autres clés
-- restent serveur uniquement).
create or replace function public.public_site_settings()
returns jsonb
language sql
stable security definer set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
  from public.site_settings s
  where s.key in (
    'announcement_message', 'maintenance_mode', 'support_email', 'marketing_promo'
  );
$$;

grant execute on function public.public_site_settings() to anon, authenticated;

commit;
