// Outils partagés par toutes les pages
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js?v=8";
export { PRIVACY_OFFICER, EMAIL_REPLIES_ENABLED } from "./config.js?v=8";

export const configured =
  !SUPABASE_URL.includes("TON-PROJET") && !SUPABASE_PUBLISHABLE_KEY.includes("A_REMPLACER");

// Le client Supabase (null tant que config.js n'est pas rempli)
export const sb = configured && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// Traductions : voir js/i18n.js (chargé avant ce fichier)
export const t = (key, vars, forLang) => window.YE.t(key, vars, forLang);
export const lang = () => window.YE.lang();
export const onLangChange = (fn) => window.addEventListener("ye:lang", fn);

export const needLabel = (n) => t("need." + n);
export const statusLabel = (s) => t("st." + s);

// Petit constructeur d'éléments HTML.
// On passe le texte par textContent : impossible d'injecter du code (XSS).
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {   // accepte des listes dans des listes
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(window.YE.locale(), { day: "numeric", month: "long", year: "numeric" });

let toastTimer;
export function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = h("div", { class: "toast", role: "status" }); document.body.append(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// Traduit les erreurs techniques en phrases compréhensibles
export function explain(error) {
  const m = (error && error.message) || "";
  if (isRateLimited(error)) return t("err.spam");
  if (/Invalid login credentials/i.test(m)) return t("err.login");
  if (/Email not confirmed/i.test(m)) return t("err.notconfirmed");
  if (/already registered/i.test(m)) return t("err.registered");
  if (/should be different from the old/i.test(m)) return t("m.acc.pass.same");
  if (/Password should be|weak.?password/i.test(m)) return t("err.password");
  if (/invalid_timezone/i.test(m)) return t("err.tz");
  if (/too_many_slots/i.test(m)) return t("dispo.err.max", { n: 28 });
  if (/profiles_languages_check/i.test(m)) return t("join.e.langs");
  if (/rate limit/i.test(m)) return t("err.rate");
  if (/Failed to fetch|NetworkError/i.test(m)) return t("err.network");
  return t("err.generic");
}

export async function getMyProfile() {
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data } = await sb.from("profiles")
    .select("id, display_name, role, active").eq("id", session.user.id).maybeSingle();
  return data;
}

// Garde d'accès côté page : seulement pour l'affichage.
// La VRAIE protection est dans la base (RLS).
export async function requireRole(roles) {
  const me = await getMyProfile();
  if (!me || !me.active || !roles.includes(me.role)) {
    location.replace("connexion.html");
    return null;
  }
  return me;
}

export async function signOut() {
  if (sb) await sb.auth.signOut();
  location.replace("connexion.html");
}

export function showConfigWarning(container) {
  if (configured) return;
  container.prepend(h("p", { class: "notice warn", "data-i18n": "config.missing" }, t("config.missing")));
}

// L'anti-spam de la base répond « rate_limited »
export const isRateLimited = (error) => /rate_limited/i.test((error && (error.message || "")) || "");

// Jeton secret pour le lien de suivi : 32 octets aléatoires (impossible à deviner)
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Empreinte SHA-256 en hexadécimal : la base ne garde que ceci, jamais le jeton
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Copier un texte ; si le navigateur refuse, on sélectionne le champ
export async function copyText(text, field, okMsg, selMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { if (field) { field.focus(); field.select(); } toast(selMsg); }
}

// Initiales et couleur d'avatar (affichage seulement)
export const initials = (name) =>
  (name || "?").trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase() || "?";

export function avatar(id, name, extra = "") {
  const variants = ["", "b", "c", "d"];
  const n = [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % variants.length;
  return h("span", { class: ("avatar " + variants[n] + " " + extra).trim(), "aria-hidden": "true" }, initials(name));
}

// Dates relatives : « aujourd'hui », « hier », sinon la date
// Droit d'accès / portabilité : enregistre un objet comme fichier .json.
// Le fichier est fabriqué dans le navigateur : rien ne passe par un autre serveur.
export function downloadJson(obj, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function relDate(iso) {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return t("date.today");
  if (days === 1) return t("date.yesterday");
  return t("date.on", { date: d.toLocaleDateString(window.YE.locale(), { day: "numeric", month: "long" }) });
}

// Installation comme application (PWA) : le « service worker » garde les fichiers du site
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
