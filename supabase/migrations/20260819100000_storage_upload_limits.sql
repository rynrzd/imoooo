-- =============================================================
-- Nireo — Limites d'envoi de fichiers APPLIQUÉES PAR LE SERVEUR
--
-- Faille corrigée : les cinq buckets privés de Nireo Immo ont été créés
-- sans `file_size_limit` ni `allowed_mime_types` (migrations 20260714120000
-- et 20260715150000). Or les envois partent DIRECTEMENT du navigateur vers
-- Supabase Storage (`src/lib/store.tsx` est un composant client) : les deux
-- seuls contrôles existants — 20 Mo et liste d'extensions dans
-- `uploadPrivateFile` — vivaient donc ENTIÈREMENT côté client.
--
-- Conséquence : un utilisateur authentifié pouvait, en appelant l'API
-- Storage à la main avec sa propre session, déposer dans son dossier un
-- fichier de taille arbitraire (saturation du quota et de la facture) ou de
-- type arbitraire (.exe, .html, .svg). La RLS l'empêchait d'écrire chez un
-- autre utilisateur, mais rien ne bornait ce qu'il écrivait chez lui.
--
-- Correctif : la limite descend là où le navigateur ne peut plus la
-- contourner — dans la définition du bucket. Supabase Storage refuse alors
-- lui-même l'envoi (413 / 415), quel que soit le client utilisé.
--
-- Les valeurs reprennent EXACTEMENT ce que l'interface propose déjà, bucket
-- par bucket (attribut `accept` des champs de fichier) : aucun envoi
-- aujourd'hui légitime ne devient impossible.
--   • property-documents  20 Mo — PDF, JPEG, PNG, WebP, HEIC, DOCX
--   • expense-receipts    20 Mo — idem (justificatifs)
--   • maintenance-files   20 Mo — idem (pièces de chantier)
--   • property-photos     10 Mo — images seules
--   • profile-avatars      5 Mo — images seules (le champ n'accepte déjà
--                                 que image/jpeg, image/png, image/webp)
--
-- `uploadPrivateFile` déclare désormais le type MIME depuis les OCTETS RÉELS
-- du fichier (et non depuis `file.type`, que le navigateur laisse parfois
-- vide) : le type annoncé à Storage appartient donc toujours à la liste
-- ci-dessous. Sans cette précaution, un HEIC d'iPhone au type vide aurait
-- été refusé — c'est le seul cas qui aurait pu casser un envoi existant.
--
-- Idempotente et strictement additive : aucun fichier déjà stocké n'est
-- touché, ces limites ne s'appliquent qu'aux ENVOIS suivants.
-- =============================================================

begin;

-- Types acceptés partout où un document est attendu.
-- image/heif accompagne image/heic : selon l'appareil et le navigateur,
-- une photo iPhone se présente sous l'un ou l'autre nom.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'property-documents', 'property-documents', false,
    20971520, -- 20 Mo
    array[
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'expense-receipts', 'expense-receipts', false,
    20971520, -- 20 Mo
    array[
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'maintenance-files', 'maintenance-files', false,
    20971520, -- 20 Mo
    array[
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'property-photos', 'property-photos', false,
    10485760, -- 10 Mo
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  ),
  (
    'profile-avatars', 'profile-avatars', false,
    5242880, -- 5 Mo
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  )
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;

-- Vérification après application (doit renvoyer 5 lignes, toutes bornées) :
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets
--    where id in ('property-documents', 'property-photos', 'expense-receipts',
--                 'profile-avatars', 'maintenance-files');
