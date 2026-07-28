-- =============================================================
-- Nireo — « Présentation de l'entreprise » (vitrine officielle).
--
-- Contenu 100 % éditable depuis l'admin, stocké en une seule clé JSONB
-- `company_profile` dans site_settings (structure évolutive : on pourra
-- ajouter emplois, investisseurs, presse… sans nouvelle migration).
--
-- Les valeurs par défaut RICHES vivent côté TypeScript (lib/admin/company.ts)
-- et sont fusionnées à la lecture : ici on se contente de créer la clé et la
-- fonction de lecture publique. Idempotent.
-- =============================================================

begin;

-- La clé existe et la vitrine est publiée par défaut ; tout le reste est
-- fourni par les défauts applicatifs jusqu'à la première sauvegarde admin.
insert into public.site_settings (key, value) values
  ('company_profile', '{"published": true}'::jsonb)
on conflict (key) do nothing;

-- Lecture publique de la vitrine — aucun secret, utilisable par la page
-- publique /entreprise (client anonyme, pages statiques revalidées).
create or replace function public.public_company_profile()
returns jsonb
language sql
stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.value from public.site_settings s where s.key = 'company_profile'),
    '{}'::jsonb
  );
$$;

grant execute on function public.public_company_profile() to anon, authenticated;

commit;
