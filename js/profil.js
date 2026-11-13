// =====================================================================
//  Outils partagés pour le profil des intercesseurs :
//  langues parlées, pays, fuseau horaire, disponibilités pour prier.
//
//  Les NOMS des langues et des pays ne sont pas traduits à la main :
//  le navigateur les connaît déjà dans toutes les langues (Intl.DisplayNames).
//  « es » s'affiche « espagnol » en français, « Spanish » en anglais, etc.
// =====================================================================
import { h, t } from "./app.js?v=8";

// Les 10 langues du site d'abord, puis d'autres langues très parlées dans les Églises
export const SPOKEN = ["fr", "en", "es", "pt", "sw", "ht", "de", "ru", "zh", "ko",
                       "ar", "it", "ln", "hi", "tl", "vi", "yo", "am"];

// Codes pays ISO 3166-1 (2 lettres)
export const COUNTRIES = ("AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS " +
  "MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS " +
  "RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW").split(" ");

function displayNames(type) {
  try { return new Intl.DisplayNames([window.YE.locale(), "en"], { type, fallback: "code" }); }
  catch { return { of: (c) => c }; }
}
export const languageName = (code) => {
  const n = displayNames("language").of(code) || code;
  return n.charAt(0).toLocaleUpperCase(window.YE.locale()) + n.slice(1);
};
export const countryName = (code) => (code ? displayNames("region").of(code) || code : "");

// Le fuseau horaire de cet appareil, ex. « America/Toronto »
export const deviceTimezone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto"; } catch { return "America/Toronto"; }
};
export function timezones() {
  try { return Intl.supportedValuesOf("timeZone"); } catch { return [deviceTimezone()]; }
}

// Pays probable d'après la langue de l'appareil (« fr-CA » → CA). Seulement une suggestion.
export function guessCountry() {
  const m = /-([A-Z]{2})$/i.exec(navigator.language || "");
  return m && COUNTRIES.includes(m[1].toUpperCase()) ? m[1].toUpperCase() : "";
}

// ---------- Champs du formulaire ----------

// Cases à cocher pour les langues parlées (au moins une, au plus 8)
export function languagePicker(selected, idPrefix = "lng") {
  const box = h("div", { class: "choices" });
  const value = () => [...box.querySelectorAll("input:checked")].map((i) => i.value);
  function draw() {
    const chosen = new Set(box.childElementCount ? value() : selected);   // on garde les cases déjà cochées
    box.replaceChildren(...SPOKEN.map((c) =>
      h("label", { class: "chip" },
        h("input", { type: "checkbox", name: idPrefix, value: c, id: idPrefix + "-" + c, checked: chosen.has(c) }),
        h("span", { lang: c }, languageName(c)))));
  }
  draw();
  return { el: box, value, redraw: draw };
}

// Liste des pays, triée selon la langue affichée
export function countrySelect(id, current) {
  const sel = h("select", { id });
  function draw() {
    const keep = sel.value || current || "";
    const coll = new Intl.Collator(window.YE.locale());
    const opts = COUNTRIES.map((c) => [c, countryName(c)]).sort((a, b) => coll.compare(a[1], b[1]));
    sel.replaceChildren(h("option", { value: "" }, "—"), ...opts.map(([c, n]) => h("option", { value: c }, n)));
    sel.value = keep;
  }
  draw();
  return { el: sel, value: () => sel.value, redraw: draw };
}

export function timezoneSelect(id, current) {
  const sel = h("select", { id });
  const list = timezones();
  const cur = current || deviceTimezone();
  if (!list.includes(cur)) list.unshift(cur);
  sel.replaceChildren(...list.map((z) => h("option", { value: z }, z.replace(/_/g, " "))));
  sel.value = cur;
  return { el: sel, value: () => sel.value };
}

// ---------- Disponibilités ----------
// Une ligne = « jour · de · à ». Le jour 0 veut dire « tous les jours ».
// Les heures sont gardées en minutes depuis minuit (6 h 30 → 390).
export const MAX_SLOTS = 28;
const toTime = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const toMin = (v) => { const [hh, mm] = String(v || "").split(":").map(Number); return Number.isFinite(hh) ? hh * 60 + (mm || 0) : NaN; };

// Nom d'un jour dans la langue affichée (1 = lundi … 7 = dimanche)
export function dayName(d, style = "long") {
  const monday = new Date(Date.UTC(2024, 0, 1, 12));   // le 1er janvier 2024 était un lundi
  return new Intl.DateTimeFormat(window.YE.locale(), { weekday: style, timeZone: "UTC" })
    .format(new Date(monday.getTime() + (d - 1) * 86400000));
}
export const fmtSlot = (s) => dayName(s.weekday, "short") + " " + toTime(s.start_min) + "–" + (s.end_min === 1440 ? "24:00" : toTime(s.end_min));

