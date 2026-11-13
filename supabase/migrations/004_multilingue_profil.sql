-- =====================================================================
--  Yachad Ezer — migration 004 : site multilingue et profil des intercesseurs
--
--  À exécuter UNE FOIS dans Supabase > SQL Editor, APRÈS 002 et 003.
--  Elle peut être relancée sans danger (idempotente).
--
--  Ce qu'elle ajoute :
--   A. 10 langues pour les demandes et les témoignages
--   B. Le profil de l'intercesseur : langues parlées, pays, fuseau horaire
--   C. Ses disponibilités pour prier (jour + heure de début / de fin)
--   D. La répartition tient compte de la langue et des disponibilités
--   E. Droit d'accès et de portabilité (RGPD art. 15 et 20, Loi 25) :
--      chacun peut télécharger ses données
--
--  Ce qu'on NE demande PAS (minimisation) : la profession, l'âge exact,
--  l'adresse, le téléphone de l'intercesseur. On n'en a pas besoin pour prier.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Les langues du site
--    Une seule liste, utilisée partout : si on ajoute une langue un jour,
--    on la change ici (et dans js/i18n.js).
-- ---------------------------------------------------------------------
create or replace function private.site_langs()
returns text[] language sql immutable set search_path = '' as $$
  select array['fr','en','es','pt','sw','ht','de','ru','zh','ko']::text[];
$$;

alter table public.prayer_requests drop constraint if exists prayer_requests_lang_check;
alter table public.prayer_requests add constraint prayer_requests_lang_check
  check (lang = any (array['fr','en','es','pt','sw','ht','de','ru','zh','ko']));

alter table public.testimonies drop constraint if exists testimonies_lang_check;
alter table public.testimonies add constraint testimonies_lang_check
  check (lang = any (array['fr','en','es','pt','sw','ht','de','ru','zh','ko']));

