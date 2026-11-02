// Outils partagés par toutes les pages
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const configured =
  !SUPABASE_URL.includes("TON-PROJET") && !SUPABASE_PUBLISHABLE_KEY.includes("A_REMPLACER");

// Le client Supabase (null tant que config.js n'est pas rempli)
export const sb = configured && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

export const NEEDS = {
  priere: "Prière",
  suivi: "Suivi",
  conseil: "Conseil",
  orientation: "Orientation spirituelle",
};

export const STATUS = { nouvelle: "Nouvelle", assignee: "Attribuée", fermee: "Fermée" };

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
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });

let toastTimer;
export function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = h("div", { class: "toast", role: "status" }); document.body.append(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

// Traduit les erreurs techniques en phrases compréhensibles
export function explain(error) {
  const m = (error && error.message) || "";
  if (/Invalid login credentials/i.test(m)) return "Courriel ou mot de passe incorrect.";
  if (/Email not confirmed/i.test(m)) return "Confirmez d'abord votre courriel avec le lien reçu.";
  if (/already registered/i.test(m)) return "Ce courriel a déjà un compte. Connectez-vous.";
  if (/Password should be/i.test(m)) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (/rate limit/i.test(m)) return "Trop d'essais. Attendez quelques minutes.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Pas de connexion Internet. Réessayez.";
  return "Une erreur est survenue. Réessayez dans un moment.";
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
  container.prepend(h("p", { class: "notice warn" },
    "Le site n'est pas encore relié à Supabase. Remplis js/config.js (voir le README)."));
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
export function relDate(iso) {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return "le " + d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}
