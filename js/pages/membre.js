// Script de la page membre.html (portail intercesseur)
import { sb, h, fmtDate, relDate, toast, needLabel, requireRole, signOut, avatar, t, lang, onLangChange,
         explain, downloadJson } from "../app.js?v=8";
import { languagePicker, countrySelect, timezoneSelect, availabilityEditor } from "../profil.js?v=8";
import { translateButton } from "../traduire.js?v=8";

const me = await requireRole(["intercesseur", "admin"]);

let view = "todo";
let assignments = [];
let observations = [];
let notify = true;
let profile = null;     // mon profil (nom, Église, langues, pays, fuseau)
let slots = [];         // mes disponibilités
let acct = null;        // les champs de « Mon compte », créés une seule fois (on ne perd pas la saisie)
let loaded = false;
let loadFailed = false;
const drafts = {};   // texte en cours d'écriture, gardé si la page se redessine

if (me) {
  document.getElementById("meName").textContent = me.display_name || t("a.m.member");
  document.getElementById("meAvatar").replaceWith(avatar(me.id, me.display_name, "lg"));
  document.getElementById("adminLink").hidden = me.role !== "admin";
  document.querySelectorAll("[data-logout]").forEach((b) => b.addEventListener("click", signOut));
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
    view = b.dataset.view;
    document.querySelectorAll("[data-view]").forEach((x) => (x === b ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current")));
    render();
  }));
  onLangChange(render);
  renderHeader();
  await load();
}

function renderHeader() {
  document.getElementById("hello").textContent = view === "account" ? t("m.acc.title") : t("m.hello", { name: me.display_name || "" });
  document.getElementById("meRole").textContent = t(me.role === "admin" ? "role.admin" : "role.int");
  document.getElementById("verse").hidden = view === "account";
}

async function load() {
  // La base ne renvoie QUE les demandes attribuées à cette personne (règles RLS).
  const [a, o, p, av] = await Promise.all([
    sb.from("assignments")
      .select("id, assigned_at, prayed_at, request:prayer_requests(id, code, body, needs, wants_contact, status, created_at, lang)")
      .eq("member_id", me.id)
      .order("assigned_at", { ascending: false }),
    sb.from("observations")
      .select("id, request_id, body, status, created_at")
      .eq("member_id", me.id)
      .order("created_at"),
    sb.from("profiles").select("display_name, church, notify, languages, country, timezone").eq("id", me.id).maybeSingle(),
    sb.from("availability").select("weekday, start_min, end_min").eq("member_id", me.id).order("weekday").order("start_min"),
  ]);
  if (a.error || o.error) { loadFailed = true; render(); return; }
  assignments = a.data.filter((x) => x.request && x.request.status !== "fermee");
  observations = o.data;
  notify = p.error ? true : (p.data?.notify ?? true);   // colonne absente avant la migration 002
  profile = p.error ? null : p.data;                     // null si la migration 004 n'est pas faite
  slots = av.error ? [] : av.data;
  loaded = true;
  render();
}

function render() {
  renderHeader();
  const list = document.getElementById("list");
  if (loadFailed) { list.replaceChildren(h("p", { class: "err" }, t("m.loadErr"))); return; }
  if (!loaded) return;

  const todo = assignments.filter((a) => !a.prayed_at);
  const done = assignments.filter((a) => a.prayed_at);
  document.getElementById("c-todo").textContent = todo.length;
  document.getElementById("c-done").textContent = done.length;
  document.getElementById("c-todo").classList.toggle("hot", todo.length > 0);
  const sub = document.getElementById("subtitle");
  sub.removeAttribute("data-i18n");
  sub.textContent = view === "account" ? "" : todo.length
    ? t(todo.length === 1 ? "m.waiting.one" : "m.waiting.many", { n: todo.length })
    : t("m.none");

  if (view === "account") { list.replaceChildren(accountView()); return; }

  if (view === "obs") {
    if (!observations.length) { list.replaceChildren(h("p", { class: "empty" }, t("m.empty.obs"))); return; }
    const codeOf = (id) => assignments.find((a) => a.request.id === id)?.request.code || "—";
    list.replaceChildren(...observations.slice().reverse().map((o) => h("article", { class: "item" },
      h("div", { class: "item-head" },
        h("span", { class: "code" }, codeOf(o.request_id)),
        h("span", { class: o.status === "transmise" ? "pill ok" : "pill" },
          t(o.status === "transmise" ? "obs.st.transmitted" : o.status === "lue" ? "obs.st.read" : "obs.st.sent")),
        h("span", { class: "meta" }, relDate(o.created_at))),
      h("p", { class: "body" }, o.body))));
    return;
  }
  const items = view === "todo" ? todo : done;
  if (!items.length) {
    list.replaceChildren(h("p", { class: "empty" }, t(view === "todo" ? "m.empty.todo" : "m.empty.done")));
    return;
  }
  list.replaceChildren(...items.map(card));
}

