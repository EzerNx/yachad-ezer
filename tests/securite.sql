-- =====================================================================
--  Yachad Ezer — tests de sécurité de la base de données
--
--  On joue tour à tour le rôle d'un visiteur, d'un candidat, d'un
--  intercesseur, d'un intercesseur en pause et de l'admin, et on vérifie
--  que chacun ne peut faire QUE ce qui est prévu.
--
--  Chaque test affiche « PASS | ... » ou « FAIL | ... ».
--  Lancement : bash tests/run.sh
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\o /dev/null

-- ---------------------------------------------------------------------
-- Outils de test
-- ---------------------------------------------------------------------
create schema t;
grant usage on schema t to anon, authenticated;

-- Afficher le résultat d'un test
create function t.ok(cond boolean, name text) returns void language plpgsql as $$
begin
  if coalesce(cond, false) then raise notice 'PASS | %', name;
  else raise warning 'FAIL | %', name; end if;
end $$;

-- Nombre de lignes visibles (-1 = accès refusé)
create function t.n(q text) returns int language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || q || ') s' into c;
  return c;
exception when insufficient_privilege then return -1;
end $$;

-- Nombre de lignes modifiées par une écriture (-1 = refusée ou en erreur)
create function t.w(q text) returns int language plpgsql as $$
declare c int;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
exception when others then return -1;
end $$;

-- Vrai si la commande échoue
create function t.fails(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception when others then return true;
end $$;

-- Changer d'identité : rôle, utilisateur connecté, adresse IP
create function t.as(p_role text, p_uid text default '', p_ip text default '10.0.0.1') returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false);
  perform set_config('request.headers', json_build_object('x-forwarded-for', p_ip)::text, false);
  if p_role <> 'postgres' then execute format('set role %I', p_role); end if;
end $$;

grant execute on all functions in schema t to anon, authenticated;

