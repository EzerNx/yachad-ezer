-- =====================================================================
--  Yachad Ezer — schéma de la base de données (Supabase / Postgres)
--  À coller en entier dans : Supabase > SQL Editor > New query > Run
--
--  Idée générale :
--   * L'identité de la personne qui prie (prénom, courriel, téléphone)
--     est rangée À PART (table request_private). Seul l'admin la voit.
--   * Les intercesseurs voient seulement le texte de la demande et
--     son CODE (ex. YE-7KQ3). C'est la « pseudonymisation » de la Loi 25.
--   * La sécurité est faite ICI, dans la base (RLS = Row Level Security),
--     pas dans le JavaScript : le navigateur peut toujours être trafiqué.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Schéma privé : il n'est PAS exposé par l'API Supabase.
--    On y range les fonctions « à privilèges » (security definer).
-- ---------------------------------------------------------------------
create schema if not exists private;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- Profils des membres de l'équipe (créés automatiquement à l'inscription)
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 80),
  church        text not null default '' check (char_length(church) <= 120),
  motivation    text not null default '' check (char_length(motivation) <= 1000),
  role          text not null default 'candidat'
                check (role in ('candidat', 'intercesseur', 'admin', 'refuse')),
  active        boolean not null default false,
  engagement_at timestamptz,                       -- date d'acceptation de l'engagement de confidentialité
  created_at    timestamptz not null default now(),
  approved_at   timestamptz
);

-- Demandes de prière : AUCUNE donnée qui identifie la personne ici
create table public.prayer_requests (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,              -- généré par trigger, ex. YE-7KQ3
  body          text not null check (char_length(body) between 5 and 1500),
  needs         text[] not null default array['priere']
                check (needs <@ array['priere','suivi','conseil','orientation']::text[]),
  wants_contact boolean not null default false,
  status        text not null default 'nouvelle'
                check (status in ('nouvelle', 'assignee', 'fermee')),
  consent_at    timestamptz not null default now(),
  age_confirmed boolean not null check (age_confirmed),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '6 months'
);

-- Identité et coordonnées : visibles par l'admin SEULEMENT
create table public.request_private (
  request_id         uuid primary key references public.prayer_requests (id) on delete cascade,
  first_name         text not null default '' check (char_length(first_name) <= 80),
  contact_method     text check (contact_method in ('courriel', 'telephone')),
  contact_value      text check (char_length(contact_value) <= 120),
  contact_consent_at timestamptz,
  created_at         timestamptz not null default now(),
  check ((contact_method is null) = (contact_value is null)),
  check (contact_method is null or contact_consent_at is not null)
);

-- Qui prie pour quelle demande
create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.prayer_requests (id) on delete cascade,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  prayed_at   timestamptz,
  unique (request_id, member_id)
);
create index assignments_member_idx on public.assignments (member_id);

-- Observations écrites par les intercesseurs, lues par l'admin
create table public.observations (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.prayer_requests (id) on delete cascade,
  member_id      uuid not null references public.profiles (id) on delete cascade,
  body           text not null check (char_length(body) between 2 and 2000),
  status         text not null default 'nouvelle' check (status in ('nouvelle', 'lue', 'transmise')),
  created_at     timestamptz not null default now(),
  transmitted_at timestamptz
);
create index observations_request_idx on public.observations (request_id);
create index observations_member_idx  on public.observations (member_id);
create index prayer_requests_status_idx  on public.prayer_requests (status);
create index prayer_requests_expires_idx on public.prayer_requests (expires_at);

-- Réglages (une seule ligne)
create table public.app_settings (
  id          int primary key default 1 check (id = 1),
  auto_assign boolean not null default true,       -- répartir dès qu'une demande arrive
  per_request int not null default 2 check (per_request between 1 and 10)
);
insert into public.app_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. Fonctions d'aide (schéma privé)
-- ---------------------------------------------------------------------

-- Est-ce que la personne connectée est l'admin ?
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and active
  );
$$;

-- Est-ce un intercesseur actif (ou l'admin, qui prie aussi) ?
create or replace function private.is_intercessor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('intercesseur', 'admin') and active
  );
$$;

-- Cette demande est-elle confiée à la personne connectée ?
create or replace function private.is_assigned(p_request_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments
    where request_id = p_request_id and member_id = (select auth.uid())
  );
$$;

-- Peut-on attacher l'identité à cette demande ? (juste après l'envoi, une seule fois)
create or replace function private.can_attach_private(p_request_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.prayer_requests r
    where r.id = p_request_id
      and r.created_at > now() - interval '15 minutes'
      and not exists (select 1 from public.request_private p where p.request_id = r.id)
  );
