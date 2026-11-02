# Yachad Ezer — requêtes de prière

« Portez les fardeaux les uns des autres » (Galates 6.2)

Une web app avec trois espaces :

| Page | Pour qui | Ce qu'on y fait |
|---|---|---|
| `index.html` | Le public | Confier une demande de prière (anonyme ou non, contact facultatif) |
| `devenir-intercesseur.html` | Futurs intercesseurs | Créer un compte et poser sa candidature |
| `connexion.html` | L'équipe | Se connecter, puis être envoyé au bon portail |
| `membre.html` | Intercesseurs | Voir les demandes confiées (code seulement), cocher « priée », écrire une observation |
| `admin.html` | Toi | Demandes, répartition, candidatures, observations, réponses aux personnes |

## Comment ça marche, en mots simples

```
Navigateur  ──►  GitHub Pages (les fichiers HTML, CSS, JS : la vitrine)
     │
     └──────►  Supabase (la base de données + les comptes : l'entrepôt)
```

- **GitHub Pages** sert seulement des fichiers. Il ne garde aucune donnée.
- **Supabase** garde les demandes et les comptes, et décide **qui a le droit de voir quoi**.
- **Coût : 0 $** avec les offres gratuites. Ton budget de 20 $ reste intact.

### Les idées importantes

1. **RLS (Row Level Security).** Ce sont des règles écrites dans la base : « un intercesseur ne voit que les demandes qui lui sont confiées ». Même si quelqu'un trafique le JavaScript dans son navigateur, la base refuse. C'est pour ça que la sécurité est dans `schema.sql` et pas dans les pages.
2. **Pseudonymisation (Loi 25).** Le prénom et les coordonnées sont rangés dans une table à part (`request_private`) que seul l'admin peut lire. Les intercesseurs voient un **code** comme `YE-7KQ3`. On n'utilise pas les vraies initiales : elles pourraient permettre de reconnaître quelqu'un.
3. **Clé publique et clé secrète.** La clé `sb_publishable_...` peut être visible dans le code : elle n'ouvre que ce que les règles RLS permettent. La clé **secrète** ne doit **jamais** aller dans ce projet.
4. **Trigger.** Une action automatique de la base. Ici : générer le code, répartir la demande, créer le profil d'un nouvel inscrit.

### L'algorithme de répartition

Quand une demande arrive, la base choisit les intercesseurs actifs qui ont **le moins de demandes encore à prier**. En cas d'égalité, elle tire au hasard. Ainsi, la charge reste équilibrée. Par défaut : 2 intercesseurs par demande, en automatique. Tu peux tout changer dans l'onglet **Réglages**, et ajouter ou retirer quelqu'un à la main sur chaque demande.

Le code est dans `supabase/schema.sql`, fonction `private.assign_request`.

## Installation (environ 1 heure)

### 1. Créer le projet Supabase
1. Va sur supabase.com et crée un compte, puis un projet. Choisis la région **Canada (Central)** : les données restent au Canada.
2. Ouvre **SQL Editor**, puis **New query**. Colle tout `supabase/schema.sql` et clique **Run**.
   - Si la partie « pg_cron » échoue : va dans **Integrations**, active **Cron**, puis relance seulement la section 7.
3. Ouvre **Project Settings → API Keys**. Copie l'URL du projet et la clé **publishable** dans `js/config.js`.

### 2. Mettre le site en ligne avec GitHub Pages
1. Crée un dépôt public sur GitHub, par exemple `yachad-ezer`.
2. Téléverse tous les fichiers du dossier (en gardant les sous-dossiers `css`, `js`, `supabase`).
3. Dans le dépôt : **Settings → Pages → Build and deployment → Deploy from a branch**, branche `main`, dossier `/ (root)`.
4. Après une minute, le site est à `https://TON-NOM.github.io/yachad-ezer/`.

### 3. Relier les comptes au site
Dans Supabase : **Authentication → URL Configuration**
- **Site URL** : `https://TON-NOM.github.io/yachad-ezer/`
- **Redirect URLs** : ajoute `https://TON-NOM.github.io/yachad-ezer/connexion.html`

### 4. Devenir admin
1. Sur ton site, va sur **Devenir intercesseur** et inscris-toi.
2. Confirme ton courriel avec le lien reçu.
3. Dans **SQL Editor**, exécute (avec ton courriel) :
   ```sql
   update public.profiles set role = 'admin', active = true, approved_at = now()
   where id = (select id from auth.users where email = 'ton.courriel@exemple.com');
   ```
4. Connecte-toi : tu arrives sur le portail admin.

### 5. Tester tout le parcours
- [ ] Envoyer une demande anonyme depuis l'accueil.
- [ ] Envoyer une demande avec un courriel et « Je souhaite qu'on me recontacte ».
- [ ] Inscrire un 2e compte intercesseur (un autre courriel), l'accepter dans l'admin.
- [ ] Cliquer « Répartir » et vérifier que l'intercesseur voit un **code**, jamais le prénom.
- [ ] Écrire une observation comme intercesseur, la retrouver dans l'onglet **Observations**, copier la réponse.

## Loi 25 : ce qui reste à faire de ton côté
- Écrire **ton nom et un courriel** de responsable dans `index.html` (section « Responsable de la protection… »).
- Faire une courte **évaluation des facteurs relatifs à la vie privée (EFVP)** si les données sont hébergées hors du Québec. Choisir la région Canada simplifie les choses.
- Tenir un **registre des incidents** de confidentialité (un simple document suffit au début).
- Garder la règle : les données sont supprimées après **6 mois** (déjà automatique avec pg_cron).

## Ce qui viendra plus tard (seulement quand le besoin arrive)
| Signe | Étape suivante |
|---|---|
| Des demandes « robot » arrivent | Ajouter Cloudflare Turnstile (une case anti-robot gratuite) |
| Les courriels de confirmation n'arrivent plus ou trop lentement | Le service de courriel intégré de Supabase est très limité : brancher un SMTP (Resend, Brevo) |
| Tu passes trop de temps à copier les réponses | Envoyer les réponses directement depuis l'admin avec une Edge Function |
| Un intercesseur oublie son mot de passe | Ajouter une page « mot de passe oublié » |

## Plan des séances (1 heure chacune)
1. **Supabase** : créer le projet, exécuter `schema.sql`, lire les commentaires de la section RLS.
2. **GitHub Pages** : mettre le site en ligne, envoyer une demande test, la retrouver dans **Table Editor**.
3. **Équipe** : devenir admin, inscrire un intercesseur test, tester la répartition.
4. **Exercice** : modifier `private.assign_request` pour que l'admin ne reçoive pas de demandes. Écris-le toi-même, puis on corrige ensemble.
5. **Observations** : faire le parcours complet jusqu'à la réponse envoyée. Compléter la section Loi 25.
6. **Exercice** : ajouter la page « mot de passe oublié » (`resetPasswordForEmail`).
