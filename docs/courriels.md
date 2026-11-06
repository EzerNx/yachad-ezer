# Courriels : configuration pas à pas

Sans cette étape, **les nouveaux intercesseurs ne reçoivent pas leur courriel de confirmation**.
Le service de courriel intégré à Supabase n'envoie qu'aux membres de ton équipe Supabase,
et seulement 2 courriels par heure.

Il y a deux niveaux. Fais au moins le niveau 1.

---

## Niveau 1 : débloquer les inscriptions (10 minutes, sans compte externe)

Comme tu approuves déjà chaque candidature à la main, la confirmation par courriel
n'est pas indispensable.

1. Supabase → **Authentication → Sign In / Providers → Email**
2. Décoche **Confirm email**, puis **Save**.

Effet : la personne s'inscrit, puis voit « Candidature en attente » en se connectant.
Le « mot de passe oublié » ne fonctionnera qu'avec le niveau 2.

---

## Niveau 2 : de vrais courriels (gratuit, environ 300 par jour)

### A. Créer un compte Brevo
1. Crée un compte gratuit sur brevo.com.
2. **Senders, Domains & Dedicated IPs → Senders** : ajoute l'adresse d'envoi
   (ex. : ton Gmail ou une adresse de ton futur domaine) et confirme-la.
3. **SMTP & API → SMTP** : note le serveur, le port, l'identifiant et génère une **clé SMTP**.
4. **SMTP & API → API Keys** : génère une **clé API** (pour les fonctions plus bas).

> Ces clés sont des **secrets** : ne les mets jamais dans le code ni sur GitHub.

### B. Brancher Brevo à Supabase (courriels de connexion)
Supabase → **Authentication → Emails → SMTP Settings** → **Enable custom SMTP** :
- Host : `smtp-relay.brevo.com` · Port : `587`
- Username : l'identifiant SMTP Brevo · Password : la clé SMTP
- Sender email : l'adresse confirmée à l'étape A2 · Sender name : `Yachad Ezer`

Réactive ensuite **Confirm email** si tu l'avais coupé.

### C. Traduire les courriels de Supabase
**Authentication → Emails → Templates**. Exemple pour **Confirm signup** :

```
Sujet : Confirmez votre adresse · Confirm your address

<p>Bonjour,</p>
<p>Merci de vouloir servir dans la prière avec Yachad Ezer.
Cliquez pour confirmer votre adresse :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon adresse</a></p>
<hr>
<p>Thank you for wanting to serve in prayer with Yachad Ezer.
<a href="{{ .ConfirmationURL }}">Confirm my address</a></p>
```

Fais de même pour **Reset password** (« Choisir un nouveau mot de passe »).

### D. Autoriser les pages de retour
**Authentication → URL Configuration → Redirect URLs**, ajoute :
- `https://ezernx.github.io/yachad-ezer/connexion.html`
- `https://ezernx.github.io/yachad-ezer/mot-de-passe.html`

---

## Niveau 3 : notifications et réponses en un clic (fonctions Edge)

Le code est déjà écrit dans `supabase/functions/`. Il faut le **déployer** une fois.

### Ce qu'il te faut sur ton PC Windows
1. Node.js (déjà installé si tu fais du JavaScript).
2. Dans un terminal, dans le dossier du projet :
   ```
   npx supabase login
   npx supabase link --project-ref kklvokzhptyogutwakol
   ```

### Les secrets (une seule fois)
Invente un long mot de passe pour `WEBHOOK_SECRET` (ex. : 40 caractères au hasard).
```
npx supabase secrets set BREVO_API_KEY=ta_cle_api_brevo SENDER_EMAIL=ton@adresse.com SENDER_NAME="Yachad Ezer" SITE_URL=https://ezernx.github.io/yachad-ezer/ WEBHOOK_SECRET=ton_long_secret
```

### Déployer
```
npx supabase functions deploy send-reply --no-verify-jwt
npx supabase functions deploy notify --no-verify-jwt
```
- `send-reply` vérifie elle-même, avec Supabase Auth, que la personne est connectée
  et qu'elle est admin. On coupe donc la vérification automatique, qui peut refuser
  les jetons des projets récents.
- `notify` est appelée par la base, pas par une personne connectée : elle se protège
  avec `WEBHOOK_SECRET`.

### Brevo : autoriser les envois depuis Supabase
Les fonctions partent de serveurs dont l'adresse IP change. Si Brevo bloque les IP
inconnues, l'envoi échoue avec « unrecognised IP address ».
Brevo → ton profil → **Security → Authorized IPs** : désactive le blocage des IP inconnues.

### En cas d'erreur
- L'admin affiche maintenant la raison exacte sous le bouton **Envoyer le courriel**.
- Les détails sont aussi dans Supabase → **Edge Functions → send-reply → Logs**.

### Brancher les notifications (Database Webhooks)
Supabase → **Integrations → Database Webhooks → Create a new hook**, cinq fois :

| Nom | Table | Événement |
|---|---|---|
| notif-demande | prayer_requests | Insert |
| notif-attribution | assignments | Insert |
| notif-observation | observations | Insert |
| notif-candidature | profiles | Insert |
| notif-temoignage | testimonies | Insert |

Pour chacun : **Type = Supabase Edge Functions**, fonction **notify**, méthode **POST**,
et ajoute l'en-tête **x-webhook-secret** = la même valeur que `WEBHOOK_SECRET`.

### Activer l'envoi depuis l'admin
Dans `js/config.js`, mets `EMAIL_REPLIES_ENABLED = true`, puis envoie sur GitHub.
Le bouton **Envoyer le courriel** apparaît dans l'onglet Observations.

### Ce que contiennent les courriels (Loi 25)
- Aux intercesseurs et à l'admin : **jamais** le texte de la demande ni de nom,
  seulement le code (YE-XXXX) et un lien vers le portail, qui demande une connexion.
- À la personne qui a prié : le message que tu as relu et validé.
