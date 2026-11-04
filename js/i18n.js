// =====================================================================
//  Yachad Ezer — langues (FR / EN) et thème (clair / sombre)
//
//  Comment ça marche :
//   * Chaque texte a une « clé » et deux versions : [français, anglais].
//   * Dans le HTML, un élément avec data-i18n="cle" reçoit le bon texte.
//     data-i18n-html : le texte contient un peu de HTML (gras, lien).
//     data-i18n-attr="placeholder:cle" : traduit un attribut.
//   * Dans le JavaScript, t("cle") renvoie le texte dans la bonne langue.
//   * Le choix (langue et thème) est gardé dans le navigateur (localStorage).
//
//  Pour ajouter un texte : ajoute une ligne ici, puis utilise sa clé.
// =====================================================================
(function () {
  "use strict";

  var D = {
    // ---------- Commun ----------
    "nav.vision": ["Notre vision", "Our vision"],
    "nav.join": ["Devenir intercesseur", "Become an intercessor"],
    "nav.team": ["Espace équipe", "Team area"],
    "nav.privacy": ["Confidentialité", "Privacy"],
    "prefs.langGroup": ["Langue", "Language"],
    "prefs.darkMode": ["Mode sombre", "Dark mode"],
    "logout": ["Sortir", "Sign out"],
    "logout.long": ["Se déconnecter", "Sign out"],
    "config.missing": ["Le site n’est pas encore relié à Supabase. Remplis js/config.js (voir le README).", "This site isn’t connected to Supabase yet. Fill in js/config.js (see the README)."],
    "date.today": ["aujourd’hui", "today"],
    "date.yesterday": ["hier", "yesterday"],
    "date.on": ["le {date}", "on {date}"],
    "contact.mail": ["Courriel", "Email"],
    "contact.tel": ["Téléphone", "Phone"],
    "role.admin": ["Administrateur", "Administrator"],
    "role.int": ["Intercesseur", "Intercessor"],
    "need.priere": ["Prière", "Prayer"],
    "need.suivi": ["Suivi", "Follow-up"],
    "need.conseil": ["Conseil", "Advice"],
    "need.orientation": ["Orientation spirituelle", "Spiritual guidance"],
    "st.nouvelle": ["Nouvelle", "New"],
    "st.assignee": ["Attribuée", "Assigned"],
    "st.fermee": ["Fermée", "Closed"],
    "err.login": ["Courriel ou mot de passe incorrect.", "Incorrect email or password."],
    "err.notconfirmed": ["Confirmez d’abord votre courriel avec le lien reçu.", "Please confirm your email first with the link you received."],
    "err.registered": ["Ce courriel a déjà un compte. Connectez-vous.", "This email already has an account. Please sign in."],
    "err.password": ["Le mot de passe doit contenir au moins 8 caractères.", "The password must be at least 8 characters."],
    "err.rate": ["Trop d’essais. Attendez quelques minutes.", "Too many attempts. Please wait a few minutes."],
    "err.network": ["Pas de connexion Internet. Réessayez.", "No Internet connection. Please try again."],
    "err.generic": ["Une erreur est survenue. Réessayez dans un moment.", "Something went wrong. Please try again in a moment."],
    "sending": ["Envoi…", "Sending…"],

    // ---------- Versets ----------
    "v.gal": ["Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ.", "Bear ye one another’s burdens, and so fulfil the law of Christ."],
    "v.gal.ref": ["Galates 6.2 · Louis Segond 1910", "Galatians 6:2 · King James Version"],
    "v.mat": ["« Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos. »", "“Come unto me, all ye that labour and are heavy laden, and I will give you rest.”"],
    "v.mat.ref": ["Matthieu 11.28 · Louis Segond 1910", "Matthew 11:28 · King James Version"],
    "v.phil": ["« Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu par des prières. »", "“Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.”"],
    "v.phil.ref": ["Philippiens 4.6 · Louis Segond 1910", "Philippians 4:6 · King James Version"],
    "v.jac": ["« Priez les uns pour les autres. La prière agissante du juste a une grande efficacité. »", "“Pray one for another… The effectual fervent prayer of a righteous man availeth much.”"],
    "v.jac.ref": ["Jacques 5.16 · Louis Segond 1910", "James 5:16 · King James Version"],
    "v.eze": ["« Je cherche parmi eux un homme qui élève un mur, qui se tienne à la brèche devant moi en faveur du pays… »", "“And I sought for a man among them, that should make up the hedge, and stand in the gap before me for the land…”"],
    "v.eze.ref": ["Ézéchiel 22.30 · Louis Segond 1910", "Ezekiel 22:30 · King James Version"],

    // ---------- Page publique ----------
    "idx.title": ["Yachad Ezer · Requêtes de prière", "Yachad Ezer · Prayer requests"],
    "idx.desc": ["Confiez votre sujet de prière à l’équipe d’intercession Yachad Ezer. Ensemble, nous portons les fardeaux les uns des autres.", "Share your prayer request with the Yachad Ezer intercession team. Together, we bear one another’s burdens."],
    "hero.small": ["ENSEMBLE · SECOURS", "TOGETHER · HELP"],
    "hero.h1": ["Vous n’avez pas à porter cela <em>seul</em>.", "You don’t have to carry this <em>alone</em>."],
    "hero.lead": ["Confiez votre sujet de prière à une équipe d’intercesseurs qui s’engage à prier pour vous. Avec respect, dans la confidentialité.", "Share your prayer request with a team of intercessors committed to praying for you. With respect, in confidence."],
    "hero.cta": ["Confier une demande", "Share a prayer request"],
    "trust.1": ["Anonyme si vous le voulez", "Anonymous if you wish"],
    "trust.2": ["Votre nom n’est jamais montré", "Your name is never shown"],
    "trust.3": ["Conforme à la Loi 25", "Compliant with Quebec’s Law 25"],
    "praise.alt": ["Des personnes lèvent les mains vers la lumière", "People raising their hands toward the light"],
    "steps.eyebrow": ["Comment ça marche", "How it works"],
    "steps.title": ["Trois étapes, en toute confidence", "Three steps, in confidence"],
    "steps.1.t": ["Vous écrivez", "You write"],
    "steps.1.p": ["Votre sujet de prière, avec ou sans votre prénom. Le contact est facultatif.", "Your prayer request, with or without your first name. Contact details are optional."],
    "steps.2.t": ["Des intercesseurs prient", "Intercessors pray"],
    "steps.2.p": ["Ils reçoivent votre demande avec un code, comme YE-7KQ3. Jamais votre nom.", "They receive your request with a code, like YE-7KQ3. Never your name."],
    "steps.3.t": ["Une réponse, si vous le voulez", "A reply, if you wish"],
    "steps.3.p": ["Ce qu’ils ont reçu en priant vous est transmis, avec un suivi ou un conseil.", "What they received in prayer is passed on to you, with follow-up or advice."],
    "vision.title": ["Tenir les bras levés", "Holding up the arms"],
    "vision.p1": ["Pendant la bataille, les bras de Moïse devenaient lourds. Aaron et Hur se sont placés de chaque côté et les ont soutenus jusqu’au coucher du soleil (Exode 17.12).", "During the battle, Moses’ hands grew heavy. Aaron and Hur stood on each side and held them up until the going down of the sun (Exodus 17:12)."],
    "vision.p2": ["C’est notre appel : soutenir ceux qui n’ont plus la force de prier seuls.", "This is our calling: to support those who no longer have the strength to pray alone."],
    "form.eyebrow": ["Votre demande", "Your request"],
    "form.title": ["Confiez-nous votre sujet de prière", "Share your prayer request with us"],
    "form.intro": ["Écrivez librement. Votre demande sera lue avec respect et portée devant Dieu.", "Write freely. Your request will be read with respect and brought before God."],
    "f.trap": ["Ne pas remplir", "Do not fill in"],
    "f.name": ["Votre prénom <span class=\"hint\">· facultatif</span>", "Your first name <span class=\"hint\">· optional</span>"],
    "f.name.ph": ["Laissez vide pour rester anonyme", "Leave blank to stay anonymous"],
    "f.text": ["Votre sujet de prière", "Your prayer request"],
    "f.text.hint": ["Un prénom suffit pour les autres personnes. Évitez les noms complets et les détails médicaux.", "A first name is enough for other people. Avoid full names and medical details."],
    "f.text.ph": ["Ex. : Priez pour ma mère qui commence un traitement la semaine prochaine, et pour que je garde la paix.", "E.g. Please pray for my mother, who starts treatment next week, and that I keep my peace."],
    "f.text.err": ["Écrivez au moins quelques mots pour que nous sachions comment prier.", "Write at least a few words so we know how to pray."],
    "needs.legend": ["Ce que vous souhaitez", "What you would like"],
    "chip.priere": ["Que l’on prie pour moi", "Prayer for me"],
    "chip.suivi": ["Un suivi", "Follow-up"],
    "chip.conseil": ["Un conseil", "Advice"],
    "chip.orientation": ["Une orientation spirituelle", "Spiritual guidance"],
    "f.want": ["<b>Je souhaite qu’on me recontacte</b><br><span class=\"hint\">Pour recevoir ce que les intercesseurs ont reçu en priant, un suivi ou un conseil.</span>", "<b>I would like to be contacted</b><br><span class=\"hint\">To receive what the intercessors received in prayer, follow-up or advice.</span>"],
    "contact.legend": ["Comment vous joindre ?", "How can we reach you?"],
    "f.tel": ["Numéro de téléphone", "Phone number"],
    "f.email.ph": ["nom@exemple.com", "name@example.com"],
    "contact.err": ["Ce moyen de contact ne semble pas valide. Vérifiez-le.", "This contact detail doesn’t look valid. Please check it."],
    "contact.consent": ["J’accepte que Yachad Ezer utilise ce moyen de contact <b>uniquement</b> pour répondre à ma demande.", "I agree that Yachad Ezer may use this contact detail <b>only</b> to respond to my request."],
    "contact.consent.err": ["Ce consentement est nécessaire pour qu’on puisse vous recontacter.", "We need this consent to be able to contact you."],
    "f.consent": ["J’ai lu « Vos renseignements personnels » plus bas. J’accepte que ma demande, qui peut révéler mes croyances, soit lue par l’équipe et conservée au plus 6 mois.", "I have read “Your personal information” below. I agree that my request, which may reveal my beliefs, may be read by the team and kept for no more than 6 months."],
    "f.consent.err": ["Votre consentement est nécessaire pour envoyer la demande.", "Your consent is needed to send the request."],
    "f.age": ["J’ai 14 ans ou plus. <span class=\"hint\">Moins de 14 ans : demande à un parent de remplir ce formulaire avec toi.</span>", "I am 14 or older. <span class=\"hint\">Under 14: ask a parent to fill in this form with you.</span>"],
    "f.age.err": ["Confirmez votre âge, ou demandez l’aide d’un parent.", "Please confirm your age, or ask a parent for help."],
    "f.submit": ["Confier ma demande", "Send my request"],
    "f.send.err": ["L’envoi n’a pas fonctionné. Vérifiez votre connexion puis réessayez.", "Sending didn’t work. Check your connection and try again."],
    "f.notconfigured": ["Le site n’est pas encore relié à Supabase.", "This site isn’t connected to Supabase yet."],
    "thanks.title": ["Votre demande est entre de bonnes mains.", "Your request is in good hands."],
    "thanks.contact": ["Des intercesseurs vont prier pour vous. Nous vous recontacterons comme vous l’avez demandé.", "Intercessors will pray for you. We will contact you as you requested."],
    "thanks.nocontact": ["Des intercesseurs vont prier pour vous. Personne ne vous contactera.", "Intercessors will pray for you. No one will contact you."],
    "thanks.again": ["Envoyer une autre demande", "Send another request"],
    "privacy.eyebrow": ["Loi 25 · Québec", "Law 25 · Quebec"],
    "privacy.title": ["Vos renseignements personnels", "Your personal information"],
    "privacy.1.s": ["Ce que nous recueillons", "What we collect"],
    "privacy.1.b": ["Votre sujet de prière, un prénom si vous le donnez, et un courriel ou un numéro seulement si vous demandez à être recontacté. Rien d’autre.", "Your prayer request, a first name if you give one, and an email or phone number only if you ask to be contacted. Nothing else."],
    "privacy.2.s": ["Pourquoi", "Why"],
    "privacy.2.b": ["Pour prier pour vous et, si vous le demandez, vous transmettre une réponse, un suivi ou un conseil. Pas d’infolettre, pas de publicité, aucune vente ni partage.", "To pray for you and, if you ask, to send you a reply, follow-up or advice. No newsletter, no advertising, no selling or sharing."],
    "privacy.3.s": ["Qui y a accès", "Who has access"],
    "privacy.3.b": ["Les intercesseurs voient le texte de la demande avec un code, jamais votre nom ni vos coordonnées. Seul l’administrateur peut voir votre prénom et vos coordonnées. Chaque intercesseur a signé un engagement de confidentialité. Les données sont hébergées par Supabase au Canada, possiblement hors du Québec.", "Intercessors see the text of the request with a code, never your name or contact details. Only the administrator can see your first name and contact details. Every intercessor has signed a confidentiality pledge. Data is hosted by Supabase in Canada, possibly outside Quebec."],
    "privacy.4.s": ["Combien de temps", "How long"],
    "privacy.4.b": ["Au plus 6 mois. Ensuite, la demande, vos coordonnées et les notes des intercesseurs sont supprimées automatiquement.", "At most 6 months. After that, the request, your contact details and the intercessors’ notes are deleted automatically."],
    "privacy.5.s": ["Vos droits", "Your rights"],
    "privacy.5.b": ["<ul><li>Demander à consulter, corriger ou supprimer vos renseignements.</li><li>Retirer votre consentement en tout temps.</li><li>Porter plainte à la Commission d’accès à l’information du Québec.</li></ul>", "<ul><li>Ask to access, correct or delete your information.</li><li>Withdraw your consent at any time.</li><li>File a complaint with the Commission d’accès à l’information du Québec.</li></ul>"],
    "privacy.6.s": ["Responsable de la protection des renseignements personnels", "Person in charge of protecting personal information"],
    "privacy.6.b": ["Écrivez-lui en indiquant la date de votre demande. En cas d’incident de confidentialité présentant un risque de préjudice sérieux, nous avisons les personnes concernées et la Commission d’accès à l’information.", "Write to them and include the date of your request. If a confidentiality incident poses a risk of serious harm, we notify the people concerned and the Commission d’accès à l’information."],

    // ---------- Connexion ----------
    "login.title": ["Espace équipe · Yachad Ezer", "Team area · Yachad Ezer"],
    "login.side": ["Espace réservé à l’équipe d’intercession", "Reserved for the intercession team"],
    "login.h1": ["Connexion", "Sign in"],
    "login.notyet": ["Pas encore membre ? <a href=\"devenir-intercesseur.html\">Devenir intercesseur</a>", "Not a member yet? <a href=\"devenir-intercesseur.html\">Become an intercessor</a>"],
    "login.pass": ["Mot de passe", "Password"],
    "login.submit": ["Se connecter", "Sign in"],
    "wait.title": ["Candidature en attente", "Application pending"],
    "wait.text": ["Merci, {name}. L’administrateur examine votre candidature. Vous aurez accès à vos demandes dès qu’elle sera acceptée.", "Thank you, {name}. The administrator is reviewing your application. You will have access to your requests as soon as it is accepted."],
    "wait.refused.title": ["Candidature non retenue", "Application not accepted"],
    "wait.refused.text": ["Votre candidature n’a pas été retenue pour le moment. Merci pour votre cœur de servir.", "Your application was not accepted at this time. Thank you for your heart to serve."],
    "wait.paused.title": ["Compte en pause", "Account paused"],
    "wait.paused.text": ["Votre accès est en pause. Contactez l’administrateur si vous souhaitez reprendre.", "Your access is paused. Contact the administrator if you would like to resume."],

    // ---------- Devenir intercesseur ----------
    "join.title": ["Devenir intercesseur · Yachad Ezer", "Become an intercessor · Yachad Ezer"],
    "join.member": ["Déjà membre ? <a href=\"connexion.html\">Se connecter</a>", "Already a member? <a href=\"connexion.html\">Sign in</a>"],
    "join.eyebrow": ["Rejoindre l’équipe", "Join the team"],
    "join.intro": ["Vous recevrez des demandes de prière avec un code, jamais le nom de la personne. Après avoir prié, vous pourrez écrire ce que vous avez reçu. L’administrateur relit chaque observation avant de la transmettre.", "You will receive prayer requests with a code, never the person’s name. After praying, you can write what you received. The administrator reviews every note before passing it on."],
    "join.name": ["Votre nom", "Your name"],
    "join.name.hint": ["Visible seulement par l’administrateur.", "Visible only to the administrator."],
    "join.pass.hint": ["Au moins 8 caractères.", "At least 8 characters."],
    "join.church": ["Votre église ou communauté <span class=\"hint\">· facultatif</span>", "Your church or community <span class=\"hint\">· optional</span>"],
    "join.motivation": ["Pourquoi souhaitez-vous servir dans la prière ?", "Why would you like to serve in prayer?"],
    "join.pledge": ["Engagement de confidentialité", "Confidentiality pledge"],
    "join.p1": ["Je garde secret tout ce que je lis dans les demandes.", "I keep everything I read in the requests secret."],
    "join.p2": ["Je ne cherche jamais à savoir qui se cache derrière un code.", "I never try to find out who is behind a code."],
    "join.p3": ["Je ne copie, ne photographie ni ne partage aucune demande.", "I never copy, photograph or share any request."],
    "join.p4": ["Je prie fidèlement pour les demandes qui me sont confiées.", "I pray faithfully for the requests entrusted to me."],
    "join.pledge.ok": ["Je m’engage à respecter ces règles.", "I commit to following these rules."],
    "join.consent": ["J’accepte que Yachad Ezer conserve mon nom, mon courriel et ma candidature pour gérer l’équipe d’intercession, tant que je suis membre. Je peux demander leur suppression en tout temps.", "I agree that Yachad Ezer may keep my name, email and application to manage the intercession team while I am a member. I can ask for them to be deleted at any time."],
    "join.age": ["J’ai 18 ans ou plus.", "I am 18 or older."],
    "join.submit": ["Envoyer ma candidature", "Send my application"],
    "join.done.h": ["Merci pour votre cœur de servir.", "Thank you for your heart to serve."],
    "join.done.p": ["Ouvrez le courriel que nous venons de vous envoyer et cliquez sur le lien pour confirmer votre adresse. L’administrateur examinera ensuite votre candidature. Vous pourrez vous connecter dès qu’elle sera acceptée.", "Open the email we just sent you and click the link to confirm your address. The administrator will then review your application. You can sign in as soon as it is accepted."],
    "join.home": ["Retour à l’accueil", "Back to home"],
    "join.e.name": ["Indiquez votre nom.", "Please enter your name."],
    "join.e.email": ["Ce courriel ne semble pas valide.", "This email doesn’t look valid."],
    "join.e.motivation": ["Dites-nous en quelques mots pourquoi vous voulez servir.", "Tell us in a few words why you want to serve."],
    "join.e.pledge": ["L’engagement de confidentialité est nécessaire.", "The confidentiality pledge is required."],
    "join.e.consent": ["Votre consentement est nécessaire.", "Your consent is required."],
    "join.e.age": ["Les intercesseurs doivent avoir 18 ans ou plus.", "Intercessors must be 18 or older."],

    // ---------- Portail intercesseur ----------
    "m.title": ["Mes demandes · Yachad Ezer", "My requests · Yachad Ezer"],
    "m.side": ["Intercession", "Intercession"],
    "m.todo": ["À prier", "To pray"],
    "m.done": ["Déjà priées", "Prayed"],
    "m.obs": ["Mes observations", "My notes"],
    "m.admin": ["Admin", "Admin"],
    "m.hello": ["Bonjour {name}", "Hello {name}"],
    "m.loading": ["Chargement de vos demandes…", "Loading your requests…"],
    "m.waiting.one": ["1 demande vous attend. Merci de tenir les bras levés.", "1 request is waiting for you. Thank you for holding up the arms."],
    "m.waiting.many": ["{n} demandes vous attendent. Merci de tenir les bras levés.", "{n} requests are waiting for you. Thank you for holding up the arms."],
    "m.none": ["Aucune demande en attente. Merci pour votre fidélité.", "No requests waiting. Thank you for your faithfulness."],
    "m.loadErr": ["Impossible de charger vos demandes. Réessayez plus tard.", "Couldn’t load your requests. Please try again later."],
    "m.empty.obs": ["Vous n’avez pas encore écrit d’observation.", "You haven’t written any notes yet."],
    "m.empty.todo": ["Aucune demande en attente pour l’instant.", "No requests waiting for now."],
    "m.empty.done": ["Aucune demande priée pour l’instant.", "No prayed requests yet."],
    "obs.st.sent": ["Envoyée", "Sent"],
    "obs.st.read": ["Lue par l’admin", "Read by admin"],
    "obs.st.transmitted": ["Transmise", "Passed on"],
    "m.wantsReply": ["Souhaite une réponse", "Would like a reply"],
    "m.entrusted": ["Confiée {when}", "Assigned {when}"],
    "m.obs.ph": ["Ce que vous avez reçu en priant : un encouragement, un verset, une image…", "What you received in prayer: encouragement, a verse, an image…"],
    "m.obs.write": ["Écrire une observation", "Write a note"],
    "m.obs.another": ["Écrire une autre observation", "Write another note"],
    "m.obs.send": ["Envoyer à l’administrateur", "Send to the administrator"],
    "m.obs.emptyToast": ["Écrivez votre observation avant d’envoyer.", "Write your note before sending."],
    "m.obs.sendErr": ["L’envoi n’a pas fonctionné. Réessayez.", "Sending didn’t work. Please try again."],
    "m.obs.sent": ["Observation envoyée à l’administrateur.", "Note sent to the administrator."],
    "m.pray": ["J’ai prié pour cette demande", "I prayed for this request"],
    "m.unpray": ["Remettre dans « À prier »", "Move back to “To pray”"],
    "m.saveErr": ["Impossible d’enregistrer. Réessayez.", "Couldn’t save. Please try again."],
    "m.prayedToast": ["Merci d’avoir porté cette demande.", "Thank you for carrying this request."],
    "m.unprayedToast": ["Demande remise dans « À prier ».", "Request moved back to “To pray”."],
    "m.yourObs": ["Votre observation · {when}", "Your note · {when}"],
    "m.transmittedSuffix": [" · transmise", " · passed on"],
    "m.prayedOn": ["Priée le {date}", "Prayed on {date}"],

    // ---------- Portail admin ----------
    "a.title": ["Portail admin · Yachad Ezer", "Admin portal · Yachad Ezer"],
    "a.side": ["Administration", "Administration"],
    "a.prayer": ["Prière", "Prayer"],
    "a.nav.requests": ["Demandes", "Requests"],
    "a.nav.obs": ["Observations", "Notes"],
    "a.nav.members": ["Intercesseurs", "Intercessors"],
    "a.nav.settings": ["Réglages", "Settings"],
    "a.loading": ["Chargement…", "Loading…"],
    "a.loadErr": ["Impossible de charger les données. Vérifiez votre connexion.", "Couldn’t load the data. Check your connection."],
    "a.actionErr": ["Action impossible : {msg}", "Action failed: {msg}"],
    "a.req.title": ["Demandes de prière", "Prayer requests"],
    "a.req.hello": ["Bonjour {name}.", "Hello {name}."],
    "a.req.waitOne": ["1 demande attend un intercesseur.", "1 request is waiting for an intercessor."],
    "a.req.waitMany": ["{n} demandes attendent un intercesseur.", "{n} requests are waiting for an intercessor."],
    "a.req.allAssigned": ["Toutes les demandes ont un intercesseur.", "Every request has an intercessor."],
    "a.distribute": ["Répartir les demandes", "Distribute requests"],
    "a.distribute.err": ["Répartition impossible : {msg}", "Distribution failed: {msg}"],
    "a.distribute.done": ["{n} attribution(s) faite(s).", "{n} assignment(s) made."],
    "a.distribute.none": ["Aucune attribution : pas de demande en attente ou pas d’intercesseur actif.", "No assignments: no waiting requests or no active intercessors."],
    "a.t.open": ["demandes ouvertes", "open requests"],
    "a.t.unassigned": ["sans intercesseur", "without an intercessor"],
    "a.t.obs": ["observations à lire", "notes to read"],
    "a.t.active": ["intercesseurs actifs", "active intercessors"],
    "a.f.label": ["Filtrer les demandes", "Filter requests"],
    "a.f.open": ["Ouvertes", "Open"],
    "a.f.unassigned": ["Sans intercesseur", "No intercessor"],
    "a.f.closed": ["Fermées", "Closed"],
    "a.f.all": ["Toutes", "All"],
    "a.req.empty": ["Aucune demande ici pour l’instant.", "No requests here yet."],
    "a.add": ["Ajouter un intercesseur…", "Add an intercessor…"],
    "a.add.aria": ["Ajouter un intercesseur à {code}", "Add an intercessor to {code}"],
    "a.assigned": ["Demande attribuée.", "Request assigned."],
    "a.reopen": ["Rouvrir", "Reopen"],
    "a.close": ["Fermer", "Close"],
    "a.reopened": ["Demande rouverte.", "Request reopened."],
    "a.closed": ["Demande fermée.", "Request closed."],
    "a.delete": ["Supprimer", "Delete"],
    "a.delete.q": ["Supprimer la demande, l’identité et les observations ?", "Delete the request, the identity and the notes?"],
    "a.delete.yes": ["Oui, supprimer", "Yes, delete"],
    "a.cancel": ["Annuler", "Cancel"],
    "a.deleted": ["Demande supprimée.", "Request deleted."],
    "a.noone": ["Aucun intercesseur pour l’instant", "No intercessor yet"],
    "a.remove.aria": ["Retirer {name}", "Remove {name}"],
    "a.removed": ["Intercesseur retiré.", "Intercessor removed."],
    "a.hasPrayed": [" · a prié", " · prayed"],
    "a.received": ["Reçue {when} · supprimée le {date}", "Received {when} · deleted on {date}"],
    "a.person": ["Personne", "Person"],
    "a.anon": ["Anonyme", "Anonymous"],
    "a.missingContact": ["Contact demandé, coordonnées manquantes", "Contact requested, details missing"],
    "a.noContact": ["Ne souhaite pas être contactée", "Does not wish to be contacted"],
    "a.obs.title": ["Observations", "Notes"],
    "a.obs.sub": ["Ce que les intercesseurs ont reçu en priant. Relisez avant de transmettre.", "What intercessors received in prayer. Review before passing it on."],
    "a.of.label": ["Filtrer les observations", "Filter notes"],
    "a.of.todo": ["À traiter", "To handle"],
    "a.of.sent": ["Transmises", "Passed on"],
    "a.obs.empty": ["Aucune observation ici.", "No notes here."],
    "a.reply.label": ["Réponse à {name} · {contact}", "Reply to {name} · {contact}"],
    "a.reply.someone": ["la personne", "the person"],
    "a.reply.hintTel": ["Appelez ou textez ce numéro. Le texte ci-dessous peut vous guider.", "Call or text this number. The text below can guide you."],
    "a.reply.hintMail": ["Relisez et ajustez avant d’envoyer. Le nom de l’intercesseur n’apparaît pas.", "Review and adjust before sending. The intercessor’s name does not appear."],
    "a.reply.lang": ["Langue de la réponse", "Reply language"],
    "a.copy": ["Copier le message", "Copy message"],
    "a.copied": ["Message copié.", "Message copied."],
    "a.copySel": ["Sélectionné : faites Ctrl+C.", "Selected: press Ctrl+C."],
    "a.openMail": ["Ouvrir dans ma messagerie", "Open in my email app"],
    "a.markSent": ["Marquer comme transmise", "Mark as passed on"],
    "a.markedSent": ["Observation marquée comme transmise.", "Note marked as passed on."],
    "a.markRead": ["Marquer comme lue", "Mark as read"],
    "a.obs.st.new": ["Nouvelle", "New"],
    "a.obs.st.sentOn": ["Transmise le {date}", "Passed on {date}"],
    "a.obs.st.read": ["Lue", "Read"],
    "a.obs.by": ["Par {name} · {when}", "By {name} · {when}"],
    "a.seeRequest": ["Voir la demande", "See the request"],
    "a.obs.noDetails": ["Contact demandé, mais aucune coordonnée enregistrée.", "Contact requested, but no details were saved."],
    "a.obs.internal": ["Cette personne n’a pas demandé de réponse : l’observation reste interne.", "This person didn’t ask for a reply: the note stays internal."],
    "reply.greet.name": ["Bonjour {name},", "Hello {name},"],
    "reply.greet": ["Bonjour,", "Hello,"],
    "reply.body": ["Vous nous avez confié un sujet de prière (référence {code}). Nous avons prié pour vous, et voici ce qu’un intercesseur a reçu :", "You shared a prayer request with us (reference {code}). We prayed for you, and here is what an intercessor received:"],
    "reply.end": ["Nous continuons de vous porter dans la prière.\n\nL’équipe Yachad Ezer", "We continue to carry you in prayer.\n\nThe Yachad Ezer team"],
    "reply.subject": ["Votre demande de prière · Yachad Ezer", "Your prayer request · Yachad Ezer"],
    "a.m.sub": ["Acceptez les candidatures et gérez l’équipe.", "Accept applications and manage the team."],
    "a.m.cand": ["Candidatures", "Applications"],
    "a.m.team": ["Équipe", "Team"],
    "a.m.noCand": ["Aucune candidature en attente.", "No pending applications."],
    "a.m.accept": ["Accepter", "Accept"],
    "a.m.refuse": ["Refuser", "Decline"],
    "a.m.accepted": ["Candidature acceptée.", "Application accepted."],
    "a.m.refused": ["Candidature refusée.", "Application declined."],
    "a.m.noName": ["Sans nom", "No name"],
    "a.m.noChurch": ["Église non indiquée", "Church not given"],
    "a.m.signedUp": ["Inscrit {when}", "Signed up {when}"],
    "a.m.noMotivation": ["Pas de motivation indiquée.", "No motivation given."],
    "a.m.pledgeOk": ["Engagement de confidentialité accepté", "Confidentiality pledge accepted"],
    "a.m.pledgeNo": ["Engagement non accepté", "Pledge not accepted"],
    "a.m.you": [" (vous)", " (you)"],
    "a.m.load": ["{n} à prier", "{n} to pray"],
    "a.m.active": ["Actif", "Active"],
    "a.m.paused": ["En pause", "Paused"],
    "a.m.pause": ["Mettre en pause", "Pause"],
    "a.m.resume": ["Réactiver", "Reactivate"],
    "a.m.pausedToast": ["Membre mis en pause.", "Member paused."],
    "a.m.resumedToast": ["Membre réactivé.", "Member reactivated."],
    "a.m.member": ["Membre", "Member"],
    "a.s.sub": ["Comment les demandes sont réparties entre les intercesseurs.", "How requests are distributed among intercessors."],
    "a.s.explain": ["Chaque nouvelle demande est confiée aux intercesseurs actifs qui ont le moins de demandes à prier en ce moment. En cas d’égalité, le choix se fait au hasard. Vous pouvez toujours ajouter ou retirer un intercesseur à la main.", "Each new request is assigned to the active intercessors who currently have the fewest requests to pray for. Ties are broken at random. You can always add or remove an intercessor by hand."],
    "a.s.auto": ["Répartir automatiquement", "Distribute automatically"],
    "a.s.auto.hint": ["Dès qu’une demande arrive. Sinon, utilisez le bouton « Répartir » dans Demandes.", "As soon as a request arrives. Otherwise, use the “Distribute” button in Requests."],
    "a.s.per": ["Nombre d’intercesseurs par demande", "Intercessors per request"],
    "a.s.save": ["Enregistrer", "Save"],
    "a.s.saved": ["Réglages enregistrés.", "Settings saved."],

    // ---------- Anti-spam ----------
    "err.spam": ["Trop d’envois en peu de temps. Réessayez dans une heure.", "Too many submissions in a short time. Please try again in an hour."],

    // ---------- Lien de suivi (après l'envoi) ----------
    "follow.title": ["Votre lien de suivi privé", "Your private follow-up link"],
    "follow.explain": ["Gardez ce lien précieusement : c’est la seule façon de voir combien de personnes ont prié pour vous, de partager un témoignage ou de supprimer votre demande. Nous ne pouvons pas le retrouver pour vous.", "Keep this link safe: it is the only way to see how many people prayed for you, share a testimony or delete your request. We cannot recover it for you."],
    "follow.copy": ["Copier le lien", "Copy link"],
    "follow.copied": ["Lien copié.", "Link copied."],
    "follow.copySel": ["Lien sélectionné : faites Ctrl+C (ou Copier).", "Link selected: press Ctrl+C (or Copy)."],
    "follow.open": ["Ouvrir ma page de suivi", "Open my follow-up page"],

    // ---------- Page de suivi ----------
    "s.title": ["Suivi de ma demande · Yachad Ezer", "My request · Yachad Ezer"],
    "s.eyebrow": ["Suivi privé", "Private follow-up"],
    "s.h1": ["Votre demande est portée", "Your request is being carried"],
    "s.loading": ["Recherche de votre demande…", "Looking for your request…"],
    "s.notfound.h": ["Lien introuvable", "Link not found"],
    "s.notfound.p": ["Ce lien ne correspond à aucune demande. Elle a peut-être été supprimée, ou elle a dépassé les 6 mois de conservation.", "This link doesn’t match any request. It may have been deleted, or it is past the 6-month retention period."],
    "s.code": ["Référence", "Reference"],
    "s.received": ["Reçue {when}", "Received {when}"],
    "s.expires": ["Supprimée automatiquement le {date}", "Automatically deleted on {date}"],
    "s.prayed.none": ["Votre demande vient d’être confiée. Des intercesseurs vont prier pour vous.", "Your request has just been assigned. Intercessors will pray for you."],
    "s.prayed.waiting": ["Votre demande attend un intercesseur. Elle sera confiée très bientôt.", "Your request is waiting for an intercessor. It will be assigned very soon."],
    "s.prayed.one": ["1 personne a prié pour vous.", "1 person has prayed for you."],
    "s.prayed.many": ["{n} personnes ont prié pour vous.", "{n} people have prayed for you."],
    "s.assigned": ["{n} intercesseur(s) portent votre demande.", "{n} intercessor(s) are carrying your request."],
    "s.reply": ["Une réponse vous a été transmise.", "A reply has been sent to you."],
    "s.closed": ["Cette demande est maintenant fermée.", "This request is now closed."],
    "s.t.h": ["Dieu a répondu ? Partagez un témoignage", "Has God answered? Share a testimony"],
    "s.t.p": ["Votre témoignage encouragera d’autres personnes. Il sera relu avant d’être publié, sans votre nom si vous le voulez.", "Your testimony will encourage others. It will be reviewed before being published, without your name if you wish."],
    "s.t.body": ["Votre témoignage", "Your testimony"],
    "s.t.name": ["Prénom à afficher <span class=\"hint\">· facultatif, sinon « Anonyme »</span>", "First name to display <span class=\"hint\">· optional, otherwise “Anonymous”</span>"],
    "s.t.consent": ["J’accepte que ce témoignage soit publié sur le site de Yachad Ezer. Je peux demander son retrait en tout temps.", "I agree that this testimony may be published on the Yachad Ezer website. I can ask for it to be removed at any time."],
    "s.t.send": ["Envoyer mon témoignage", "Send my testimony"],
    "s.t.sent": ["Merci ! Votre témoignage sera relu puis publié.", "Thank you! Your testimony will be reviewed and then published."],
    "s.t.errBody": ["Écrivez au moins quelques mots.", "Please write at least a few words."],
    "s.t.errConsent": ["Votre accord est nécessaire pour publier.", "Your agreement is needed to publish."],
    "s.del.h": ["Supprimer ma demande", "Delete my request"],
    "s.del.p": ["Votre demande, votre prénom, vos coordonnées et les notes des intercesseurs seront effacés définitivement.", "Your request, first name, contact details and the intercessors’ notes will be permanently erased."],
    "s.del.btn": ["Supprimer ma demande", "Delete my request"],
    "s.del.q": ["Effacer définitivement ? Cette action est irréversible.", "Permanently erase? This cannot be undone."],
    "s.del.yes": ["Oui, tout effacer", "Yes, erase everything"],
    "s.del.done": ["Votre demande a été effacée. Que Dieu vous garde.", "Your request has been erased. May God keep you."],
    "s.err": ["Une erreur est survenue. Réessayez dans un moment.", "Something went wrong. Please try again in a moment."],

    // ---------- Témoignages (page publique) ----------
    "tst.eyebrow": ["Prières exaucées", "Answered prayers"],
    "tst.title": ["Ils témoignent", "Their testimonies"],
    "tst.anon": ["Anonyme", "Anonymous"],

    // ---------- Mot de passe oublié ----------
    "pw.title": ["Mot de passe oublié · Yachad Ezer", "Forgot password · Yachad Ezer"],
    "pw.link": ["Mot de passe oublié ?", "Forgot your password?"],
    "pw.h1": ["Mot de passe oublié", "Forgot your password"],
    "pw.p": ["Entrez votre courriel. Si un compte existe, vous recevrez un lien pour choisir un nouveau mot de passe.", "Enter your email. If an account exists, you will receive a link to choose a new password."],
    "pw.send": ["Recevoir le lien", "Send me the link"],
    "pw.sent": ["Si un compte existe pour cette adresse, un courriel vient d’être envoyé. Pensez à regarder dans les indésirables.", "If an account exists for this address, an email has just been sent. Remember to check your spam folder."],
    "pw.new.h1": ["Nouveau mot de passe", "New password"],
    "pw.new.p": ["Choisissez un nouveau mot de passe d’au moins 8 caractères.", "Choose a new password of at least 8 characters."],
    "pw.new.label": ["Nouveau mot de passe", "New password"],
    "pw.new.confirm": ["Confirmez le mot de passe", "Confirm the password"],
    "pw.new.save": ["Enregistrer", "Save"],
    "pw.new.mismatch": ["Les deux mots de passe ne sont pas identiques.", "The two passwords don’t match."],
    "pw.new.done": ["Mot de passe changé. Vous pouvez vous connecter.", "Password changed. You can sign in."],
    "pw.back": ["Retour à la connexion", "Back to sign in"],

    // ---------- Portail intercesseur : mon compte ----------
    "m.account": ["Mon compte", "My account"],
    "m.acc.title": ["Mon compte", "My account"],
    "m.acc.notify": ["Recevoir un courriel quand une demande m’est confiée", "Email me when a request is assigned to me"],
    "m.acc.notify.saved": ["Préférence enregistrée.", "Preference saved."],
    "m.acc.del.h": ["Quitter l’équipe et supprimer mon compte", "Leave the team and delete my account"],
    "m.acc.del.p": ["Votre compte, votre profil, vos attributions et vos observations seront effacés définitivement.", "Your account, profile, assignments and notes will be permanently erased."],
    "m.acc.del.btn": ["Supprimer mon compte", "Delete my account"],
    "m.acc.del.q": ["Supprimer définitivement votre compte ?", "Permanently delete your account?"],
    "m.acc.del.yes": ["Oui, supprimer", "Yes, delete"],
    "m.acc.del.lastAdmin": ["Vous êtes le seul administrateur : nommez d’abord quelqu’un d’autre.", "You are the only administrator: appoint someone else first."],

    // ---------- Portail admin : témoignages, suppression, courriel ----------
    "a.nav.tst": ["Témoignages", "Testimonies"],
    "a.tst.sub": ["Relisez chaque témoignage avant de le publier sur la page d’accueil.", "Review each testimony before publishing it on the home page."],
    "a.tst.f.pending": ["En attente", "Pending"],
    "a.tst.f.published": ["Publiés", "Published"],
    "a.tst.f.refused": ["Refusés", "Declined"],
    "a.tst.empty": ["Aucun témoignage ici.", "No testimonies here."],
    "a.tst.publish": ["Publier", "Publish"],
    "a.tst.unpublish": ["Retirer de la page", "Unpublish"],
    "a.tst.refuse": ["Refuser", "Decline"],
    "a.tst.published": ["Témoignage publié.", "Testimony published."],
    "a.tst.unpublished": ["Témoignage retiré.", "Testimony unpublished."],
    "a.tst.refused": ["Témoignage refusé.", "Testimony declined."],
    "a.tst.deleted": ["Témoignage supprimé.", "Testimony deleted."],
    "a.tst.by": ["Signé : {name} · reçu {when}", "Signed: {name} · received {when}"],
    "a.tst.st.en_attente": ["En attente", "Pending"],
    "a.tst.st.publie": ["Publié", "Published"],
    "a.tst.st.refuse": ["Refusé", "Declined"],
    "a.m.deleteAcc": ["Supprimer le compte", "Delete account"],
    "a.m.delete.q": ["Supprimer définitivement ce compte et tout ce qui lui est lié ?", "Permanently delete this account and everything linked to it?"],
    "a.m.deleted": ["Compte supprimé.", "Account deleted."],
    "a.m.refusedList": ["Candidatures refusées", "Declined applications"],
    "a.m.refusedHint": ["Supprimées automatiquement 30 jours après l’inscription.", "Deleted automatically 30 days after sign-up."],
    "a.sendMail": ["Envoyer le courriel", "Send email"],
    "a.sendMail.sending": ["Envoi…", "Sending…"],
    "a.sendMail.done": ["Courriel envoyé et observation marquée comme transmise.", "Email sent and note marked as passed on."],
    "a.sendMail.err": ["Le courriel n’est pas parti : {msg}", "The email was not sent: {msg}"],
    "privacy.officer.missing": ["À compléter par l’administrateur", "To be completed by the administrator"]
  };

  // ---------- Langue ----------
  var lang = null;
  try { lang = localStorage.getItem("ye-lang"); } catch (e) {}
  if (lang !== "fr" && lang !== "en") lang = /^en/i.test(navigator.language || "") ? "en" : "fr";
  document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";

  function t(key, vars, forLang) {
    var entry = D[key];
    var s = entry ? entry[(forLang || lang) === "en" ? 1 : 0] : key;
    if (!entry && window.console) console.warn("Traduction manquante :", key);
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    root.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    root.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":");
        if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
  }

  function setLang(next) {
    lang = next === "en" ? "en" : "fr";
    try { localStorage.setItem("ye-lang", lang); } catch (e) {}
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    apply();
    renderPrefs();
    window.dispatchEvent(new Event("ye:lang"));   // les pages redessinent leurs textes
  }

  // ---------- Thème ----------
  function currentTheme() {
    var forced = document.documentElement.getAttribute("data-theme");
    if (forced === "dark" || forced === "light") return forced;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function setTheme(next) {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ye-theme", next); } catch (e) {}
    renderPrefs();
  }

  // ---------- Contrôles : pastille « FR | EN » + interrupteur soleil/lune ----------
  var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>';

  function renderPrefs() {
    var dark = currentTheme() === "dark";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0D1430" : "#FFFFFF");

    document.querySelectorAll("[data-prefs]").forEach(function (box) {
      box.classList.add("prefs");
      box.textContent = "";

      // Langue : deux boutons, celui de la langue actuelle est « appuyé »
      var group = document.createElement("div");
      group.className = "pref-lang";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", t("prefs.langGroup"));
      ["fr", "en"].forEach(function (code) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = code.toUpperCase();
        b.setAttribute("lang", code);
        b.setAttribute("aria-pressed", String(lang === code));
        b.title = code === "fr" ? "Français" : "English";
        b.addEventListener("click", function () { if (lang !== code) setLang(code); });
        group.appendChild(b);
      });

      var sep = document.createElement("span");
      sep.className = "pref-sep";
      sep.setAttribute("aria-hidden", "true");

      // Thème : un interrupteur (switch) avec soleil à gauche, lune à droite
      var sw = document.createElement("button");
      sw.type = "button";
      sw.className = "pref-theme";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-checked", String(dark));
      sw.setAttribute("aria-label", t("prefs.darkMode"));
      sw.title = t("prefs.darkMode");
      sw.innerHTML = '<span class="track">' + SUN + MOON + '<span class="knob">' + (dark ? MOON : SUN) + "</span></span>";
      sw.addEventListener("click", function () { setTheme(currentTheme() === "dark" ? "light" : "dark"); });

      box.append(group, sep, sw);
    });
  }

  // Si l'appareil change de thème et qu'aucun choix n'a été fait, on met à jour l'icône
  if (window.matchMedia) {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", renderPrefs);
  }

  window.YE = {
    t: t,
    lang: function () { return lang; },
    locale: function () { return lang === "en" ? "en-CA" : "fr-CA"; },
    setLang: setLang,
    apply: apply,
    keys: function () { return Object.keys(D); }
  };

  apply();
  renderPrefs();
})();