// ---------- Mon compte ----------
// Chaque intercesseur gère lui-même ses informations (Loi 25 et RGPD :
// droit de rectification, d'accès, de portabilité et d'effacement).
// Les champs sont créés une seule fois : changer de langue ne vide pas la saisie.
function buildAccount() {
  const user = sb.auth.getSession().then(({ data }) => data.session?.user);
  const f = {
    name: h("input", { type: "text", id: "acc-name", maxlength: "80", autocomplete: "name", value: profile?.display_name ?? me.display_name ?? "" }),
    church: h("input", { type: "text", id: "acc-church", maxlength: "120", value: profile?.church ?? "" }),
    langs: languagePicker(profile?.languages?.length ? profile.languages : [lang()], "acc-lang"),
    country: countrySelect("acc-country", profile?.country ?? ""),
    tz: timezoneSelect("acc-tz", profile?.timezone),
    dispo: availabilityEditor(slots),
    email: h("input", { type: "email", id: "acc-email", maxlength: "120", autocomplete: "email" }),
    passOld: h("input", { type: "password", id: "acc-pass-old", autocomplete: "current-password" }),
    passNew: h("input", { type: "password", id: "acc-pass-new", minlength: "8", autocomplete: "new-password" }),
    passNew2: h("input", { type: "password", id: "acc-pass-new2", minlength: "8", autocomplete: "new-password" }),
    notify: h("input", { type: "checkbox", id: "acc-notify", checked: notify }),
    msg: { profile: msgBox(), dispo: msgBox(), email: msgBox(), pass: msgBox(), data: msgBox() },
  };
  user.then((u) => { f.currentEmail = u?.email || ""; f.email.value = f.currentEmail; });

  f.notify.addEventListener("change", async () => {
    const { error } = await sb.from("profiles").update({ notify: f.notify.checked }).eq("id", me.id);
    if (error) { f.notify.checked = !f.notify.checked; toast(t("m.saveErr")); return; }
    notify = f.notify.checked;
    toast(t("m.acc.notify.saved"));
  });
  return f;
}

// Petit message sous un bouton : vert si ça a marché, rouge sinon. Il reste affiché.
function msgBox() {
  const el = h("p", { role: "status", hidden: true });
  el.ok = (key, vars) => { el.className = "ok-msg"; el.textContent = t(key, vars); el.hidden = false; };
  el.err = (keyOrError) => {
    el.className = "err";
    el.textContent = typeof keyOrError === "string" ? t(keyOrError) : explain(keyOrError);
    el.hidden = false;
  };
  el.clear = () => { el.hidden = true; };
  return el;
}

async function saveProfile(btn) {
  const f = acct;
  f.msg.profile.clear();
  const name = f.name.value.trim();
  const languages = f.langs.value();
  if (name.length < 2) return f.msg.profile.err("join.e.name");
  if (languages.length < 1 || languages.length > 8) return f.msg.profile.err("join.e.langs");
  btn.disabled = true;
  const changes = { display_name: name, church: f.church.value.trim(), languages, country: f.country.value(), timezone: f.tz.value() };
  const { error } = await sb.from("profiles").update(changes).eq("id", me.id);
  btn.disabled = false;
  if (error) return f.msg.profile.err(error);
  profile = { ...profile, ...changes };
  me.display_name = name;
  document.getElementById("meName").textContent = name;
  f.msg.profile.ok("m.acc.saved");
}

async function saveDispo(btn) {
  const f = acct;
  f.msg.dispo.clear();
  const list = f.dispo.value();
  if (!list) return;   // le message d'erreur est déjà affiché sous les créneaux
  btn.disabled = true;
  const { error } = await sb.rpc("set_my_availability", { p_slots: list });
  btn.disabled = false;
  if (error) return f.msg.dispo.err(error);
  slots = list;
  f.msg.dispo.ok("m.acc.saved");
}

// Changer de courriel : Supabase envoie un lien de confirmation.
// Avec « Secure email change » (activé par défaut), il faut confirmer depuis l'ancienne ET la nouvelle adresse.
async function saveEmail(btn) {
  const f = acct;
  f.msg.email.clear();
  const email = f.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return f.msg.email.err("join.e.email");
  if (email.toLowerCase() === (f.currentEmail || "").toLowerCase()) return f.msg.email.err("m.acc.email.same");
  btn.disabled = true;
  const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: new URL("connexion.html", location.href).href });
  btn.disabled = false;
  if (error) return f.msg.email.err(error);
  f.msg.email.ok("m.acc.email.sent", { email });
}

