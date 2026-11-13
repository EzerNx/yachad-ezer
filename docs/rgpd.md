# RGPD et lois internationales : ce qui est en place, ce qui reste à faire

Yachad Ezer est hébergé au Canada, mais des personnes écrivent depuis plusieurs pays.
Dès qu'une personne de l'Union européenne envoie une demande, le **RGPD** s'applique
à ce traitement (art. 3.2 : on « offre un service » à des personnes de l'UE, dans leur langue).
Ce document complète `docs/loi25.md` (Québec). Ce n'est pas un avis juridique.

## Pourquoi c'est sensible

Une demande de prière révèle souvent des **convictions religieuses**, parfois la **santé**.
Pour le RGPD, ce sont des « catégories particulières » (art. 9) : interdites par défaut,
permises avec le **consentement explicite** de la personne. C'est la base légale choisie.

## Registre des traitements (art. 30)

| Traitement | Personnes | Données | Base légale | Durée | Où |
|---|---|---|---|---|---|
| Demandes de prière | Personnes qui demandent la prière | Texte, langue, prénom (facultatif), courriel ou téléphone (si réponse souhaitée) | Consentement explicite (art. 6.1.a, 9.2.a) | 6 mois, puis effacement automatique | Supabase, Canada |
| Témoignages | Mêmes personnes | Texte, prénom affiché | Consentement (art. 6.1.a, 9.2.a) | Tant que publié ; refusés : 30 jours | Supabase, Canada |
| Équipe d'intercession | Candidats et intercesseurs | Nom, courriel, Église, motivation, langues, pays, fuseau, disponibilités, observations | Consentement + engagement de l'équipe (art. 9.2.d possible pour un organisme religieux à but non lucratif) | Tant que membre ; refusés : 30 jours | Supabase, Canada |
| Réponses par courriel | Personnes qui l'ont demandé | Adresse, message | Consentement | Le temps de l'envoi (journal Brevo) | Brevo, France |
| Anti-spam | Visiteurs qui envoient | Empreinte salée de l'adresse IP | Intérêt légitime (art. 6.1.f) | 24 heures | Supabase, Canada |

Sous-traitants : **Supabase** (base de données, Canada), **Brevo** (courriels, France),
**GitHub Pages** (pages du site, sans données des formulaires).

## Droits des personnes : comment ils sont respectés

| Droit | Pour la personne qui demande la prière | Pour l'intercesseur |
|---|---|---|
| Accès, portabilité (art. 15, 20) | « Télécharger mes données » sur sa page de suivi | « Mon compte » → Mes données |
| Rectification (art. 16) | Sur demande au responsable | « Mon compte » → Mon profil, courriel, mot de passe |
| Effacement (art. 17) | « Supprimer ma demande » sur sa page de suivi | « Mon compte » → Supprimer mon compte |
| Retrait du consentement (art. 7.3) | Supprimer sa demande | Supprimer son compte |
| Plainte (art. 77) | Autorité de son pays (CNIL en France…) ou CAI au Québec | Idem |

## Transferts hors de l'UE (art. 44 à 49)

La décision d'adéquation de l'UE pour le Canada couvre les organisations soumises à la loi
fédérale **LPRPDE** (activités commerciales). Un ministère de prière à but non lucratif
n'est probablement pas couvert. Le transfert repose donc sur le **consentement explicite,
après information du risque** (art. 49.1.a) : c'est écrit dans la section « Où sont vos données ».

## Âge minimum

Le site demande **14 ans ou plus**, ou l'âge du pays s'il est plus élevé (art. 8 : de 13 à 16 ans
selon les pays de l'UE, par exemple 15 ans en France, 16 ans en Allemagne et en Irlande).
Les intercesseurs doivent avoir 18 ans.

## Minimisation : ce qu'on ne demande pas

Ni profession, ni âge exact, ni adresse, ni téléphone de l'intercesseur, ni religion.
Le fuseau horaire sert seulement à lire les disponibilités. Après l'inscription,
les détails sont retirés des métadonnées du compte (ils ne restent que dans le profil).

## Traduction des demandes

Le bouton « Traduire » utilise le traducteur **intégré à Chrome**, qui fonctionne sur l'appareil.
Le texte n'est envoyé à aucun service. Les intercesseurs sont avertis de ne pas coller une
demande dans un site de traduction en ligne.

## Analyse d'impact (AIPD, art. 35) : résumé à compléter

Une AIPD est attendue : données sensibles (religion, santé) à grande échelle possible.

| Risque | Mesures en place | Risque restant |
|---|---|---|
| Un intercesseur reconnaît une personne | Code au lieu du nom, consigne « pas de nom complet », engagement signé | Faible |
| Fuite de la base | RLS testée (130+ tests), identité séparée du texte, purge à 6 mois | Faible à moyen |
| Lien de suivi partagé par erreur | Jeton long et aléatoire, la base ne garde que son empreinte, avertissement | Faible |
| Compte d'intercesseur volé | Mot de passe actuel exigé pour le changer, autres appareils déconnectés | Moyen : ajouter l'authentification à 2 facteurs quand l'équipe grandit |

## À faire par toi

1. Remplir `PRIVACY_OFFICER` dans `js/config.js`.
2. Si tu reçois beaucoup de demandes de l'UE : désigner un **représentant dans l'UE** (art. 27).
   Une exemption existe pour un traitement « occasionnel », mais elle ne vaut pas pour des
   données religieuses à grande échelle. Avec peu de demandes, garde une trace de leur nombre.
3. Signer l'accord de traitement des données (DPA) de Supabase et de Brevo (dans leurs tableaux de bord).
4. Faire relire les traductions par des personnes de langue maternelle (voir `js/lang/`).
