# Yachad Ezer : requêtes de prière

« Portez les fardeaux les uns des autres » (Galates 6.2)

| Page | Pour qui | Ce qu'on y fait |
|---|---|---|
| `index.html` | Le public | Confier une demande (anonyme ou non), lire les témoignages |
| `suivi.html` | La personne qui a demandé | Lien privé : combien ont prié, témoigner, effacer sa demande |
| `devenir-intercesseur.html` | Futurs intercesseurs | Poser sa candidature |
| `connexion.html` · `mot-de-passe.html` | L'équipe | Se connecter, récupérer son mot de passe |
| `membre.html` | Intercesseurs | Demandes confiées (code seulement), observations, mon compte |
| `admin.html` | Toi | Demandes, répartition, observations, intercesseurs, témoignages, réglages |

Le site est bilingue (FR / EN), a un mode clair et sombre, et s'installe sur un téléphone comme une application.

## Comment ça marche, en mots simples

```
Navigateur ──► GitHub Pages (les fichiers : la vitrine, aucune donnée)
     │
     └──────► Supabase (la base + les comptes : l'entrepôt, qui décide qui voit quoi)
                 └─► Fonctions Edge (courriels, facultatif) ──► Brevo
```

1. **RLS (Row Level Security)** : les règles d'accès sont écrites **dans la base**. Même si quelqu'un trafique le JavaScript, la base refuse.
2. **Pseudonymisation (Loi 25)** : les intercesseurs voient un code (`YE-7KQ3`), jamais l'identité.
3. **Lien de suivi** : le navigateur crée un secret aléatoire. La base n'en garde que l'**empreinte** SHA-256, comme pour un mot de passe.
4. **CSP (Content Security Policy)** : chaque page dit au navigateur « n'exécute que du code venant de ce site ». Aucun script en ligne, aucune police ni bibliothèque chargée ailleurs.
5. **Anti-spam** : la base limite à 5 demandes par heure et par personne. L'adresse IP n'est jamais stockée, seulement une empreinte salée effacée après 24 h.

## Mettre à jour un projet existant (ta situation)

1. **Supabase → SQL Editor** : colle et exécute `supabase/migrations/002_ameliorations.sql`.
   Elle peut être relancée sans danger.
2. **Integrations → Cron** doit être activé (c'est le cas si `schema.sql` a fonctionné).
3. **Fusionner la branche** `ameliorations-v2` sur GitHub (voir plus bas).
4. **Courriels** : suis `docs/courriels.md`. Au minimum, le niveau 1 (5 minutes).
5. **Loi 25** : remplis `PRIVACY_OFFICER` dans `js/config.js` et lis `docs/loi25.md`.
6. **GitHub → Actions** : lance « Sécurité en ligne » avec **Run workflow** et vérifie que tout est vert.

## Nouvelle installation

1. Supabase (région **Canada Central**) → SQL Editor : `supabase/schema.sql`, puis `supabase/migrations/002_ameliorations.sql`.
2. Remplis `js/config.js` (URL + clé publishable) et l'adresse Supabase dans la balise CSP de chaque page.
3. GitHub Pages : Settings → Pages → branche `main`, dossier `/`.
4. Supabase → Authentication → URL Configuration : Site URL + Redirect URLs (`connexion.html`, `mot-de-passe.html`).
5. Inscris-toi sur « Devenir intercesseur », puis dans SQL Editor :
   ```sql
   update public.profiles set role = 'admin', active = true, approved_at = now()
   where id = (select id from auth.users where email = 'ton.courriel@exemple.com');
   ```

## Tests

| Test | Quand | Ce qu'il vérifie |
|---|---|---|
| `tests/run.sh` (92 tests) | À chaque envoi sur GitHub | Les règles de la base : visiteur, candidat, intercesseur, intercesseur en pause, admin |
| `tests/static-checks.mjs` | À chaque envoi | CSP sur chaque page, aucun script en ligne, aucune clé secrète, pas d'injection HTML, traductions complètes |
| `deno check` | À chaque envoi | Les fonctions de courriel |
| `tests/live-security.mjs` | Chaque dimanche + à la main | Le **vrai** site et le **vrai** Supabase, vus par un visiteur anonyme (lecture seule) |
| `keepalive.yml` | Lundi et jeudi | Empêche le projet Supabase gratuit de s'endormir |

Lancer les tests de la base en local (avec PostgreSQL installé) : `bash tests/run.sh`

## Structure

```
index.html, suivi.html, …      les pages (aucun script dedans)
css/style.css, css/fonts.css   l'apparence, les polices hébergées sur le site
js/boot.js                     thème et langue, avant l'affichage
js/i18n.js                     toutes les traductions FR / EN
js/app.js                      outils partagés (Supabase, dates, sécurité)
js/pages/*.js                  le code de chaque page
js/vendor/                     supabase-js (copie locale, version fixe)
sw.js, manifest.webmanifest    installation sur téléphone (PWA)
supabase/schema.sql            la base (première installation)
supabase/migrations/           les changements suivants, dans l'ordre
supabase/functions/            courriels (notifications, réponses)
tests/                         tests de sécurité
docs/                          courriels, Loi 25, registre des incidents
```

## Quand le projet grandira

| Signe | Étape suivante |
|---|---|
| Du spam passe malgré la limite | Ajouter Cloudflare Turnstile (case anti-robot gratuite, intégrée à Supabase Auth) |
| Plus de 300 courriels par jour | Offre payante Brevo, ou Resend |
| Tu veux un nom à toi | Un domaine (environ 15 à 20 $ par an), branché sur GitHub Pages, et les courriels envoyés depuis ce domaine |
| Plusieurs admins | Un journal des actions (qui a fait quoi, quand) |