-- Le témoignage garde la langue choisie (avant : seulement fr / en)
create or replace function private.add_testimony(p_token text, p_body text, p_name text, p_lang text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request uuid;
  v_id      uuid;
begin
  select id into v_request from public.prayer_requests where follow_hash = private.token_hash(p_token);
  if v_request is null then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;
  if (select count(*) from public.testimonies where request_id = v_request) >= 3 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  perform private.check_rate('temoignage', 3, 30);
  insert into public.testimonies (request_id, body, display_name, lang)
  values (v_request, trim(p_body), left(trim(coalesce(p_name, '')), 40),
          case when p_lang = any (private.site_langs()) then p_lang else 'fr' end)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- B. Profil : langues parlées, pays, fuseau horaire
--    · languages : codes ISO 639 (« fr », « es », « ln »…), 1 à 8
--    · country   : code ISO 3166 à 2 lettres (« CA », « HT »…), ou vide
--    · timezone  : nom IANA (« America/Toronto »), pour lire les disponibilités
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists languages text[] not null default array['fr'];
alter table public.profiles add column if not exists country   text   not null default '';
alter table public.profiles add column if not exists timezone  text   not null default 'America/Toronto';

do $$ begin
  alter table public.profiles add constraint profiles_languages_check check (
    cardinality(languages) between 1 and 8
    and array_to_string(languages, ',') ~ '^[a-z]{2,3}(,[a-z]{2,3})*$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_country_check check (country ~ '^([A-Z]{2})?$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_timezone_check check (char_length(timezone) between 1 and 64);
exception when duplicate_object then null; end $$;

-- Le fuseau doit être un vrai fuseau connu de Postgres (sinon les calculs d'heures planteraient)
create or replace function private.valid_timezone(p_tz text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz);
$$;

create or replace function private.check_profile_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- On nettoie : sans doublons, en gardant l'ordre donné (la première langue = la principale)
  new.languages := array(select l from unnest(new.languages) with ordinality u(l, n)
                         group by l order by min(n));
  if not private.valid_timezone(new.timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_fields on public.profiles;
create trigger profiles_check_fields
before insert or update of languages, timezone on public.profiles
for each row execute function private.check_profile_fields();

-- À l'inscription : on lit aussi langues, pays et fuseau (et on les nettoie).
-- Des métadonnées mal formées ne bloquent jamais l'inscription : on prend une valeur sûre.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_langs  text[];
  v_cc     text  := upper(coalesce(m ->> 'country', ''));
  v_tz     text  := coalesce(m ->> 'timezone', '');
begin
  if jsonb_typeof(m -> 'languages') = 'array' then
    select coalesce(array_agg(x order by n), '{}') into v_langs
    from (select lower(e) as x, min(n) as n
          from jsonb_array_elements_text(m -> 'languages') with ordinality j(e, n)
          where lower(e) ~ '^[a-z]{2,3}$'
          group by lower(e) order by min(n) limit 8) s;
  end if;
  if v_langs is null or cardinality(v_langs) = 0 then v_langs := array['fr']; end if;
  if v_cc !~ '^[A-Z]{2}$' then v_cc := ''; end if;
  if not private.valid_timezone(v_tz) then v_tz := 'America/Toronto'; end if;

  insert into public.profiles (id, display_name, church, motivation, engagement_at, languages, country, timezone)
  values (
    new.id,
    left(coalesce(m ->> 'display_name', ''), 80),
    left(coalesce(m ->> 'church', ''), 120),
    left(coalesce(m ->> 'motivation', ''), 1000),
    case when (m ->> 'engagement') = 'true' then now() end,
    v_langs, v_cc, v_tz
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- C. Disponibilités pour prier
--    Une ligne = un créneau qui revient chaque semaine, dans le fuseau
--    horaire de l'intercesseur. weekday : 1 = lundi … 7 = dimanche (norme ISO).
--    Heures en minutes depuis minuit : 6 h 30 = 390.
-- ---------------------------------------------------------------------
create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.profiles (id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),
  start_min  smallint not null check (start_min between 0 and 1439),
  end_min    smallint not null check (end_min between 1 and 1440),
  created_at timestamptz not null default now(),
  check (end_min > start_min),
  unique (member_id, weekday, start_min)
);
create index if not exists availability_member_idx on public.availability (member_id);

-- Au plus 28 créneaux par personne (4 par jour) : évite qu'un compte remplisse la base
create or replace function private.limit_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.availability where member_id = new.member_id) >= 28 then
    raise exception 'too_many_slots' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists availability_limit on public.availability;
create trigger availability_limit before insert on public.availability
for each row execute function private.limit_availability();

alter table public.availability enable row level security;
revoke all on public.availability from anon, authenticated;
grant select, insert, update, delete on public.availability to authenticated;
grant select, insert, update, delete on public.availability to service_role;

drop policy if exists "disponibilité : je vois les miennes, l'admin voit tout" on public.availability;
create policy "disponibilité : je vois les miennes, l'admin voit tout" on public.availability
  for select to authenticated
  using (member_id = (select auth.uid()) or private.is_admin());
drop policy if exists "disponibilité : j'ajoute les miennes" on public.availability;
create policy "disponibilité : j'ajoute les miennes" on public.availability
  for insert to authenticated
  with check (member_id = (select auth.uid()));
drop policy if exists "disponibilité : je modifie les miennes" on public.availability;
create policy "disponibilité : je modifie les miennes" on public.availability
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));
drop policy if exists "disponibilité : je supprime les miennes, l'admin aussi" on public.availability;
create policy "disponibilité : je supprime les miennes, l'admin aussi" on public.availability
  for delete to authenticated
  using (member_id = (select auth.uid()) or private.is_admin());

-- ---------------------------------------------------------------------
-- D. L'ALGORITHME DE RÉPARTITION, version 2
--    On choisit, dans l'ordre :
--      1. ceux qui parlent la langue de la demande
--      2. ceux qui ont le MOINS de demandes en cours (équité)
--      3. ceux qui sont disponibles aujourd'hui ou demain (dans LEUR fuseau)
--      4. au hasard, en cas d'égalité
--    Si personne ne parle la langue, la demande est quand même confiée :
--    l'intercesseur a un bouton « Traduire » dans son portail.
-- ---------------------------------------------------------------------
create or replace function private.assign_request(p_request_id uuid, p_count int default 2)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_missing int;
  v_added   int;
  v_lang    text;
begin
  select lang into v_lang from public.prayer_requests where id = p_request_id;

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
  cross join lateral (
    select exists (
      select 1 from public.availability av
      where av.member_id = p.id
        and av.weekday in (extract(isodow from now() at time zone p.timezone)::int,
                           extract(isodow from (now() + interval '1 day') at time zone p.timezone)::int)
    ) as soon
  ) avail
  where p.active
    and p.role in ('intercesseur', 'admin')
    and not exists (
      select 1 from public.assignments x
      where x.request_id = p_request_id and x.member_id = p.id
    )
  order by (v_lang = any (p.languages)) desc, load.open_count asc, avail.soon desc, random()
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
-- E. Droit d'accès et de portabilité : « télécharger mes données »
--    Le résultat est un document JSON lisible, que la personne enregistre.
-- ---------------------------------------------------------------------

-- E1. L'intercesseur (connecté) : son profil, ses créneaux, ses demandes
--     (code seulement : il n'a jamais vu d'identité), ses observations.
create or replace function private.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at)
                from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = v_uid),
    'availability', coalesce((select jsonb_agg(jsonb_build_object(
                        'weekday', a.weekday, 'start_min', a.start_min, 'end_min', a.end_min)
                        order by a.weekday, a.start_min)
                      from public.availability a where a.member_id = v_uid), '[]'),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object(
                        'code', r.code, 'assigned_at', s.assigned_at, 'prayed_at', s.prayed_at)
                        order by s.assigned_at)
                      from public.assignments s join public.prayer_requests r on r.id = s.request_id
                      where s.member_id = v_uid), '[]'),
    'observations', coalesce((select jsonb_agg(jsonb_build_object(
                        'code', r.code, 'body', o.body, 'status', o.status, 'created_at', o.created_at)
                        order by o.created_at)
                      from public.observations o join public.prayer_requests r on r.id = o.request_id
                      where o.member_id = v_uid), '[]')
  );
