-- =====================================================================
--  Yachad Ezer — migration 002 : améliorations (novembre 2026)
--
--  À exécuter UNE FOIS dans Supabase > SQL Editor, APRÈS schema.sql.
--  Elle peut être relancée sans danger (idempotente).
--
--  Ce qu'elle ajoute :
--   A. La langue de chaque demande (fr / en)
--   B. Un lien de suivi privé pour la personne qui prie
--      (voir combien ont prié, supprimer sa demande : droit de la Loi 25)
--   C. Les témoignages (prières exaucées), publiés après validation
--   D. Un anti-spam : limite d'envois par heure
--   E. Une fonction « keepalive » pour que le projet gratuit ne s'endorme pas
--   F. La suppression de compte (admin, ou soi-même)
--   G. Le nettoyage automatique (Loi 25 : ne rien garder plus que nécessaire)
--   H. Sécurité : la répartition passe par une fonction qui vérifie l'admin
--   I. Préférence de notification des intercesseurs
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Langue de la demande
-- ---------------------------------------------------------------------
alter table public.prayer_requests add column if not exists lang text not null default 'fr';
do $$ begin
  alter table public.prayer_requests add constraint prayer_requests_lang_check check (lang in ('fr', 'en'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- B. Lien de suivi privé
--    Le navigateur crée un code secret long et aléatoire (le « jeton »).
--    La base ne garde que son empreinte SHA-256 : même avec la base,
--    on ne peut pas retrouver le lien.
-- ---------------------------------------------------------------------
alter table public.prayer_requests add column if not exists follow_hash text;
do $$ begin
  alter table public.prayer_requests add constraint prayer_requests_follow_hash_check
    check (follow_hash is null or follow_hash ~ '^[0-9a-f]{64}$');
exception when duplicate_object then null; end $$;
create unique index if not exists prayer_requests_follow_hash_idx
  on public.prayer_requests (follow_hash) where follow_hash is not null;

create or replace function private.token_hash(p_token text)
returns text language sql immutable set search_path = '' as $$
  select case when p_token is not null and char_length(p_token) between 20 and 200
              then encode(sha256(convert_to(p_token, 'UTF8')), 'hex') end;
$$;

-- Ce que la personne voit avec son lien (jamais le texte, jamais les noms)
create or replace function private.request_status(p_token text)
returns table (code text, created_at timestamptz, expires_at timestamptz, status text,
               prayed_count int, intercessor_count int, wants_contact boolean, reply_sent boolean, lang text)
language sql stable security definer set search_path = '' as $$
  select r.code, r.created_at, r.expires_at, r.status,
         (select count(*)::int from public.assignments a where a.request_id = r.id and a.prayed_at is not null),
         (select count(*)::int from public.assignments a where a.request_id = r.id),
         r.wants_contact,
         exists (select 1 from public.observations o where o.request_id = r.id and o.status = 'transmise'),
         r.lang
  from public.prayer_requests r
  where r.follow_hash = private.token_hash(p_token);
$$;

create or replace function public.request_status(p_token text)
returns table (code text, created_at timestamptz, expires_at timestamptz, status text,
               prayed_count int, intercessor_count int, wants_contact boolean, reply_sent boolean, lang text)
language sql stable security invoker set search_path = '' as $$
  select * from private.request_status(p_token);
$$;

-- Droit à l'effacement : la personne supprime sa demande avec son lien
create or replace function private.delete_request_by_token(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.prayer_requests where follow_hash = private.token_hash(p_token);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.delete_my_request(p_token text)
returns boolean language sql volatile security invoker set search_path = '' as $$
  select private.delete_request_by_token(p_token);
$$;

-- ---------------------------------------------------------------------
-- D. Anti-spam : limite d'envois par heure
--    On ne garde PAS l'adresse IP : seulement une empreinte salée,
--    effacée après 24 heures.
-- ---------------------------------------------------------------------
create table if not exists private.secrets (
  name  text primary key,
  value text not null
);
insert into private.secrets (name, value)
values ('ip_salt', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create table if not exists private.rate_events (
  bucket text not null,
  at     timestamptz not null default now()
);
create index if not exists rate_events_bucket_at_idx on private.rate_events (bucket, at);

create or replace function private.client_fingerprint()
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  h  json;
  ip text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  ip := coalesce(h ->> 'cf-connecting-ip',
                 trim(split_part(h ->> 'x-forwarded-for', ',', 1)),
                 h ->> 'x-real-ip',
                 'inconnu');
  return encode(sha256(convert_to(ip || ':' || (select value from private.secrets where name = 'ip_salt'), 'UTF8')), 'hex');
end;
$$;

-- p_max : envois permis par personne et par heure ; p_global : pour tout le site
create or replace function private.check_rate(p_kind text, p_max int, p_global int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b text := p_kind || ':' || private.client_fingerprint();
  n int;
begin
  delete from private.rate_events where at < now() - interval '1 day';
  select count(*) into n from private.rate_events where bucket = b and at > now() - interval '1 hour';
  if n >= p_max then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Trop d''envois. Réessayez dans une heure.';
  end if;
  select count(*) into n from private.rate_events where bucket like p_kind || ':%' and at > now() - interval '1 hour';
  if n >= p_global then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Le site reçoit trop d''envois. Réessayez plus tard.';
  end if;
  insert into private.rate_events (bucket) values (b);
end;
$$;

-- On remplace la préparation d'une demande pour y ajouter l'anti-spam
create or replace function private.prepare_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- sans 0/O ni 1/I/L
  v_code     text;
begin
  perform private.check_rate('demande', 5, 120);   -- 5 par personne / heure, 120 au total / heure

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

-- ---------------------------------------------------------------------
-- C. Témoignages (prières exaucées)
-- ---------------------------------------------------------------------
create table if not exists public.testimonies (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid references public.prayer_requests (id) on delete set null,
  body               text not null check (char_length(body) between 10 and 1500),
  display_name       text not null default '' check (char_length(display_name) <= 40),
  lang               text not null default 'fr' check (lang in ('fr', 'en')),
  status             text not null default 'en_attente' check (status in ('en_attente', 'publie', 'refuse')),
  publish_consent_at timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  published_at       timestamptz
);
create index if not exists testimonies_status_idx on public.testimonies (status, published_at desc);

-- La personne envoie un témoignage avec son lien de suivi (évite le spam)
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
          case when p_lang = 'en' then 'en' else 'fr' end)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.add_testimony(p_token text, p_body text, p_name text default '', p_lang text default 'fr')
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.add_testimony(p_token, p_body, p_name, p_lang);
$$;

-- Quand l'admin publie, on note la date (le navigateur ne peut pas tricher)
create or replace function private.on_testimony_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'publie' and old.status is distinct from 'publie' then
    new.published_at := now();
  elsif new.status <> 'publie' then
    new.published_at := null;
  end if;
  new.body := old.body;                 -- le texte de la personne ne peut pas être réécrit
  new.request_id := old.request_id;
  new.created_at := old.created_at;
  new.publish_consent_at := old.publish_consent_at;
  return new;
end;
$$;
drop trigger if exists testimonies_on_update on public.testimonies;
create trigger testimonies_on_update before update on public.testimonies
for each row execute function private.on_testimony_update();

alter table public.testimonies enable row level security;
revoke all on public.testimonies from anon, authenticated;
-- Les visiteurs ne voient que les colonnes utiles à l'affichage
grant select (id, body, display_name, lang, published_at) on public.testimonies to anon;
grant select, update, delete on public.testimonies to authenticated;

drop policy if exists "témoignage : publiés visibles par tous" on public.testimonies;
create policy "témoignage : publiés visibles par tous" on public.testimonies
  for select to anon using (status = 'publie');
drop policy if exists "témoignage : publiés + admin voit tout" on public.testimonies;
create policy "témoignage : publiés + admin voit tout" on public.testimonies
  for select to authenticated using (status = 'publie' or private.is_admin());
drop policy if exists "témoignage : l'admin modère" on public.testimonies;
create policy "témoignage : l'admin modère" on public.testimonies
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "témoignage : l'admin supprime" on public.testimonies;
create policy "témoignage : l'admin supprime" on public.testimonies
  for delete to authenticated using (private.is_admin());

-- ---------------------------------------------------------------------
-- E. Maintien en vie (appelée par GitHub Actions deux fois par semaine)
-- ---------------------------------------------------------------------
create or replace function public.keepalive()
returns text language sql stable security invoker set search_path = '' as $$
  select 'ok'::text;
$$;

-- ---------------------------------------------------------------------
-- F. Suppression de compte
--    · l'admin supprime un candidat refusé ou un intercesseur qui part
--    · un intercesseur supprime son propre compte
--    Tout ce qui lui est lié (profil, attributions, observations) part aussi.
-- ---------------------------------------------------------------------
create or replace function private.delete_member(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null then
    raise exception 'Compte introuvable' using errcode = 'P0002';
  end if;
  if p_id <> (select auth.uid()) and not private.is_admin() then
    raise exception 'Réservé à l''administrateur' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = p_id and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin' and active) <= 1 then
    raise exception 'last_admin' using errcode = 'P0001', hint = 'Impossible de supprimer le dernier administrateur.';
  end if;
  delete from auth.users where id = p_id;
end;
$$;

create or replace function public.delete_member(p_id uuid)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.delete_member(p_id);
$$;

create or replace function public.delete_my_account()
returns void language sql volatile security invoker set search_path = '' as $$
  select private.delete_member((select auth.uid()));
$$;

-- ---------------------------------------------------------------------
-- H. Répartition : la vérification « admin » est faite DANS la fonction
--    à privilèges, et plus personne d'autre ne peut appeler assign_request.
-- ---------------------------------------------------------------------
create or replace function private.distribute_all(p_per_request int)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_n     int;
  v_total int := 0;
  r       record;
begin
  if not private.is_admin() then
    raise exception 'Réservé à l''administrateur' using errcode = '42501';
  end if;
  v_n := least(greatest(coalesce(p_per_request, (select per_request from public.app_settings where id = 1), 2), 1), 10);
  for r in select id from public.prayer_requests where status = 'nouvelle' order by created_at loop
    v_total := v_total + private.assign_request(r.id, v_n);
  end loop;
  return v_total;
end;
$$;

create or replace function public.distribute_new_requests(p_per_request int default null)
returns int language plpgsql security invoker set search_path = '' as $$
begin
  return private.distribute_all(p_per_request);
end;
$$;

-- ---------------------------------------------------------------------
-- I. Notifications : l'intercesseur peut les couper
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists notify boolean not null default true;

-- ---------------------------------------------------------------------
-- Droits d'exécution des fonctions
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin()               to anon, authenticated;
grant execute on function private.is_intercessor()         to anon, authenticated;
grant execute on function private.is_assigned(uuid)        to anon, authenticated;
grant execute on function private.can_attach_private(uuid) to anon, authenticated;
grant execute on function private.request_status(text)          to anon, authenticated;
grant execute on function private.delete_request_by_token(text) to anon, authenticated;
grant execute on function private.add_testimony(text, text, text, text) to anon, authenticated;
grant execute on function private.distribute_all(int)      to authenticated;
grant execute on function private.delete_member(uuid)      to authenticated;

revoke execute on function public.request_status(text), public.delete_my_request(text),
  public.add_testimony(text, text, text, text), public.keepalive(),
  public.delete_member(uuid), public.delete_my_account(), public.distribute_new_requests(int)
  from public;
grant execute on function public.request_status(text)                     to anon, authenticated;
grant execute on function public.delete_my_request(text)                  to anon, authenticated;
grant execute on function public.add_testimony(text, text, text, text)    to anon, authenticated;
grant execute on function public.keepalive()                              to anon, authenticated;
grant execute on function public.delete_member(uuid)                      to authenticated;
grant execute on function public.delete_my_account()                      to authenticated;
grant execute on function public.distribute_new_requests(int)             to authenticated;

-- ---------------------------------------------------------------------
-- G. Nettoyage automatique (Loi 25), chaque nuit à 3 h 30 UTC
--    · candidats refusés : supprimés après 30 jours
--    · témoignages refusés : supprimés après 30 jours
--    · empreintes anti-spam : supprimées après 24 heures
-- ---------------------------------------------------------------------
create or replace function private.purge_loi25()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.prayer_requests where expires_at < now();
  delete from auth.users where id in (
    select id from public.profiles where role = 'refuse' and created_at < now() - interval '30 days');
  delete from public.testimonies where status = 'refuse' and created_at < now() - interval '30 days';
  delete from private.rate_events where at < now() - interval '1 day';
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('purge-loi25', '30 3 * * *', 'select private.purge_loi25();');
  else
    raise notice 'pg_cron absent : active « Cron » dans Supabase > Integrations, puis relance ce bloc.';
  end if;
end $$;
