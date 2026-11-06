-- =====================================================================
--  Simulation minimale de Supabase pour tester la base en local / en CI.
--  Elle crée seulement ce dont notre schéma a besoin :
--   · les rôles anon (visiteur) et authenticated (connecté)
--   · le schéma auth avec la table users et la fonction auth.uid()
--  NE PAS exécuter dans le vrai Supabase.
-- =====================================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  -- Le rôle des fonctions serveur : il contourne la RLS, mais a besoin des droits sur les tables
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Comme dans Supabase : l'identité vient du jeton (ici, d'un réglage de session)
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