end;
$$;

create or replace function public.export_my_data()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.export_my_data();
$$;

-- E2. La personne qui a demandé la prière, avec son lien de suivi :
--     sa demande, ce qu'elle a donné (prénom, coordonnées) et ses témoignages.
--     Jamais le nom des intercesseurs ni leurs observations.
create or replace function private.request_export(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.prayer_requests;
begin
  select * into r from public.prayer_requests where follow_hash = private.token_hash(p_token);
  if r.id is null then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'request', jsonb_build_object(
       'code', r.code, 'body', r.body, 'needs', r.needs, 'lang', r.lang,
       'wants_contact', r.wants_contact, 'status', r.status,
       'created_at', r.created_at, 'consent_at', r.consent_at, 'expires_at', r.expires_at),
    'identity', (select jsonb_build_object(
       'first_name', p.first_name, 'contact_method', p.contact_method,
       'contact_value', p.contact_value, 'contact_consent_at', p.contact_consent_at)
       from public.request_private p where p.request_id = r.id),
    'prayed_count', (select count(*) from public.assignments a where a.request_id = r.id and a.prayed_at is not null),
    'testimonies', coalesce((select jsonb_agg(jsonb_build_object(
       'body', t.body, 'display_name', t.display_name, 'status', t.status, 'created_at', t.created_at))
       from public.testimonies t where t.request_id = r.id), '[]')
  );
end;
$$;

create or replace function public.request_export(p_token text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.request_export(p_token);
$$;

-- ---------------------------------------------------------------------
-- Droits d'exécution des nouvelles fonctions
-- ---------------------------------------------------------------------
revoke execute on function private.site_langs(), private.valid_timezone(text),
  private.check_profile_fields(), private.limit_availability(),
  private.export_my_data(), private.request_export(text),
  private.assign_request(uuid, int), private.handle_new_user(),
  private.add_testimony(text, text, text, text)
  from public, anon, authenticated;
grant execute on function private.site_langs()                          to anon, authenticated;
grant execute on function private.valid_timezone(text)                  to authenticated;
grant execute on function private.export_my_data()                      to authenticated;
grant execute on function private.request_export(text)                  to anon, authenticated;
grant execute on function private.add_testimony(text, text, text, text) to anon, authenticated;

revoke execute on function public.export_my_data(), public.request_export(text) from public;
grant execute on function public.export_my_data()      to authenticated;
grant execute on function public.request_export(text)  to anon, authenticated;
