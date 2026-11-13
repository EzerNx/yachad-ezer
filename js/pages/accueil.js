// Script de la page index.html (page publique)
import { sb, configured, showConfigWarning, t, lang, onLangChange, h, relDate,
         isRateLimited, randomToken, sha256Hex, copyText, PRIVACY_OFFICER } from "../app.js?v=8";

const $ = (id) => document.getElementById(id);
const loadedAt = Date.now();
let lastWantsContact = null;
showConfigWarning($("prayerForm"));

// ---------- Responsable Loi 25 (vient de config.js) ----------
function renderOfficer() {
  const box = $("officer");
  box.textContent = "";
  if (PRIVACY_OFFICER.name && PRIVACY_OFFICER.email) {
    box.append(h("b", {}, PRIVACY_OFFICER.name), " · ", h("b", {}, PRIVACY_OFFICER.email));
  } else {
    box.append(h("b", {}, t("privacy.officer.missing")));
  }
}
renderOfficer();

// ---------- Formulaire ----------
const text = $("f-text");

// Langue de la demande : par défaut celle du site, la personne peut la changer.
// (Les noms des langues sont écrits dans chaque langue : « Español », « 한국어 »…)
const langSel = $("f-lang");
let langTouched = false;
function fillLangs() {
  langSel.replaceChildren(...window.YE.langs().map((c) => h("option", { value: c, lang: c }, window.YE.langName(c))));
  if (!langTouched) langSel.value = lang();
}
langSel.addEventListener("change", () => { langTouched = true; });
fillLangs();
text.addEventListener("input", () => { $("charCount").textContent = text.value.length + " / 1500"; });
$("f-wantContact").addEventListener("change", (e) => { $("contactBox").hidden = !e.target.checked; });
document.querySelectorAll('input[name="via"]').forEach((r) => r.addEventListener("change", () => {
  const tel = $("via-tel").checked;
  $("telField").hidden = !tel;
  $("mailField").hidden = tel;
}));

// Validation : on vérifie ici pour aider la personne,
// et la base revérifie (contraintes CHECK) pour la sécurité.
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const telOk = (v) => { const d = v.replace(/\D/g, ""); return d.length >= 10 && d.length <= 15; };
const show = (id, on) => { $(id).hidden = !on; return on; };

function validate() {
  let bad = false;
  bad = show("err-text", text.value.trim().length < 5) || bad;
  if ($("f-wantContact").checked) {
    const tel = $("via-tel").checked;
    const val = (tel ? $("f-tel") : $("f-email")).value.trim();
    bad = show("err-contact", !(tel ? telOk(val) : emailOk(val))) || bad;
    bad = show("err-consentContact", !$("f-consentContact").checked) || bad;
  } else {
    show("err-contact", false); show("err-consentContact", false);
  }
  bad = show("err-consent", !$("f-consent").checked) || bad;
  bad = show("err-age", !$("f-age").checked) || bad;
  return !bad;
}

function thanksText() {
  if (lastWantsContact === null) return;
  $("thanksText").textContent = t(lastWantsContact ? "thanks.contact" : "thanks.nocontact");
}

function finish(wantsContact, followUrl) {
  lastWantsContact = wantsContact;
  thanksText();
  $("followBox").hidden = !followUrl;
  if (followUrl) {
    $("followUrl").value = followUrl;
    $("followOpen").href = followUrl;
  }
  $("prayerForm").reset();
  langTouched = false;
  langSel.value = lang();
  $("contactBox").hidden = true;
  $("charCount").textContent = "0 / 1500";
  $("formSection").hidden = true;
  $("thanks").hidden = false;
  $("thanks").scrollIntoView({ behavior: "smooth", block: "center" });
}

function sendError(key) {
  const el = $("err-send");
  el.setAttribute("data-i18n", key);
  el.textContent = t(key);
  show("err-send", true);
}

$("prayerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  show("err-send", false);
  if (!validate()) {
    document.querySelector(".err:not([hidden])")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const wants = $("f-wantContact").checked;

  // Anti-robot simple : champ piège rempli, ou envoi en moins de 3 secondes.
  // (La base a aussi son propre anti-spam : 5 envois par heure et par personne.)
  if ($("f-website").value || Date.now() - loadedAt < 3000) { finish(wants, null); return; }

  if (!configured || !sb) { sendError("f.notconfigured"); return; }

  const btn = $("submitBtn");
  btn.disabled = true; btn.textContent = t("sending");
  try {
    // On crée l'identifiant ici pour pouvoir y rattacher l'identité juste après.
    const id = crypto.randomUUID();
    const needs = [...document.querySelectorAll('input[name="need"]:checked')].map((i) => i.value);

    // Lien de suivi : le jeton reste chez la personne, la base ne reçoit que son empreinte.
    const token = randomToken();
    const followHash = await sha256Hex(token);

    const row = {
      id,
      body: text.value.trim(),
      needs: needs.length ? needs : ["priere"],
      wants_contact: wants,
      age_confirmed: true,
      lang: langSel.value || lang(),
      follow_hash: followHash,
    };
    let { error } = await sb.from("prayer_requests").insert(row);
    let followUrl = new URL("suivi.html#t=" + token, location.href).href;
    // Si la migration 002 n'est pas encore faite, on envoie sans les nouvelles colonnes.
    if (error && error.code === "PGRST204") {
      delete row.lang; delete row.follow_hash; followUrl = null;
      ({ error } = await sb.from("prayer_requests").insert(row));
    }
    if (error) throw error;

    const firstName = $("f-name").value.trim();
    if (firstName || wants) {
      const tel = $("via-tel").checked;
      const { error: e2 } = await sb.from("request_private").insert({
        request_id: id,
        first_name: firstName,
        contact_method: wants ? (tel ? "telephone" : "courriel") : null,
        contact_value: wants ? (tel ? $("f-tel") : $("f-email")).value.trim() : null,
        contact_consent_at: wants ? new Date().toISOString() : null,
      });
      if (e2) throw e2;
    }
    finish(wants, followUrl);
  } catch (err) {
    console.error(err);
    sendError(isRateLimited(err) ? "err.spam" : "f.send.err");
  } finally {
    btn.disabled = false; btn.textContent = t("f.submit");
  }
});

$("followCopy").addEventListener("click", () =>
  copyText($("followUrl").value, $("followUrl"), t("follow.copied"), t("follow.copySel")));

$("againBtn").addEventListener("click", () => {
  $("thanks").hidden = true;
  $("formSection").hidden = false;
  text.focus();
});

// ---------- Témoignages publiés ----------
let testimonies = [];
function renderTestimonies() {
  const section = $("temoignages");
  section.hidden = testimonies.length === 0;
  $("tstList").replaceChildren(...testimonies.map((x) => h("figure", { class: "tst", lang: x.lang || "fr" },
    h("blockquote", {}, x.body),
    h("figcaption", {}, (x.display_name || t("tst.anon")) + " · " + relDate(x.published_at)))));
}
async function loadTestimonies() {
  if (!sb) return;
  const { data, error } = await sb.from("testimonies")
    .select("id, body, display_name, lang, published_at")
    .order("published_at", { ascending: false })
    .limit(6);
  if (error) return;   // table absente (migration pas faite) : on n'affiche rien
  testimonies = data || [];
  renderTestimonies();
}
loadTestimonies();

onLangChange(() => { thanksText(); renderOfficer(); renderTestimonies(); if (!langTouched) langSel.value = lang(); });