// Changer de mot de passe : on vérifie d'abord l'ANCIEN (quelqu'un qui trouve
// un ordinateur resté connecté ne peut pas le changer), puis on déconnecte
// les autres appareils.
async function savePassword(btn) {
  const f = acct;
  f.msg.pass.clear();
  const oldP = f.passOld.value, newP = f.passNew.value, newP2 = f.passNew2.value;
  if (!oldP) return f.msg.pass.err("m.acc.pass.needOld");
  if (newP.length < 8) return f.msg.pass.err("err.password");
  if (newP !== newP2) return f.msg.pass.err("pw.new.mismatch");
  if (newP === oldP) return f.msg.pass.err("m.acc.pass.same");
  if (f.currentEmail && newP.toLowerCase().includes(f.currentEmail.split("@")[0].toLowerCase())) return f.msg.pass.err("m.acc.pass.weak");
  btn.disabled = true;
  try {
    const check = await sb.auth.signInWithPassword({ email: f.currentEmail, password: oldP });
    if (check.error) return f.msg.pass.err("m.acc.pass.wrongOld");
    const { error } = await sb.auth.updateUser({ password: newP });
    if (error) return f.msg.pass.err(error);
    await sb.auth.signOut({ scope: "others" });
    f.passOld.value = f.passNew.value = f.passNew2.value = "";
    f.msg.pass.ok("m.acc.pass.done");
  } finally {
    btn.disabled = false;
  }
}

async function exportData(btn) {
  const f = acct;
  f.msg.data.clear();
  btn.disabled = true;
  const { data, error } = await sb.rpc("export_my_data");
  btn.disabled = false;
  if (error || !data) return f.msg.data.err(error || "err.generic");
  downloadJson(data, "yachad-ezer-mes-donnees.json");
}

function accountView() {
  if (!acct) acct = buildAccount();
  const f = acct;
  // Les noms de langues, de pays et de jours changent avec la langue du site
  f.langs.redraw(); f.country.redraw(); f.dispo.redraw();

  const field = (id, labelKey, input, hintKey) => h("div", { class: "field" },
    h("label", { for: id }, t(labelKey)), hintKey ? h("span", { class: "hint" }, t(hintKey)) : null, input);
  const button = (key, fn, cls = "btn btn-primary") => {
    const b = h("button", { class: cls, type: "button" }, t(key));
    b.addEventListener("click", () => fn(b));
    return b;
  };

  // Suppression du compte (avec confirmation)
  const zone = h("div", { class: "people" });
  const delBtn = h("button", { class: "btn btn-danger", type: "button" }, t("m.acc.del.btn"));
  zone.append(delBtn);
  delBtn.addEventListener("click", () => {
    const yes = h("button", { class: "btn btn-danger", type: "button" }, t("m.acc.del.yes"));
    const no = h("button", { class: "btn btn-secondary", type: "button" }, t("a.cancel"));
    zone.replaceChildren(h("span", {}, t("m.acc.del.q")), yes, no);
    no.addEventListener("click", () => zone.replaceChildren(delBtn));
    yes.addEventListener("click", async () => {
      yes.disabled = true;
      const { error } = await sb.rpc("delete_my_account");
      if (error) {
        zone.replaceChildren(h("span", { class: "err" }, /last_admin/.test(error.message || "") ? t("m.acc.del.lastAdmin") : t("err.generic")));
        return;
      }
      await signOut();
    });
  });

  const needsMigration = profile === null
    ? h("p", { class: "err" }, t("m.acc.migration")) : null;

  return h("div", { class: "stack", style: "gap:16px" },
    needsMigration,
    h("section", { class: "form-card stack", "aria-labelledby": "acc-h-profile" },
      h("h3", { id: "acc-h-profile" }, t("m.acc.profile.h")),
      field("acc-name", "join.name", f.name, "join.name.hint"),
      field("acc-church", "m.acc.church", f.church),
      h("fieldset", {}, h("span", { class: "legend" }, t("join.langs")), h("span", { class: "hint" }, t("join.langs.hint")), f.langs.el),
      field("acc-country", "m.acc.country", f.country.el),
      field("acc-tz", "m.acc.tz", f.tz.el, "m.acc.tz.hint"),
      h("div", { class: "people" }, button("m.acc.save", saveProfile)),
      f.msg.profile),
    h("section", { class: "form-card stack", "aria-labelledby": "acc-h-dispo" },
      h("h3", { id: "acc-h-dispo" }, t("dispo.title")),
      h("p", { class: "hint" }, t("m.acc.dispo.hint", { tz: f.tz.value() })),
      f.dispo.el,
      h("div", { class: "people" }, button("m.acc.save", saveDispo)),
      f.msg.dispo),
    h("section", { class: "form-card stack", "aria-labelledby": "acc-h-login" },
      h("h3", { id: "acc-h-login" }, t("m.acc.login.h")),
      field("acc-email", "contact.mail", f.email, "m.acc.email.hint"),
      h("div", { class: "people" }, button("m.acc.email.btn", saveEmail, "btn btn-secondary")),
      f.msg.email,
      h("hr", { class: "sep" }),
      field("acc-pass-old", "m.acc.pass.old", f.passOld),
      field("acc-pass-new", "m.acc.pass.new", f.passNew, "join.pass.hint"),
      field("acc-pass-new2", "m.acc.pass.new2", f.passNew2),
      h("div", { class: "people" }, button("m.acc.pass.btn", savePassword, "btn btn-secondary")),
      f.msg.pass),
    h("section", { class: "form-card stack" },
      h("label", { class: "check", for: "acc-notify" }, f.notify, h("span", {}, t("m.acc.notify")))),
    h("section", { class: "form-card stack", "aria-labelledby": "acc-h-data" },
      h("h3", { id: "acc-h-data" }, t("m.acc.data.h")),
      h("p", { class: "muted" }, t("m.acc.data.p")),
      h("div", { class: "people" }, button("m.acc.data.btn", exportData, "btn btn-secondary")),
      f.msg.data),
    h("section", { class: "form-card stack danger-zone" },
      h("h3", {}, t("m.acc.del.h")),
      h("p", { class: "muted" }, t("m.acc.del.p")),
      zone));
}

