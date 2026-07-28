-- =============================================================
-- Nireo — Bucket PUBLIC « site-media » pour la vidéo de présentation
-- de la vitrine (et futurs médias marketing).
--
-- Lecture : publique (bucket public = true) → la balise <video> de /a-propos
--           lit directement l'URL publique, sans lien externe.
-- Écriture : réservée au service-role. Aucune policy anon/authenticated n'est
--           créée → défaut « deny ». Les envois passent par une URL SIGNÉE
--           générée côté serveur admin (jeton à usage unique, borné à un
--           chemin), donc la clé secrète ne quitte jamais le serveur.
--
-- Le code applicatif crée aussi ce bucket à la volée (ensureMediaBucket),
-- cette migration le rend explicite/versionné. 100 % idempotente.
-- =============================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  209715200, -- 200 Mo
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;
