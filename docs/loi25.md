# Loi 25 : ce qui est en place, et ce qui reste à faire

> Ce document aide à s'organiser. Il ne remplace pas l'avis d'un juriste.
> Référence : Commission d'accès à l'information du Québec (cai.gouv.qc.ca).

## Déjà en place dans le site

| Obligation | Comment le site y répond |
|---|---|
| Consentement manifeste, libre et éclairé | Cases décochées par défaut, consentement séparé pour la demande et pour le contact |
| Renseignements sensibles (croyances) | Consentement exprès, mention claire dans le formulaire |
| Minimisation | Prénom facultatif, contact seulement si demandé, IP jamais stockée (empreinte effacée après 24 h) |
| Pseudonymisation | Les intercesseurs voient un code (YE-XXXX), jamais l'identité |
| Accès restreint | Règles RLS testées automatiquement (92 tests à chaque envoi sur GitHub) |
| Durée de conservation | Demandes : 6 mois. Candidats refusés : 30 jours. Suppression automatique chaque nuit |
| Droit à l'effacement | Lien de suivi privé : la personne efface sa demande elle-même. Intercesseurs : « Supprimer mon compte » |
| Transparence | Section « Vos renseignements personnels » sur la page d'accueil, en français et en anglais |
| Données au Canada | Projet Supabase dans la région Canada (Central) |
| Sécurité | HTTPS, politique CSP stricte, aucune ressource externe, mots de passe gérés par Supabase |

## À faire par toi

1. **Nommer le responsable** de la protection des renseignements personnels
   (par défaut, la personne la plus haute de l'organisation : toi).
   → Remplis `PRIVACY_OFFICER` dans `js/config.js`.
2. **Tenir le registre des incidents** (`docs/registre-incidents.md`), même vide.
3. **Évaluation des facteurs relatifs à la vie privée (EFVP)** : elle est exigée avant
   de communiquer des renseignements hors du Québec. Les données sont au Canada mais
   hors du Québec (Supabase, région Central). Rédige une courte EFVP (1 à 2 pages) :
   quelles données, pourquoi, qui y a accès, mesures de sécurité (le tableau plus haut),
   et la conclusion que la protection est adéquate. Garde-la avec ce document.
4. **Engagement des intercesseurs** : il est accepté à l'inscription. Rappelle-le
   lors de l'accueil de chaque nouveau membre.
5. **Si tu ajoutes un service** (ex. : Brevo pour les courriels), ajoute-le
   à la section « Qui y a accès » de la page d'accueil et à l'EFVP.
