// Script de la page suivi.html (lien privé de la personne qui a demandé la prière)
// Le jeton est dans l'adresse après « #t= ». La partie après # n'est jamais
// envoyée au serveur de GitHub : seul ce script la lit, puis la passe à Supabase.
import { sb, t, lang, h, relDate, fmtDate, onLangChange, isRateLimited, downloadJson } from "../app.js?v=8";

const $ = (id) => document.getElementById(id);
const token = new URLSearchParams(location.hash.slice(1)).get("t") || "";
let info = null;

function render() {
  if (!info) return;
  $("code").textContent = info.code;
  $("received").textContent = t("s.received", { when: relDate(info.created_at) });
  $("expires").textContent = t("s.expires", { date: fmtDate(info.expires_at) });
  $("bigCount").textContent = info.prayed_count > 0 ? String(info.prayed_count) : "";
  $("bigCount").hidden = info.prayed_count === 0;
  $("prayedText").textContent = info.prayed_count === 1 ? t("s.prayed.one")
    : info.prayed_count > 1 ? t("s.prayed.many", { n: info.prayed_count })
    : info.intercessor_count > 0 ? t("s.prayed.none") : t("s.prayed.waiting");
  $("assignedText").textContent = info.intercessor_count > 0 ? t("s.assigned", { n: info.intercessor_count }) : "";
  $("replyText").hidden = !info.reply_sent;
  $("replyText").textContent = t("s.reply");
  if (info.status === "fermee") $("assignedText").textContent = t("s.closed");
}

async function load() {
  if (!sb || token.length < 20) { show("notFound"); return; }
  const { data, error } = await sb.rpc("request_status", { p_token: token });
  if (error || !data || !data.length) { show("notFound"); return; }
  info = data[0];
  show("found");
  render();
}

function show(id) {
  ["loading", "notFound", "found", "deleted"].forEach((x) => { $(x).hidden = x !== id; });
}

// ---------- Témoignage ----------
$("tstForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("t-err");
  err.hidden = true;
  const body = $("t-body").value.trim();
  if (body.length < 10) { err.textContent = t("s.t.errBody"); err.hidden = false; return; }
  if (!$("t-consent").checked) { err.textContent = t("s.t.errConsent"); err.hidden = false; return; }
  const btn = $("t-btn");
  btn.disabled = true;
  const { error } = await sb.rpc("add_testimony", { p_token: token, p_body: body, p_name: $("t-name").value.trim(), p_lang: lang() });
  btn.disabled = false;
  if (error) { err.textContent = t(isRateLimited(error) ? "err.spam" : "s.err"); err.hidden = false; return; }
  $("tstForm").hidden = true;
  $("t-done").hidden = false;
});

// ---------- Télécharger mes données (droit d'accès et de portabilité) ----------
// Le fichier est fabriqué dans le navigateur : rien ne passe par un autre serveur.
$("exportBtn").addEventListener("click", async () => {
  const btn = $("exportBtn");
  $("x-err").hidden = true;
  btn.disabled = true;
  const { data, error } = await sb.rpc("request_export", { p_token: token });
  btn.disabled = false;
  if (error || !data) { $("x-err").textContent = t("s.err"); $("x-err").hidden = false; return; }
  downloadJson(data, "yachad-ezer-" + (data.request?.code || "demande") + ".json");
});

// ---------- Suppression (droit à l'effacement) ----------
const delBtn = $("delBtn");
delBtn.addEventListener("click", () => {
  const zone = $("delZone");
  const yes = h("button", { class: "btn btn-danger", type: "button" }, t("s.del.yes"));
  const no = h("button", { class: "btn btn-secondary", type: "button" }, t("a.cancel"));
  zone.replaceChildren(h("span", {}, t("s.del.q")), yes, no);
  no.addEventListener("click", () => zone.replaceChildren(delBtn));
  yes.addEventListener("click", async () => {
    yes.disabled = true;
    const { data, error } = await sb.rpc("delete_my_request", { p_token: token });
    if (error || !data) { zone.replaceChildren(h("span", { class: "err" }, t("s.err"))); return; }
    history.replaceState(null, "", location.pathname);   // on retire le jeton de l'adresse
    show("deleted");
  });
});

onLangChange(render);
load();
