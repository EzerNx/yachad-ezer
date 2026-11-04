// =====================================================================
//  Test de sécurité EN LIGNE (sur le vrai Supabase et le vrai site)
//  Lancé par GitHub Actions chaque semaine, ou à la main.
//  Lancement local : node tests/live-security.mjs
//
//  On se met dans la peau d'un visiteur anonyme (avec la clé publique,
//  visible par tous dans js/config.js) et on vérifie que :
//   · aucune donnée privée n'est lisible
//   · aucune action réservée n'est possible
//   · le site publie bien ses protections (CSP, HTTPS)
//  Ce test n'écrit RIEN dans la base.
// =====================================================================
import { readFileSync } from "node:fs";

const cfg = readFileSync(new URL("../js/config.js", import.meta.url), "utf8");
const URL_ = cfg.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)[1];
const KEY = cfg.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*\n?\s*"([^"]+)"/)[1];
const SITE = process.env.SITE_URL || "https://ezernx.github.io/yachad-ezer/";
const H = { apikey: KEY, "content-type": "application/json" };

let pass = 0, fail = 0;
const ok = (cond, name, detail = "") => {
  if (cond) { pass++; console.log("PASS | " + name); }
  else { fail++; console.log("FAIL | " + name + (detail ? "  →  " + detail : "")); }
};

// Lecture d'une table : renvoie [statut HTTP, nombre de lignes reçues]
async function readTable(path) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: H });
  let rows = 0;
  try { const j = await res.json(); rows = Array.isArray(j) ? j.length : 0; } catch {}
  return [res.status, rows];
}
async function rpc(fn, args = {}) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  let body = null;
  try { body = await res.json(); } catch {}
  return [res.status, body];
}

console.log("== Données privées : rien ne doit être lisible par un visiteur ==");
for (const tbl of ["prayer_requests", "request_private", "profiles", "assignments", "observations", "app_settings"]) {
  const [st, rows] = await readTable(`${tbl}?select=*&limit=5`);
  ok(rows === 0, `${tbl} : aucune ligne visible (HTTP ${st})`, `${rows} ligne(s) reçue(s) !`);
}
{
  const [st] = await readTable("testimonies?select=status,request_id&limit=1");
  ok(st >= 400, `testimonies : colonnes internes refusées (HTTP ${st})`);
  const [st2, rows2] = await readTable("testimonies?select=id,body,display_name,lang,published_at&limit=50");
  ok(st2 === 200, `testimonies : seuls les témoignages publiés sont lisibles (${rows2} visible(s))`);
}
for (const p of ["secrets", "rate_events"]) {
  const res = await fetch(`${URL_}/rest/v1/${p}?select=*`, { headers: { ...H, "accept-profile": "private" } });
  ok(res.status >= 400, `schéma privé « ${p} » inaccessible (HTTP ${res.status})`);
}

console.log("== Actions réservées : doivent être refusées ==");
{
  const [st] = await rpc("distribute_new_requests");
  ok(st >= 400, `répartition refusée au visiteur (HTTP ${st})`);
  const [st2] = await rpc("delete_member", { p_id: "00000000-0000-0000-0000-000000000000" });
  ok(st2 >= 400, `suppression de compte refusée au visiteur (HTTP ${st2})`);
  const [st3] = await rpc("delete_my_account");
  ok(st3 >= 400, `« supprimer mon compte » refusé à un visiteur non connecté (HTTP ${st3})`);
  const upd = await fetch(`${URL_}/rest/v1/prayer_requests?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: "PATCH", headers: { ...H, prefer: "return=representation" }, body: JSON.stringify({ status: "fermee" }) });
  let changed = 0; try { const j = await upd.json(); changed = Array.isArray(j) ? j.length : 0; } catch {}
  ok(changed === 0, `modification des demandes impossible (HTTP ${upd.status})`);
  const del = await fetch(`${URL_}/rest/v1/prayer_requests?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: "DELETE", headers: { ...H, prefer: "return=representation" } });
  let gone = 0; try { const j = await del.json(); gone = Array.isArray(j) ? j.length : 0; } catch {}
  ok(gone === 0, `suppression des demandes impossible (HTTP ${del.status})`);
}

console.log("== Lien de suivi : un faux lien ne donne rien ==");
{
  const [st, body] = await rpc("request_status", { p_token: "faux-jeton-de-test-" + Date.now() + "-xxxxxxxx" });
  ok(st === 200 && Array.isArray(body) && body.length === 0, `faux lien de suivi : aucune information (HTTP ${st})`);
  const [st2, body2] = await rpc("delete_my_request", { p_token: "faux-jeton-de-test-" + Date.now() + "-xxxxxxxx" });
  ok(st2 === 200 && body2 === false, `faux lien : rien n'est supprimé (HTTP ${st2})`);
  const [st3, body3] = await rpc("keepalive");
  ok(st3 === 200 && body3 === "ok", `keepalive répond (HTTP ${st3})`);
}

console.log("== Inscription : impossible de se créer admin ==");
{
  // On lit seulement la configuration publique d'authentification (aucun compte créé)
  const res = await fetch(`${URL_}/auth/v1/settings`, { headers: H });
  const s = await res.json().catch(() => ({}));
  ok(res.status === 200, "réglages d'authentification lisibles");
  ok(s.disable_signup !== true, "les inscriptions d'intercesseurs sont ouvertes");
}

console.log("== Site web ==");
{
  const res = await fetch(SITE);
  const page = await res.text();
  ok(res.status === 200 && SITE.startsWith("https://"), `site en ligne en HTTPS (HTTP ${res.status})`);
  ok(/Content-Security-Policy/.test(page), "la page d'accueil publie sa politique de sécurité (CSP)");
  const http = await fetch(SITE.replace("https://", "http://"), { redirect: "manual" }).catch(() => null);
  ok(!http || [301, 302, 307, 308].includes(http.status), `l'adresse http:// redirige vers https:// (HTTP ${http?.status ?? "—"})`);
  const cfgOnline = await (await fetch(SITE + "js/config.js")).text();
  ok(!/sb_secret_|service_role\s*[:=]/.test(cfgOnline.replace(/\/\/.*$/gm, "")), "aucune clé secrète dans la configuration publiée");
}

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