// Regroupe les créneaux identiques des 7 jours en une ligne « tous les jours »
function compact(slots) {
  const rows = [];
  const key = (s) => s.start_min + "-" + s.end_min;
  const byTime = {};
  slots.forEach((s) => { (byTime[key(s)] ||= new Set()).add(s.weekday); });
  const done = new Set();
  slots.forEach((s) => {
    const k = key(s);
    if (byTime[k].size === 7) { if (!done.has(k)) { rows.push({ day: 0, start: s.start_min, end: s.end_min }); done.add(k); } }
    else rows.push({ day: s.weekday, start: s.start_min, end: s.end_min });
  });
  return rows;
}

export function availabilityEditor(initial = []) {
  let rows = compact(initial);
  const list = h("div", { class: "slots" });
  const err = h("span", { class: "err", hidden: true, role: "alert" });
  const add = h("button", { type: "button", class: "btn btn-ghost btn-sm", style: "align-self:flex-start" });
  const el = h("div", { class: "stack", style: "gap:10px" }, list, add, err);

  function draw() {
    add.textContent = "+ " + t("dispo.add");
    list.replaceChildren(...rows.map((r, i) => {
      const day = h("select", { "aria-label": t("dispo.day") },
        h("option", { value: "0" }, t("dispo.every")),
        ...[1, 2, 3, 4, 5, 6, 7].map((d) => h("option", { value: String(d) }, dayName(d))));
      day.value = String(r.day);
      day.addEventListener("change", () => { r.day = Number(day.value); });
      const from = h("input", { type: "time", step: "900", value: toTime(r.start), "aria-label": t("dispo.from") });
      from.addEventListener("change", () => { r.start = toMin(from.value); });
      const to = h("input", { type: "time", step: "900", value: r.end === 1440 ? "00:00" : toTime(r.end), "aria-label": t("dispo.to") });
      to.addEventListener("change", () => { const m = toMin(to.value); r.end = m === 0 ? 1440 : m; });
      const del = h("button", { type: "button", class: "btn btn-ghost btn-sm", "aria-label": t("dispo.remove"), title: t("dispo.remove") }, "✕");
      del.addEventListener("click", () => { rows.splice(i, 1); draw(); });
      return h("div", { class: "slot" }, day, h("span", { class: "hint" }, t("dispo.from")), from, h("span", { class: "hint" }, t("dispo.to")), to, del);
    }));
  }
  add.addEventListener("click", () => { rows.push({ day: 0, start: 20 * 60, end: 21 * 60 }); draw(); });

  // Renvoie la liste à enregistrer, ou null (avec un message) si quelque chose ne va pas
  function value() {
    err.hidden = true;
    const out = new Map();
    for (const r of rows) {
      if (!Number.isFinite(r.start) || !Number.isFinite(r.end) || r.end <= r.start) { err.textContent = t("dispo.err.order"); err.hidden = false; return null; }
      (r.day === 0 ? [1, 2, 3, 4, 5, 6, 7] : [r.day]).forEach((d) =>
        out.set(d + "-" + r.start, { weekday: d, start_min: r.start, end_min: r.end }));
    }
    if (out.size > MAX_SLOTS) { err.textContent = t("dispo.err.max", { n: MAX_SLOTS }); err.hidden = false; return null; }
    return [...out.values()];
  }

  draw();
  return { el, value, redraw: draw };
}

// ---------- Tableau de couverture (admin) ----------
// Un créneau est écrit dans le fuseau de l'intercesseur (ex. lundi 6 h à Port-au-Prince).
// Pour l'admin, on le convertit dans le fuseau de SON appareil, heure par heure.

// Décalage (en minutes) d'un fuseau à un instant donné
function tzOffset(date, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()) / 60000;
}

// Renvoie les cases « jour-heure » (dans le fuseau de l'appareil) couvertes par ce créneau
export function slotCells(slot, tz) {
  const now = new Date();
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const cells = new Set();
  for (let m = slot.start_min; m < slot.end_min; m += 15) {
    const wall = monday + ((slot.weekday - 1) * 1440 + m) * 60000;   // heure « affichée » chez l'intercesseur
    let utc = wall;
    try { utc = wall - tzOffset(new Date(wall), tz) * 60000; } catch { /* fuseau inconnu : on garde l'heure telle quelle */ }
    const local = new Date(utc);
    cells.add(((local.getDay() + 6) % 7 + 1) + "-" + local.getHours());
  }
  return cells;
}