function card(a) {
  const r = a.request;
  const mine = observations.filter((o) => o.request_id === r.id);
  const ta = h("textarea", { id: "obs-" + r.id, maxlength: "2000", placeholder: t("m.obs.ph") });
  ta.value = drafts[r.id] || "";
  ta.addEventListener("input", () => { drafts[r.id] = ta.value; });

  const send = h("button", { class: "btn btn-primary btn-sm", type: "button" }, t("m.obs.send"));
  send.addEventListener("click", async () => {
    const body = ta.value.trim();
    if (body.length < 2) { toast(t("m.obs.emptyToast")); return; }
    send.disabled = true;
    const { data, error } = await sb.from("observations")
      .insert({ request_id: r.id, member_id: me.id, body })
      .select("id, request_id, body, status, created_at").single();
    send.disabled = false;
    if (error) { toast(t("m.obs.sendErr")); return; }
    observations.push(data);
    delete drafts[r.id];
    toast(t("m.obs.sent"));
    render();
  });

  const prayBtn = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t(a.prayed_at ? "m.unpray" : "m.pray"));
  prayBtn.addEventListener("click", async () => {
    const value = a.prayed_at ? null : new Date().toISOString();
    const { error } = await sb.from("assignments").update({ prayed_at: value }).eq("id", a.id);
    if (error) { toast(t("m.saveErr")); return; }
    a.prayed_at = value;
    toast(t(value ? "m.prayedToast" : "m.unprayedToast"));
    render();
  });

  return h("article", { class: "item" },
    h("div", { class: "item-head" },
      h("span", { class: "code" }, r.code),
      r.wants_contact ? h("span", { class: "tag gold" }, t("m.wantsReply")) : null,
      r.lang && r.lang !== lang() ? h("span", { class: "pill plain", lang: r.lang }, window.YE.langName(r.lang)) : null,
      h("span", { class: "meta" }, t("m.entrusted", { when: relDate(a.assigned_at) }))),
    h("p", { class: "body", lang: r.lang || null }, r.body),
    translateButton(r.body, r.lang),
    h("div", { class: "tags" }, (r.needs || []).map((n) => h("span", { class: "tag" }, needLabel(n)))),
    mine.length ? h("div", { class: "obs-list" },
      mine.flatMap((o) => [
        h("span", { class: "hint" }, t("m.yourObs", { when: relDate(o.created_at) }) + (o.status === "transmise" ? t("m.transmittedSuffix") : "")),
        h("p", {}, o.body)])) : null,
    h("div", { class: "field" },
      h("label", { for: "obs-" + r.id }, t(mine.length ? "m.obs.another" : "m.obs.write")),
      ta),
    h("div", { class: "item-foot" },
      send, prayBtn,
      a.prayed_at ? h("span", { class: "pill ok" }, t("m.prayedOn", { date: fmtDate(a.prayed_at) })) : null));
}