$$;

-- L'ALGORITHME DE RÉPARTITION
-- Donne la demande aux intercesseurs actifs qui ont le MOINS de demandes
-- en cours (pas encore priées). En cas d'égalité : au hasard.
-- Retourne le nombre d'intercesseurs ajoutés.
create or replace function private.assign_request(p_request_id uuid, p_count int default 2)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_missing int;
  v_added   int;
begin
  select greatest(p_count - count(*), 0) into v_missing
  from public.assignments where request_id = p_request_id;

  insert into public.assignments (request_id, member_id)
  select p_request_id, p.id
  from public.profiles p
  cross join lateral (
    select count(*) as open_count
    from public.assignments a
    join public.prayer_requests r on r.id = a.request_id
    where a.member_id = p.id and a.prayed_at is null and r.status <> 'fermee'
  ) load
  where p.active
    and p.role in ('intercesseur', 'admin')
    and not exists (
      select 1 from public.assignments x
      where x.request_id = p_request_id and x.member_id = p.id
    )
  order by load.open_count asc, random()
  limit v_missing
  on conflict do nothing;

  get diagnostics v_added = row_count;

  update public.prayer_requests
  set status = 'assignee'
  where id = p_request_id and status = 'nouvelle'
    and exists (select 1 from public.assignments where request_id = p_request_id);

  return v_added;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Triggers (actions automatiques)
-- ---------------------------------------------------------------------

-- Avant d'enregistrer une demande : on impose le code, le statut et les dates.
-- Le navigateur ne peut donc pas tricher sur ces valeurs.
create or replace function private.prepare_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- sans 0/O ni 1/I/L
  v_code     text;
begin
  loop
    v_code := 'YE-';
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.prayer_requests where code = v_code);
  end loop;

  new.code       := v_code;
  new.status     := 'nouvelle';
  new.created_at := now();
  new.consent_at := now();
  new.expires_at := now() + interval '6 months';
  return new;
end;
$$;

create trigger prayer_requests_prepare
before insert on public.prayer_requests
for each row execute function private.prepare_request();

-- Après l'enregistrement : répartition automatique si elle est activée
create or replace function private.on_request_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.app_settings;
begin
  select * into s from public.app_settings where id = 1;
  if s.auto_assign then
    perform private.assign_request(new.id, s.per_request);
  end if;
  return null;
end;
$$;

create trigger prayer_requests_auto_assign
after insert on public.prayer_requests
for each row execute function private.on_request_created();

-- À l'inscription d'un intercesseur : création de son profil (rôle « candidat »)
-- Les métadonnées servent seulement à l'affichage, JAMAIS aux permissions.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, church, motivation, engagement_at)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80),
    left(coalesce(new.raw_user_meta_data ->> 'church', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'motivation', ''), 1000),
    case when (new.raw_user_meta_data ->> 'engagement') = 'true' then now() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Garde : seul l'admin peut changer le rôle ou l'activation d'un profil
create or replace function private.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_admin()
     and (new.role is distinct from old.role
          or new.active is distinct from old.active
          or new.approved_at is distinct from old.approved_at
          or new.engagement_at is distinct from old.engagement_at) then
    raise exception 'Seul l''administrateur peut modifier ce champ' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
before update on public.profiles
for each row execute function private.guard_profile_update();

-- Garde : un intercesseur peut seulement cocher « priée », rien d'autre
create or replace function private.guard_assignment_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_admin()
     and (new.request_id is distinct from old.request_id
          or new.member_id is distinct from old.member_id
          or new.assigned_at is distinct from old.assigned_at) then
    raise exception 'Modification non permise' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger assignments_guard
before update on public.assignments
for each row execute function private.guard_assignment_update();

-- ---------------------------------------------------------------------
-- 4. Fonction appelable par l'admin depuis le site (bouton « Répartir »)
--    SECURITY INVOKER : elle tourne avec les droits de la personne connectée.
-- ---------------------------------------------------------------------
create or replace function public.distribute_new_requests(p_per_request int default null)
returns int language plpgsql security invoker set search_path = '' as $$
declare
  v_n     int;
  v_total int := 0;
  r       record;
begin
  if not private.is_admin() then
    raise exception 'Réservé à l''administrateur' using errcode = '42501';
  end if;
  v_n := coalesce(p_per_request, (select per_request from public.app_settings where id = 1), 2);
  for r in select id from public.prayer_requests where status = 'nouvelle' order by created_at loop
    v_total := v_total + private.assign_request(r.id, v_n);
  end loop;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Droits d'accès (GRANT) : qui a le droit de toucher quelle table.