-- ---------------------------------------------------------------------
-- Données de départ (en tant que propriétaire de la base)
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test',  '{"display_name":"Admin","engagement":"true"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'int1@test',   '{"display_name":"Ruth","engagement":"true"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'int2@test',   '{"display_name":"Paul","engagement":"true"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'pause@test',  '{"display_name":"Silas","engagement":"true"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'cand@test',   '{"display_name":"Candidat","role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'refuse@test', '{"display_name":"Refusé"}');

update public.profiles set role = 'admin',        active = true  where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'intercesseur', active = true  where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
update public.profiles set role = 'intercesseur', active = true  where id = '00000000-0000-0000-0000-0000000000b3';
update public.profiles set role = 'refuse',       active = false where id = '00000000-0000-0000-0000-0000000000c2';
update public.app_settings set auto_assign = false, per_request = 1;

\echo
\echo '== Inscription =='
select t.ok((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'candidat',
  'Un nouvel inscrit est « candidat », même s''il essaie de se déclarer admin dans ses métadonnées');

-- ---------------------------------------------------------------------
\echo
\echo '== Visiteur anonyme : envoi d''une demande =='
-- ---------------------------------------------------------------------
select t.as('anon', '', '10.0.0.1');
insert into public.prayer_requests (id, body, needs, wants_contact, age_confirmed, lang, follow_hash, code, status, expires_at)
values ('11111111-1111-1111-1111-111111111111', 'Priez pour mon travail', '{priere,suivi}', true, true, 'fr',
        encode(sha256(convert_to('jeton-secret-de-test-0123456789abcdef', 'UTF8')), 'hex'),
        'HACK', 'fermee', '2099-01-01');
insert into public.request_private (request_id, first_name, contact_method, contact_value, contact_consent_at)
values ('11111111-1111-1111-1111-111111111111', 'Jean', 'courriel', 'jean@test', now());
select t.as('anon', '', '10.0.0.2');
insert into public.prayer_requests (id, body, age_confirmed) values ('22222222-2222-2222-2222-222222222222', 'Pour ma famille', true);
select t.as('anon', '', '10.0.0.3');
insert into public.prayer_requests (id, body, age_confirmed) values ('33333333-3333-3333-3333-333333333333', 'Pour ma santé', true);
select t.as('anon', '', '10.0.0.4');
insert into public.prayer_requests (id, body, age_confirmed) values ('44444444-4444-4444-4444-444444444444', 'Pour mes études', true);

select t.as('postgres');
select t.ok((select code ~ '^YE-[A-Z2-9]{4}$' from public.prayer_requests where id = '11111111-1111-1111-1111-111111111111'),
  'Le visiteur ne choisit pas le code : la base l''impose (YE-XXXX)');
select t.ok((select status = 'nouvelle' from public.prayer_requests where id = '11111111-1111-1111-1111-111111111111'),
  'Le visiteur ne choisit pas le statut');
select t.ok((select expires_at < now() + interval '7 months' from public.prayer_requests where id = '11111111-1111-1111-1111-111111111111'),
  'Le visiteur ne peut pas prolonger la conservation au-delà de 6 mois');

-- Attributions de départ (posées à la main pour des tests prévisibles)
insert into public.assignments (request_id, member_id) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000b1'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000b2'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000b3');
update public.prayer_requests set status = 'assignee' where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
update public.profiles set active = false where id = '00000000-0000-0000-0000-0000000000b3';   -- Silas est mis en pause
select t.as('authenticated', '00000000-0000-0000-0000-0000000000b2');
insert into public.observations (request_id, member_id, body) values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000b2', 'Observation de Paul');

-- ---------------------------------------------------------------------
\echo
\echo '== Visiteur anonyme : ce qu''il ne doit PAS pouvoir faire =='
-- ---------------------------------------------------------------------
select t.as('anon', '', '10.0.0.9');
select t.ok(t.n('select * from public.prayer_requests') <= 0, 'Le visiteur ne lit aucune demande');
select t.ok(t.n('select * from public.request_private') <= 0, 'Le visiteur ne lit aucune identité ni coordonnée');
select t.ok(t.n('select * from public.profiles') <= 0, 'Le visiteur ne lit aucun profil');
select t.ok(t.n('select * from public.assignments') <= 0, 'Le visiteur ne lit aucune attribution');
select t.ok(t.n('select * from public.observations') <= 0, 'Le visiteur ne lit aucune observation');
select t.ok(t.n('select * from public.app_settings') <= 0, 'Le visiteur ne lit pas les réglages');
select t.ok(t.n('select * from private.secrets') <= 0, 'Le visiteur ne lit pas le sel secret de l''anti-spam');
select t.ok(t.n('select * from private.rate_events') <= 0, 'Le visiteur ne lit pas le journal anti-spam');
select t.ok(t.w('update public.prayer_requests set body = ''piraté''') <= 0, 'Le visiteur ne modifie aucune demande');
select t.ok(t.w('delete from public.prayer_requests') <= 0, 'Le visiteur ne supprime aucune demande');
select t.ok(t.fails('select public.distribute_new_requests()'), 'Le visiteur ne peut pas lancer la répartition');
select t.ok(t.fails('select public.delete_member(''00000000-0000-0000-0000-0000000000b1'')'), 'Le visiteur ne peut supprimer aucun compte');
select t.ok(t.fails('select private.assign_request(''44444444-4444-4444-4444-444444444444'', 5)'), 'Le visiteur ne peut pas appeler les fonctions internes');
select t.ok(t.fails('select private.purge_loi25()'), 'Le visiteur ne peut pas lancer le nettoyage');
select t.ok(t.fails('insert into public.request_private (request_id, first_name) values (''11111111-1111-1111-1111-111111111111'', ''Pirate'')'),
  'Le visiteur ne peut pas remplacer l''identité d''une demande existante');
select t.ok(t.fails('insert into public.prayer_requests (body, needs, age_confirmed) values (''Bonjour test'', ''{argent}'', true)'),
  'Un besoin inconnu est refusé');
select t.ok(t.fails('insert into public.prayer_requests (body, age_confirmed) values (repeat(''x'', 1501), true)'),
  'Un texte de plus de 1500 caractères est refusé');
select t.ok(t.fails('insert into public.prayer_requests (body, age_confirmed, lang) values (''Bonjour test'', true, ''xx'')'),
  'Une langue inconnue est refusée');
select t.ok(t.fails('insert into public.prayer_requests (body, age_confirmed, follow_hash) values (''Bonjour test'', true, ''<script>'')'),
  'Une empreinte de suivi mal formée est refusée');
select t.ok(t.fails('insert into public.prayer_requests (body, age_confirmed) values (''Bonjour test'', false)'),
  'Sans confirmation d''âge, la demande est refusée');

select t.as('postgres');
update public.prayer_requests set created_at = now() - interval '1 hour' where id = '44444444-4444-4444-4444-444444444444';
select t.as('anon', '', '10.0.0.9');
select t.ok(t.fails('insert into public.request_private (request_id, first_name) values (''44444444-4444-4444-4444-444444444444'', ''Tard'')'),
  'On ne peut plus rattacher une identité à une demande de plus de 15 minutes');

-- ---------------------------------------------------------------------
\echo
\echo '== Anti-spam =='
-- ---------------------------------------------------------------------
select t.as('anon', '', '172.16.5.5');
select t.ok(t.w('insert into public.prayer_requests (body, age_confirmed) values (''spam 1'', true)') = 1, 'Envoi 1 sur 5 accepté');
select t.w('insert into public.prayer_requests (body, age_confirmed) values (''spam 2'', true)');
select t.w('insert into public.prayer_requests (body, age_confirmed) values (''spam 3'', true)');
select t.w('insert into public.prayer_requests (body, age_confirmed) values (''spam 4'', true)');
select t.ok(t.w('insert into public.prayer_requests (body, age_confirmed) values (''spam 5'', true)') = 1, 'Envoi 5 sur 5 accepté');
select t.ok(t.fails('insert into public.prayer_requests (body, age_confirmed) values (''spam 6'', true)'),
  'Le 6e envoi dans l''heure depuis la même adresse est bloqué');
select t.as('anon', '', '172.16.5.6');
select t.ok(t.w('insert into public.prayer_requests (body, age_confirmed) values (''autre personne'', true)') = 1,
  'Une autre adresse peut toujours envoyer');
select t.as('postgres');
select t.ok(not exists (select 1 from private.rate_events where bucket like '%172.16%'),
  'L''adresse IP n''est jamais enregistrée en clair (seulement une empreinte)');
delete from public.prayer_requests where body like 'spam%' or body = 'autre personne';

-- ---------------------------------------------------------------------
\echo
\echo '== Lien de suivi privé =='
-- ---------------------------------------------------------------------
select t.as('anon', '', '10.0.0.20');
select t.ok(t.n('select * from public.request_status(''jeton-secret-de-test-0123456789abcdef'')') = 1, 'Le bon lien montre l''état de la demande');
select t.ok((select prayed_count = 0 and intercessor_count = 1 from public.request_status('jeton-secret-de-test-0123456789abcdef')),
  'Le suivi montre le nombre d''intercesseurs');
select t.ok((select count(*) from json_object_keys((select row_to_json(s) from public.request_status('jeton-secret-de-test-0123456789abcdef') s))
       where json_object_keys in ('body', 'first_name', 'contact_value')) = 0,
  'Le suivi ne révèle ni le texte, ni le prénom, ni les coordonnées');
select t.ok(t.n('select * from public.request_status(''mauvais-jeton-0123456789abcdef'')') = 0, 'Un mauvais lien ne montre rien');
select t.ok(t.n('select * from public.request_status(''court'')') = 0, 'Un lien trop court ne montre rien');
select t.ok(t.n('select * from public.request_status(null)') = 0, 'Un lien vide ne montre rien');

\echo
\echo '== Témoignages =='
select t.ok(t.fails('select public.add_testimony(''mauvais-jeton-0123456789abcdef'', ''Dieu a répondu à ma prière'')'),
  'Impossible d''envoyer un témoignage sans un vrai lien de suivi');
select t.ok((select public.add_testimony('jeton-secret-de-test-0123456789abcdef', 'Dieu a répondu à ma prière, merci !', 'Jean', 'fr')) is not null,
  'Avec son lien, la personne peut envoyer un témoignage');
select t.ok(t.n('select id, body from public.testimonies') = 0, 'Un témoignage non validé reste invisible au public');
select t.ok(t.w('update public.testimonies set status = ''publie''') <= 0, 'Le visiteur ne peut pas publier un témoignage');

select t.as('authenticated', '00000000-0000-0000-0000-0000000000b1');
select t.ok(t.n('select * from public.testimonies') = 0, 'Un intercesseur ne voit pas les témoignages en attente');
select t.ok(t.w('update public.testimonies set status = ''publie''') <= 0, 'Un intercesseur ne peut pas publier un témoignage');

select t.as('authenticated', '00000000-0000-0000-0000-0000000000a1');
update public.testimonies set status = 'publie', body = 'Texte réécrit par l''admin', published_at = '2000-01-01';
select t.ok((select body = 'Dieu a répondu à ma prière, merci !' from public.testimonies limit 1),
  'Même l''admin ne peut pas réécrire les mots d''un témoignage');
select t.ok((select published_at > now() - interval '1 minute' from public.testimonies limit 1),
  'La date de publication est fixée par la base, pas par le navigateur');

select t.as('anon', '', '10.0.0.21');
select t.ok(t.n('select body, display_name from public.testimonies') = 1, 'Un témoignage publié est visible par tous');
select t.ok(t.n('select status from public.testimonies') = -1, 'Le public ne voit pas les colonnes internes (statut)');
select t.ok(t.n('select request_id from public.testimonies') = -1, 'Le public ne peut pas relier un témoignage à une demande');

-- ---------------------------------------------------------------------
\echo
\echo '== Candidat (inscrit, pas encore accepté) =='
-- ---------------------------------------------------------------------
select t.as('authenticated', '00000000-0000-0000-0000-0000000000c1');
select t.ok(t.n('select * from public.prayer_requests') = 0, 'Le candidat ne voit aucune demande');
select t.ok(t.n('select * from public.profiles') = 1, 'Le candidat ne voit que son propre profil');
select t.ok(t.fails('update public.profiles set role = ''admin'' where id = ''00000000-0000-0000-0000-0000000000c1'''), 'Le candidat ne peut pas se nommer admin');
select t.ok(t.fails('update public.profiles set active = true where id = ''00000000-0000-0000-0000-0000000000c1'''), 'Le candidat ne peut pas s''activer lui-même');
select t.ok(t.w('update public.profiles set display_name = ''X'' where id = ''00000000-0000-0000-0000-0000000000a1''') <= 0, 'Le candidat ne peut pas modifier le profil de l''admin');
select t.ok(t.fails('insert into public.observations (request_id, member_id, body) values (''11111111-1111-1111-1111-111111111111'', ''00000000-0000-0000-0000-0000000000c1'', ''test'')'),
  'Le candidat ne peut pas écrire d''observation');

-- ---------------------------------------------------------------------
\echo
\echo '== Intercesseur =='
-- ---------------------------------------------------------------------
select t.as('authenticated', '00000000-0000-0000-0000-0000000000b1');
select t.ok(t.n('select * from public.prayer_requests') = 1, 'Ruth ne voit QUE la demande qui lui est confiée');
select t.ok(t.n('select * from public.request_private') = 0, 'Ruth ne voit jamais l''identité ni les coordonnées');
select t.ok(t.n('select * from public.profiles') = 1, 'Ruth ne voit pas les profils des autres');
select t.ok(t.n('select * from public.observations') = 0, 'Ruth ne lit pas les observations de Paul');
select t.ok(t.n('select * from public.assignments') = 1, 'Ruth ne voit que ses propres attributions');
select t.ok(t.n('select * from public.app_settings') = 0, 'Ruth ne voit pas les réglages');
select t.ok(t.w('insert into public.observations (request_id, member_id, body) values (''11111111-1111-1111-1111-111111111111'', ''00000000-0000-0000-0000-0000000000b1'', ''J''''ai prié'')') = 1,
  'Ruth peut écrire une observation sur SA demande');
select t.ok(t.fails('insert into public.observations (request_id, member_id, body) values (''22222222-2222-2222-2222-222222222222'', ''00000000-0000-0000-0000-0000000000b1'', ''test'')'),
  'Ruth ne peut pas écrire sur une demande qui ne lui est pas confiée');
select t.ok(t.fails('insert into public.observations (request_id, member_id, body) values (''11111111-1111-1111-1111-111111111111'', ''00000000-0000-0000-0000-0000000000b2'', ''usurpation'')'),
  'Ruth ne peut pas écrire au nom de Paul');
select t.ok(t.fails('insert into public.observations (request_id, member_id, body, status) values (''11111111-1111-1111-1111-111111111111'', ''00000000-0000-0000-0000-0000000000b1'', ''test'', ''transmise'')'),
  'Ruth ne peut pas marquer sa propre observation comme transmise');
select t.ok(t.w('update public.observations set status = ''transmise''') <= 0, 'Ruth ne peut pas changer le statut des observations');
select t.ok(t.fails('insert into public.assignments (request_id, member_id) values (''22222222-2222-2222-2222-222222222222'', ''00000000-0000-0000-0000-0000000000b1'')'),
  'Ruth ne peut pas s''attribuer une demande');
select t.ok(t.w('update public.assignments set prayed_at = now() where member_id = ''00000000-0000-0000-0000-0000000000b1''') = 1,
  'Ruth peut cocher « J''ai prié » sur sa demande');
select t.ok(t.w('update public.assignments set prayed_at = now() where member_id = ''00000000-0000-0000-0000-0000000000b2''') <= 0,
  'Ruth ne peut pas cocher la demande de Paul');
select t.ok(t.fails('update public.assignments set request_id = ''22222222-2222-2222-2222-222222222222'' where member_id = ''00000000-0000-0000-0000-0000000000b1'''),
  'Ruth ne peut pas échanger sa demande contre une autre');
select t.ok(t.fails('update public.profiles set role = ''admin'' where id = ''00000000-0000-0000-0000-0000000000b1'''), 'Ruth ne peut pas se nommer admin');
select t.ok(t.w('update public.profiles set notify = false where id = ''00000000-0000-0000-0000-0000000000b1''') = 1, 'Ruth peut couper ses notifications');
select t.ok(t.fails('select public.distribute_new_requests()'), 'Ruth ne peut pas lancer la répartition');
select t.ok(t.fails('select public.delete_member(''00000000-0000-0000-0000-0000000000b2'')'), 'Ruth ne peut pas supprimer le compte de Paul');
select t.ok(t.w('update public.app_settings set per_request = 10') <= 0, 'Ruth ne peut pas changer les réglages');
select t.ok(t.w('update public.prayer_requests set status = ''fermee''') <= 0, 'Ruth ne peut pas fermer une demande');
select t.ok(t.w('delete from public.prayer_requests') <= 0, 'Ruth ne peut supprimer aucune demande');

-- ---------------------------------------------------------------------
\echo
\echo '== Intercesseur en pause =='
-- ---------------------------------------------------------------------
select t.as('authenticated', '00000000-0000-0000-0000-0000000000b3');
select t.ok(t.n('select * from public.prayer_requests') = 0, 'Un intercesseur en pause ne voit plus ses demandes');
select t.ok(t.fails('insert into public.observations (request_id, member_id, body) values (''33333333-3333-3333-3333-333333333333'', ''00000000-0000-0000-0000-0000000000b3'', ''test'')'),
  'Un intercesseur en pause ne peut plus écrire d''observation');

-- ---------------------------------------------------------------------
\echo
\echo '== Administrateur =='
-- ---------------------------------------------------------------------
select t.as('authenticated', '00000000-0000-0000-0000-0000000000a1');
select t.ok(t.n('select * from public.prayer_requests') = 4, 'L''admin voit toutes les demandes');
select t.ok(t.n('select * from public.request_private') = 1, 'L''admin voit les identités');
select t.ok(t.n('select * from public.observations') = 2, 'L''admin voit toutes les observations');
select t.ok((select public.distribute_new_requests()) >= 1, 'L''admin peut répartir les demandes sans intercesseur');
select t.ok(t.fails('select public.delete_member(''00000000-0000-0000-0000-0000000000a1'')'), 'Le dernier admin ne peut pas supprimer son propre compte');
select t.ok(t.w('select public.delete_member(''00000000-0000-0000-0000-0000000000c2'')') >= 0, 'L''admin peut supprimer un candidat refusé');
select t.as('postgres');
select t.ok(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000c2')
        and not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000c2'),
  'Le compte supprimé disparaît vraiment (compte + profil)');

-- ---------------------------------------------------------------------
\echo
\echo '== Droits Loi 25 : effacement =='
-- ---------------------------------------------------------------------
select t.as('authenticated', '00000000-0000-0000-0000-0000000000b2');
select public.delete_my_account();
select t.as('postgres');
select t.ok(not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b2')
        and not exists (select 1 from public.observations where member_id = '00000000-0000-0000-0000-0000000000b2'),
  'Un intercesseur peut supprimer son compte, et ses observations partent avec');

select t.as('anon', '', '10.0.0.30');
select t.ok((select public.delete_my_request('mauvais-jeton-0123456789abcdef')) = false, 'Un mauvais lien ne supprime rien');
select t.ok((select public.delete_my_request('jeton-secret-de-test-0123456789abcdef')) = true, 'La personne peut supprimer sa demande avec son lien');
select t.as('postgres');
select t.ok(not exists (select 1 from public.prayer_requests where id = '11111111-1111-1111-1111-111111111111')
        and not exists (select 1 from public.request_private where request_id = '11111111-1111-1111-1111-111111111111')
        and not exists (select 1 from public.observations where request_id = '11111111-1111-1111-1111-111111111111'),
  'La suppression efface aussi l''identité, les coordonnées et les observations');

\echo
\echo '== Nettoyage automatique =='
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c3', 'vieux@test');
update public.profiles set role = 'refuse', created_at = now() - interval '40 days' where id = '00000000-0000-0000-0000-0000000000c3';
update public.prayer_requests set expires_at = now() - interval '1 day' where id = '33333333-3333-3333-3333-333333333333';
select private.purge_loi25();
select t.ok(not exists (select 1 from public.prayer_requests where id = '33333333-3333-3333-3333-333333333333'), 'Une demande de plus de 6 mois est supprimée');
select t.ok(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000c3'), 'Un candidat refusé depuis plus de 30 jours est supprimé');
select t.ok(exists (select 1 from public.prayer_requests where id = '44444444-4444-4444-4444-444444444444'), 'Une demande récente est conservée');

\echo
\echo '== Maintien en vie =='
select t.as('anon');
select t.ok((select public.keepalive()) = 'ok', 'La fonction keepalive répond au visiteur');
select t.as('postgres');

\echo
\echo '== Profil multilingue (migration 004) =='
select t.as('postgres');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'multi@test',
   '{"display_name":"Ana","languages":["ES","es","pt","<b>","x1"],"country":"ht","timezone":"Europe/Paris",
     "availability":[{"d":1,"s":360,"e":420},{"d":9,"s":0,"e":60},{"d":2,"s":500,"e":400},{"d":"3; drop table x","s":1,"e":2},"x",{"d":7,"s":1200,"e":1440}]}'),
  ('00000000-0000-0000-0000-0000000000d2', 'bad@test',
   '{"display_name":"Bad","languages":"es","country":"Canada","timezone":"Mars/Olympus"}');
select t.ok((select languages = array['es','pt'] and country = 'HT' and timezone = 'Europe/Paris'
             from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'Inscription : langues nettoyées (sans doublon ni code invalide), pays et fuseau enregistrés');
select t.ok((select count(*) from public.availability where member_id = '00000000-0000-0000-0000-0000000000d1') = 2,
  'Inscription : seules les disponibilités valides sont gardées (2 sur 6)');
select t.ok((select raw_user_meta_data = '{"display_name":"Ana"}'::jsonb from auth.users where id = '00000000-0000-0000-0000-0000000000d1'),
  'Inscription : les détails sont retirés des métadonnées du compte (pas de copie en double)');
select t.ok((select languages = array['fr'] and country = '' and timezone = 'America/Toronto'
             from public.profiles where id = '00000000-0000-0000-0000-0000000000d2'),
  'Inscription : des métadonnées mal formées ne bloquent pas, on prend des valeurs sûres');
update public.profiles set role = 'intercesseur', active = true where id = '00000000-0000-0000-0000-0000000000d1';

select t.as('authenticated', '00000000-0000-0000-0000-0000000000b1');
select t.ok(t.w('update public.profiles set languages = ''{fr,ht,fr}'', country = ''HT'', timezone = ''America/Port-au-Prince'', display_name = ''Ruth M.'', church = ''Église test'' where id = ''00000000-0000-0000-0000-0000000000b1''') = 1,
  'L''intercesseur modifie son nom, son Église, ses langues, son pays et son fuseau');
select t.ok((select languages = array['fr','ht'] from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'Les langues en double sont retirées, l''ordre est gardé');
select t.ok(t.fails('update public.profiles set timezone = ''Mars/Olympus'' where id = ''00000000-0000-0000-0000-0000000000b1'''),
  'Un fuseau horaire inconnu est refusé');
select t.ok(t.fails('update public.profiles set languages = ''{}'' where id = ''00000000-0000-0000-0000-0000000000b1'''),
  'Il faut au moins une langue');
select t.ok(t.fails('update public.profiles set languages = ''{a,b,c,d,e,f,g,h,i}'' where id = ''00000000-0000-0000-0000-0000000000b1'''),
  'Pas plus de 8 langues, et seulement des codes valides');
select t.ok(t.fails('update public.profiles set country = ''<script>'' where id = ''00000000-0000-0000-0000-0000000000b1'''),
  'Un pays invalide est refusé');
select t.ok(t.w('update public.profiles set languages = ''{ko}'' where id = ''00000000-0000-0000-0000-0000000000d1''') <= 0,
  'L''intercesseur ne modifie pas le profil d''un autre');
select t.ok(t.fails('update public.profiles set role = ''admin'' where id = ''00000000-0000-0000-0000-0000000000b1'''),
  'L''intercesseur ne se donne toujours pas le rôle admin depuis Mon compte');

\echo
\echo '== Disponibilités =='
select t.ok(t.w('insert into public.availability (member_id, weekday, start_min, end_min) values (''00000000-0000-0000-0000-0000000000b1'', 1, 360, 420)') = 1,
  'L''intercesseur ajoute un créneau (lundi 6 h - 7 h)');
select t.ok(t.fails('insert into public.availability (member_id, weekday, start_min, end_min) values (''00000000-0000-0000-0000-0000000000d1'', 1, 360, 420)'),
  'Il ne peut pas ajouter un créneau au nom d''un autre');
select t.ok(t.fails('insert into public.availability (member_id, weekday, start_min, end_min) values (''00000000-0000-0000-0000-0000000000b1'', 2, 600, 540)'),
  'Un créneau qui finit avant de commencer est refusé');
select t.ok(t.fails('insert into public.availability (member_id, weekday, start_min, end_min) values (''00000000-0000-0000-0000-0000000000b1'', 8, 60, 120)'),
  'Un jour de semaine invalide est refusé');
select t.ok(t.w('update public.availability set member_id = ''00000000-0000-0000-0000-0000000000d1'' where member_id = ''00000000-0000-0000-0000-0000000000b1''') <= 0,
  'Il ne peut pas donner son créneau à quelqu''un d''autre');
select t.as('postgres');
insert into public.availability (member_id, weekday, start_min, end_min)
select '00000000-0000-0000-0000-0000000000b1', d, h * 60, h * 60 + 30 from generate_series(1, 7) d, generate_series(10, 13) h
limit 27;   -- avec le créneau du lundi : 28 au total
select t.as('authenticated', '00000000-0000-0000-0000-0000000000b1');
select t.ok(t.fails('insert into public.availability (member_id, weekday, start_min, end_min) values (''00000000-0000-0000-0000-0000000000b1'', 3, 1200, 1230)'),
  'Pas plus de 28 créneaux par personne');
select t.as('authenticated', '00000000-0000-0000-0000-0000000000d1');
select t.ok(t.n('select * from public.availability where member_id <> ''00000000-0000-0000-0000-0000000000d1''') = 0, 'Un intercesseur ne voit pas les disponibilités des autres');
select t.ok(t.w('delete from public.availability where member_id = ''00000000-0000-0000-0000-0000000000b1''') <= 0, 'Ni ne les supprime');
select t.as('anon');
select t.ok(t.n('select * from public.availability') <= 0, 'Le visiteur ne voit aucune disponibilité');
select t.as('authenticated', '00000000-0000-0000-0000-0000000000a1');
select t.ok(t.n('select * from public.availability') >= 28, 'L''admin voit les disponibilités (tableau de couverture)');

select t.as('authenticated', '00000000-0000-0000-0000-0000000000d1');
select t.ok((select public.set_my_availability('[{"weekday":2,"start_min":300,"end_min":360},{"weekday":4,"start_min":1200,"end_min":1260}]')) = 2
            and (select count(*) from public.availability where member_id = '00000000-0000-0000-0000-0000000000d1') = 2,
  'Mon compte : je remplace mes créneaux en une seule opération');
select t.ok(t.fails('select public.set_my_availability(''[{"weekday":2,"start_min":300,"end_min":200}]'')')
            and (select count(*) from public.availability where member_id = '00000000-0000-0000-0000-0000000000d1') = 2,
  'Un créneau invalide annule tout : mes anciens créneaux restent intacts');
select t.as('postgres');
select t.ok((select count(*) from public.availability where member_id = '00000000-0000-0000-0000-0000000000b1') >= 28,
  'Remplacer mes créneaux ne touche pas ceux des autres');
select t.as('anon');
select t.ok(t.fails('select public.set_my_availability(''[]'')'), 'Le visiteur ne peut pas écrire de disponibilités');
select t.as('postgres');

\echo
\echo '== Répartition selon la langue =='
select t.as('postgres');
update public.profiles set languages = '{fr}' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');
update public.profiles set languages = '{es,pt}' where id = '00000000-0000-0000-0000-0000000000d1';
-- Ana a plus de demandes en cours que les autres : la langue passe quand même avant
insert into public.prayer_requests (id, body, age_confirmed) values
  ('55555555-5555-5555-5555-555555555551', 'Charge 1', true),
  ('55555555-5555-5555-5555-555555555552', 'Charge 2', true);
insert into public.assignments (request_id, member_id) values
  ('55555555-5555-5555-5555-555555555551', '00000000-0000-0000-0000-0000000000d1'),
  ('55555555-5555-5555-5555-555555555552', '00000000-0000-0000-0000-0000000000d1');
insert into public.prayer_requests (id, body, age_confirmed, lang) values ('66666666-6666-6666-6666-666666666666', 'Oren por mi familia', true, 'es');
select private.assign_request('66666666-6666-6666-6666-666666666666', 1);
select t.ok((select member_id from public.assignments where request_id = '66666666-6666-6666-6666-666666666666') = '00000000-0000-0000-0000-0000000000d1',
  'Une demande en espagnol va d''abord à un intercesseur qui parle espagnol');
insert into public.prayer_requests (id, body, age_confirmed, lang) values ('77777777-7777-7777-7777-777777777777', '기도해 주세요', true, 'ko');
select private.assign_request('77777777-7777-7777-7777-777777777777', 1);
select t.ok((select count(*) from public.assignments where request_id = '77777777-7777-7777-7777-777777777777') = 1,
  'Si personne ne parle la langue, la demande est quand même confiée (bouton Traduire)');

\echo
\echo '== Télécharger mes données (RGPD art. 15 et 20) =='
select t.as('authenticated', '00000000-0000-0000-0000-0000000000b1');
select t.ok((select public.export_my_data() #>> '{account,email}') = 'int1@test', 'L''intercesseur télécharge ses propres données');
select t.ok((select public.export_my_data()::text not like '%int2@test%' and public.export_my_data()::text not like '%Jean%'),
  'L''export ne contient ni les données d''un autre, ni l''identité des personnes');
select t.as('anon');
select t.ok(t.fails('select public.export_my_data()'), 'Le visiteur ne peut rien exporter sans être connecté');
select t.as('anon', '', '10.0.0.77');
insert into public.prayer_requests (body, age_confirmed, lang, follow_hash)
values ('Merci de prier pour mon examen', true, 'pt', encode(sha256(convert_to('jeton-export-0123456789abcdefghij', 'UTF8')), 'hex'));
select t.ok((select public.request_export('jeton-export-0123456789abcdefghij') #>> '{request,body}') = 'Merci de prier pour mon examen',
  'La personne retrouve sa demande avec son lien privé');
select t.ok(t.fails('select public.request_export(''mauvais-jeton-0123456789abcdefghij'')'), 'Un mauvais lien ne donne rien');
select t.ok((select public.request_export('jeton-export-0123456789abcdefghij')::text not like '%Ruth%'
             and public.request_export('jeton-export-0123456789abcdefghij')::text not like '%Paul%'),
  'L''export de la personne ne révèle aucun intercesseur');
select public.add_testimony('jeton-export-0123456789abcdefghij', 'Deus respondeu a minha oração!', 'Ana', 'pt');
select t.as('postgres');
select t.ok((select lang from public.testimonies where body like 'Deus respondeu%') = 'pt', 'Le témoignage garde sa langue (portugais)');
select t.as('anon', '', '10.0.0.78');
select t.ok(t.w('insert into public.prayer_requests (body, age_confirmed, lang) values (''기도 부탁드립니다'', true, ''ko'')') = 1,
  'Une demande en coréen est acceptée');
select t.as('postgres');

\echo
\echo '== Fonctions serveur (rôle de service) =='
grant usage on schema t to service_role;
grant execute on all functions in schema t to service_role;
select t.as('service_role');
select t.ok(t.n('select role from public.profiles') > 0, 'Les fonctions de courriel peuvent lire les profils (vérifier l''admin)');
select t.ok(t.n('select contact_value from public.request_private') >= 0, 'Les fonctions de courriel peuvent lire l''adresse de réponse');
select t.ok(t.w('update public.observations set status = status') >= 0, 'Les fonctions de courriel peuvent marquer une observation comme transmise');
select t.as('postgres');
