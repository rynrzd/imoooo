-- =============================================================
-- Nireo — Longueur maximale des champs texte (validation SERVEUR)
--
-- Pourquoi : dans Nireo Immo, l'application écrit DIRECTEMENT du navigateur
-- vers PostgREST (`src/lib/store.tsx` est un composant client). La RLS
-- décide QUI écrit et le trigger `enforce_owner_consistency` décide SUR QUOI
-- — mais rien ne décidait COMBIEN. Les colonnes texte sont déclarées `text`,
-- sans borne : un utilisateur authentifié pouvait enregistrer un nom de
-- logement de plusieurs mégaoctets en appelant l'API à la main.
--
-- Ce n'est pas une fuite de données (il n'écrit que chez lui), mais c'est un
-- vecteur d'abus réel : gonflement de la base, réponses lourdes, pages qui
-- ne s'affichent plus. Les schémas Zod des formulaires ne s'appliquaient
-- qu'au navigateur, donc pas à qui contourne le navigateur.
--
-- Correctif : la borne descend dans la base, seul point que le client ne
-- peut pas contourner.
--
-- DEUX PRÉCAUTIONS pour ne rien casser :
--  1. les valeurs sont LARGES — plusieurs fois ce qu'un formulaire propose
--     aujourd'hui. Aucune saisie normale ne s'en approche ;
--  2. les contraintes sont posées `not valid` : PostgreSQL les applique aux
--     écritures À VENIR sans relire l'existant. La migration ne peut donc
--     pas échouer sur une donnée déjà en place, quelle qu'elle soit.
--
-- `char_length` compte des CARACTÈRES, pas des octets : un texte accentué
-- n'est pas pénalisé.
--
-- Idempotente : chaque contrainte n'est ajoutée que si elle manque.
-- =============================================================

begin;

do $$
declare
  r record;
begin
  for r in
    select *
      from (values
        -- table,                        colonne,                        max
        ('profiles',              'full_name',                     120),
        ('profiles',              'phone',                          40),
        ('profiles',              'company_name',                  160),
        ('profiles',              'avatar_url',                    500),

        ('properties',            'name',                          160),
        ('properties',            'address',                       300),
        ('properties',            'postal_code',                    16),
        ('properties',            'city',                          120),
        ('properties',            'photo_url',                    1000),

        ('tenants',               'first_name',                    100),
        ('tenants',               'last_name',                     100),
        ('tenants',               'email',                         200),
        ('tenants',               'phone',                          40),

        ('rent_payments',         'comment',                      2000),

        ('maintenance_records',   'title',                         200),
        ('maintenance_records',   'company',                       160),

        ('documents',             'name',                          300),
        ('documents',             'file_path',                     500),
        ('documents',             'file_type',                      40),

        ('expenses',              'label',                         200),
        ('expenses',              'receipt_path',                  500),

        ('property_photos',       'file_path',                    1000),
        ('property_photos',       'caption',                       500),

        ('notifications',         'title',                         300),
        ('notifications',         'description',                  2000),
        ('notifications',         'href',                          500),
        ('notifications',         'dedupe_key',                    200),

        ('notification_preferences', 'rent_reminder_custom_message', 2000)
      ) as t(table_name, column_name, max_length)
  loop
    -- La colonne peut ne pas exister si une migration antérieure n'a pas
    -- encore été appliquée : on passe sans bruit plutôt que d'échouer.
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = r.table_name
         and column_name = r.column_name
    ) then
      continue;
    end if;

    if not exists (
      select 1 from pg_constraint
       where conname = r.table_name || '_' || r.column_name || '_len'
         and conrelid = ('public.' || r.table_name)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (%I is null or char_length(%I) <= %s) not valid',
        r.table_name,
        r.table_name || '_' || r.column_name || '_len',
        r.column_name,
        r.column_name,
        r.max_length
      );
    end if;
  end loop;
end;
$$;

commit;

-- Vérification après application (doit lister les contraintes ajoutées) :
--   select conrelid::regclass as table, conname, convalidated
--     from pg_constraint
--    where conname like '%\_len'
--    order by 1, 2;