--    Depuis 2026, Supabase n'expose plus les nouvelles tables tout seul.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.distribute_new_requests(int) from public, anon;

grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin()                to anon, authenticated;
grant execute on function private.is_intercessor()          to anon, authenticated;
grant execute on function private.is_assigned(uuid)         to anon, authenticated;
grant execute on function private.can_attach_private(uuid)  to anon, authenticated;
grant execute on function private.assign_request(uuid, int) to authenticated;  -- appelée par distribute_new_requests
grant execute on function public.distribute_new_requests(int) to authenticated;

-- Les visiteurs anonymes peuvent SEULEMENT ajouter une demande (ni lire, ni modifier)
grant insert on public.prayer_requests, public.request_private to anon, authenticated;
grant select, update, delete on public.prayer_requests, public.request_private to authenticated;
grant select, insert, update, delete on public.assignments, public.observations to authenticated;
grant select, update on public.profiles, public.app_settings to authenticated;

-- ---------------------------------------------------------------------
-- 6. RLS : quelles LIGNES chacun peut voir ou modifier
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.request_private enable row level security;
alter table public.assignments     enable row level security;
alter table public.observations    enable row level security;
alter table public.app_settings    enable row level security;

-- profiles
create policy "profil : je vois le mien, l'admin voit tout" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());
create policy "profil : je modifie le mien, l'admin modifie tout" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

-- prayer_requests
create policy "demande : tout le monde peut en envoyer une" on public.prayer_requests
  for insert to anon, authenticated
  with check (status = 'nouvelle');
create policy "demande : l'admin voit tout, l'intercesseur voit les siennes" on public.prayer_requests
  for select to authenticated
  using (private.is_admin() or (private.is_intercessor() and private.is_assigned(id)));
create policy "demande : l'admin modifie" on public.prayer_requests
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "demande : l'admin supprime" on public.prayer_requests
  for delete to authenticated
  using (private.is_admin());

-- request_private (identité) : admin seulement, sauf l'ajout juste après l'envoi
create policy "identité : ajout juste après l'envoi" on public.request_private
  for insert to anon, authenticated
  with check (private.can_attach_private(request_id));
create policy "identité : l'admin seulement" on public.request_private
  for select to authenticated
  using (private.is_admin());
create policy "identité : l'admin modifie" on public.request_private
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "identité : l'admin supprime" on public.request_private
  for delete to authenticated
  using (private.is_admin());

-- assignments
create policy "attribution : je vois les miennes, l'admin voit tout" on public.assignments
  for select to authenticated
  using (member_id = (select auth.uid()) or private.is_admin());
create policy "attribution : l'admin attribue" on public.assignments
  for insert to authenticated
  with check (private.is_admin());
create policy "attribution : je coche « priée » sur les miennes" on public.assignments
  for update to authenticated
  using (member_id = (select auth.uid()) or private.is_admin())
  with check (member_id = (select auth.uid()) or private.is_admin());
create policy "attribution : l'admin retire" on public.assignments
  for delete to authenticated
  using (private.is_admin());

-- observations
create policy "observation : j'écris sur une demande qui m'est confiée" on public.observations
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and status = 'nouvelle'
    and private.is_intercessor()
    and private.is_assigned(request_id)
  );
create policy "observation : je vois les miennes, l'admin voit tout" on public.observations
  for select to authenticated
  using (member_id = (select auth.uid()) or private.is_admin());
create policy "observation : l'admin change le statut" on public.observations
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "observation : l'admin supprime" on public.observations
  for delete to authenticated
  using (private.is_admin());

-- app_settings
create policy "réglages : l'admin" on public.app_settings
  for select to authenticated using (private.is_admin());
create policy "réglages : l'admin modifie" on public.app_settings
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------
-- 7. Loi 25 : suppression automatique après 6 mois (chaque nuit à 3 h UTC)
--    Si cette partie échoue, active d'abord « Cron » dans
--    Supabase > Integrations, puis relance seulement ces lignes.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'purge-demandes-expirees',
  '0 3 * * *',
  $$ delete from public.prayer_requests where expires_at < now(); $$
);

-- ---------------------------------------------------------------------
-- 8. APRÈS t'être inscrit sur la page « Devenir intercesseur »,
--    exécute cette ligne (avec TON courriel) pour devenir admin :
--
-- update public.profiles set role = 'admin', active = true, approved_at = now()
-- where id = (select id from auth.users where email = 'ton.courriel@exemple.com');
-- ---------------------------------------------------------------------
