// Script de la page membre.html (portail intercesseur)
import { sb, h, fmtDate, relDate, toast, needLabel, requireRole, signOut, avatar, t, onLangChange } from "../app.js?v=5";

const me = await requireRole(["intercesseur", "admin"]);

let view = "todo";
let assignments = [];
let observations = [];
let notify = true;
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
  const [a, o, p] = await Promise.all([
    sb.from("assignments")
      .select("id, assigned_at, prayed_at, request:prayer_requests(id, code, body, needs, wants_contact, status, created_at)")
      .eq("member_id", me.id)
      .order("assigned_at", { ascending: false }),
    sb.from("observations")
      .select("id, request_id, body, status, created_at")
      .eq("member_id", me.id)
      .order("created_at"),
    sb.from("profiles").select("notify").eq("id", me.id).maybeSingle(),
  ]);
  if (a.error || o.error) { loadFailed = true; render(); return; }
  assignments = a.data.filter((x) => x.request && x.request.status !== "fermee");
  observations = o.data;
  notify = p.error ? true : (p.data?.notify ?? true);   // colonne absente avant la migration 002
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

// ---------- Mon compte : notifications et suppression ----------
function accountView() {
  const box = h("input", { type: "checkbox", id: "acc-notify", checked: notify });
  box.addEventListener("change", async () => {
    const { error } = await sb.from("profiles").update({ notify: box.checked }).eq("id", me.id);
    if (error) { box.checked = !box.checked; toast(t("m.saveErr")); return; }
    notify = box.checked;
    toast(t("m.acc.notify.saved"));
  });

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

  return h("div", { class: "stack", style: "gap:16px" },
    h("div", { class: "form-card stack" },
      h("label", { class: "check", for: "acc-notify" }, box, h("span", {}, t("m.acc.notify")))),
    h("div", { class: "form-card stack danger-zone" },
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
      h("span", { class: "meta" }, t("m.entrusted", { when: relDate(a.assigned_at) }))),
    h("p", { class: "body" }, r.body),
    h("div", { class: "tags" }, (r.needs || []).map((n) => h("span", { class: "tag" }, needLabel(n)))),
    mine.length ? h("div", { class: "obs-list" },
      mine.map((o) => [
        h("span", { class: "hint" }, t("m.yourObs", { when: relDate(o.created_at) }) + (o.status === "transmise" ? t("m.transmittedSuffix") : "")),
        h("p", {}, o.body)])) : null,
    h("div", { class: "field" },
      h("label", { for: "obs-" + r.id }, t(mine.length ? "m.obs.another" : "m.obs.write")),
      ta),
    h("div", { class: "item-foot" },
      send, prayBtn,
      a.prayed_at ? h("span", { class: "pill ok" }, t("m.prayedOn", { date: fmtDate(a.prayed_at) })) : null));
}
