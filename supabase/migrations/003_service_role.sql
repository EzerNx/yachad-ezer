-- =====================================================================
--  Yachad Ezer — migration 003 : droits du rôle de service
--
--  Pourquoi : le projet a été créé avec « Automatically expose new tables »
--  décoché (plus sûr). Supabase ne donne alors AUCUN droit automatique sur
--  les nouvelles tables, même au rôle « service_role » utilisé par les
--  fonctions de courriel (send-reply, notify). Elles recevaient un refus.
--
--  Le rôle de service ne sert QUE côté serveur (fonctions Edge). Sa clé
--  n'est jamais dans le site. Il contourne déjà les règles RLS par nature :
--  on lui donne simplement l'accès aux tables.
--
--  À exécuter une fois dans Supabase > SQL Editor. Peut être relancée.
-- =====================================================================
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

-- Pour les tables créées plus tard
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
