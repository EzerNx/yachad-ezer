// Script de la page admin.html (portail administrateur)
import { sb, h, fmtDate, relDate, toast, needLabel, statusLabel, requireRole, signOut, avatar,
         t, lang, onLangChange, copyText, EMAIL_REPLIES_ENABLED } from "../app.js?v=7";

const me = await requireRole(["admin"]);

let tab = "requests";
let requestFilter = "ouvertes";
let obsFilter = "a-traiter";
let tstFilter = "en_attente";
let loaded = false;
let loadFailed = false;
const state = { requests: [], members: [], observations: [], testimonies: [], settings: null };
const replyDrafts = {};   // réponses modifiées à la main, gardées si la page se redessine
const replyLang = {};     // langue choisie pour chaque réponse

const one = (x) => (Array.isArray(x) ? x[0] : x) || null;   // relation 1-à-1 renvoyée en objet ou tableau
const member = (id) => state.members.find((m) => m.id === id);
const memberName = (id) => member(id)?.display_name || t("a.m.member");

if (me) {
  document.getElementById("meName").textContent = me.display_name || "Admin";
  document.getElementById("meAvatar").replaceWith(avatar(me.id, me.display_name, "lg"));
  document.querySelectorAll("[data-logout]").forEach((b) => b.addEventListener("click", signOut));
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((x) => (x === b ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current")));
    render();
    window.scrollTo({ top: 0 });
  }));
  onLangChange(render);
  await loadAll();
}

async function loadAll() {
  const [r, m, o, s, tst] = await Promise.all([
    sb.from("prayer_requests")
      .select("id, code, body, needs, wants_contact, status, created_at, expires_at, lang, private:request_private(first_name, contact_method, contact_value), assignments(id, member_id, prayed_at)")
      .order("created_at", { ascending: false }),
    sb.from("profiles")
      .select("id, display_name, church, motivation, role, active, created_at, approved_at, engagement_at")
      .order("created_at"),
    sb.from("observations")
      .select("id, body, status, created_at, transmitted_at, member_id, request:prayer_requests(id, code, body, wants_contact, lang, private:request_private(first_name, contact_method, contact_value))")
      .order("created_at", { ascending: false }),
    sb.from("app_settings").select("auto_assign, per_request").eq("id", 1).maybeSingle(),
    sb.from("testimonies")
      .select("id, body, display_name, lang, status, created_at, published_at")
      .order("created_at", { ascending: false }),
  ]);
  const err = r.error || m.error || o.error || s.error;
  if (err) { console.error(err); loadFailed = true; render(); return; }
  state.requests = r.data;
  state.members = m.data;
  state.observations = o.data;
  state.settings = s.data;
  state.testimonies = tst.error ? [] : tst.data;   // table absente avant la migration 002
  loaded = true;
  loadFailed = false;
  render();
}

// Exécute une action, affiche un message, puis recharge
async function act(promise, okKey) {
  const { error } = await promise;
  if (error) { console.error(error); toast(t("a.actionErr", { msg: error.message || "?" })); return false; }
  if (okKey) toast(t(okKey));
  await loadAll();
  return true;
}

// Bouton de suppression avec confirmation intégrée (pas de fenêtre « confirm »)
function confirmButton(label, question, yesLabel, onYes, cls = "btn btn-ghost btn-sm") {
  const wrap = h("span", { class: "people" });
  const btn = h("button", { class: cls, type: "button" }, label);
  wrap.append(btn);
  btn.addEventListener("click", () => {
    const yes = h("button", { class: "btn btn-danger btn-sm", type: "button" }, yesLabel);
    const no = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t("a.cancel"));
    wrap.replaceChildren(h("span", {}, question), yes, no);
    no.addEventListener("click", () => wrap.replaceChildren(btn));
    yes.addEventListener("click", () => { yes.disabled = true; onYes(); });
  });
  return wrap;
}

function setCount(id, n, hot) {
  const el = document.getElementById(id);
  el.textContent = n;
  el.classList.toggle("hot", !!hot && n > 0);
}

function pageHead(title, sub, action) {
  return h("div", { class: "page-head" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null), action || null);
}

function segmented(label, options, current, onPick) {
  return h("div", { class: "segmented", role: "group", "aria-label": label },
    options.map(([v, l]) => h("button", { type: "button", "aria-pressed": String(v === current), onclick: () => onPick(v) }, l)));
}

function render() {
  const panel = document.getElementById("panel");
  if (loadFailed) { panel.replaceChildren(h("p", { class: "err" }, t("a.loadErr"))); return; }
  if (!loaded) return;
  setCount("c-requests", state.requests.filter((r) => r.status === "nouvelle").length, true);
  setCount("c-observations", state.observations.filter((o) => o.status === "nouvelle").length, true);
  setCount("c-members", state.members.filter((m) => m.role === "candidat").length, true);
  setCount("c-testimonies", state.testimonies.filter((x) => x.status === "en_attente").length, true);
  const view = { requests: viewRequests, observations: viewObservations, members: viewMembers, testimonies: viewTestimonies, settings: viewSettings }[tab];
  panel.replaceChildren(view());
}

/* ===================== DEMANDES ===================== */
function viewRequests() {
  const open = state.requests.filter((r) => r.status !== "fermee");
  const unassigned = state.requests.filter((r) => r.status === "nouvelle").length;
  const newObs = state.observations.filter((o) => o.status === "nouvelle").length;
  const active = state.members.filter((m) => m.active && ["intercesseur", "admin"].includes(m.role)).length;

  const distBtn = h("button", { class: "btn btn-primary btn-sm", type: "button" }, t("a.distribute"));
  distBtn.addEventListener("click", async () => {
    distBtn.disabled = true;
    const { data, error } = await sb.rpc("distribute_new_requests");
    distBtn.disabled = false;
    if (error) { toast(t("a.distribute.err", { msg: error.message })); return; }
    toast(data ? t("a.distribute.done", { n: data }) : t("a.distribute.none"));
    loadAll();
  });

  const list = state.requests.filter((r) =>
    requestFilter === "toutes" ? true :
    requestFilter === "ouvertes" ? r.status !== "fermee" : r.status === requestFilter);

  const waitMsg = unassigned
    ? t(unassigned === 1 ? "a.req.waitOne" : "a.req.waitMany", { n: unassigned })
    : t("a.req.allAssigned");

  return h("div", { class: "stack", style: "gap:24px" },
    pageHead(t("a.req.title"), t("a.req.hello", { name: me.display_name || "" }) + " " + waitMsg, distBtn),
    h("div", { class: "tiles" },
      h("div", { class: "tile" }, h("span", { class: "num" }, open.length), h("span", { class: "lbl" }, t("a.t.open"))),
      h("div", { class: unassigned ? "tile hot" : "tile" }, h("span", { class: "num" }, unassigned), h("span", { class: "lbl" }, t("a.t.unassigned"))),
      h("div", { class: newObs ? "tile hot" : "tile" }, h("span", { class: "num" }, newObs), h("span", { class: "lbl" }, t("a.t.obs"))),
      h("div", { class: "tile" }, h("span", { class: "num" }, active), h("span", { class: "lbl" }, t("a.t.active")))),
    h("div", { class: "toolbar" },
      segmented(t("a.f.label"),
        [["ouvertes", t("a.f.open")], ["nouvelle", t("a.f.unassigned")], ["fermee", t("a.f.closed")], ["toutes", t("a.f.all")]],
        requestFilter, (v) => { requestFilter = v; render(); })),
    h("div", { class: "list" },
      list.length ? list.map(requestCard) : h("p", { class: "empty" }, t("a.req.empty"))));
}

function requestCard(r) {
  const p = one(r.private);
  const assigned = r.assignments || [];
  const available = state.members.filter((m) => m.active && ["intercesseur", "admin"].includes(m.role) && !assigned.some((a) => a.member_id === m.id));

  const pick = h("select", { "aria-label": t("a.add.aria", { code: r.code }) },
    h("option", { value: "" }, t("a.add")),
    available.map((m) => h("option", { value: m.id }, m.display_name || t("a.m.member"))));
  pick.addEventListener("change", async () => {
    if (!pick.value) return;
    const ok = await act(sb.from("assignments").insert({ request_id: r.id, member_id: pick.value }), "a.assigned");
    if (ok && r.status === "nouvelle") await act(sb.from("prayer_requests").update({ status: "assignee" }).eq("id", r.id));
  });

  const toggle = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t(r.status === "fermee" ? "a.reopen" : "a.close"));
  toggle.addEventListener("click", () => act(
    sb.from("prayer_requests").update({ status: r.status === "fermee" ? (assigned.length ? "assignee" : "nouvelle") : "fermee" }).eq("id", r.id),
    r.status === "fermee" ? "a.reopened" : "a.closed"));

  const del = confirmButton(t("a.delete"), t("a.delete.q"), t("a.delete.yes"),
    () => act(sb.from("prayer_requests").delete().eq("id", r.id), "a.deleted"));

  const foot = h("div", { class: "item-foot" },
    assigned.length
      ? h("div", { class: "people" }, assigned.map((a) => {
          const rm = h("button", { type: "button", "aria-label": t("a.remove.aria", { name: memberName(a.member_id) }) }, "×");
          rm.addEventListener("click", () => act(sb.from("assignments").delete().eq("id", a.id), "a.removed"));
          return h("span", { class: a.prayed_at ? "person-chip done" : "person-chip" },
            avatar(a.member_id, memberName(a.member_id)), memberName(a.member_id) + (a.prayed_at ? t("a.hasPrayed") : ""), rm);
        }))
      : h("span", { class: "hint" }, t("a.noone")),
    h("span", { class: "spacer" }),
    available.length && r.status !== "fermee" ? pick : null,
    toggle, del);

  return h("article", { class: "item" },
    h("div", { class: "item-head" },
      h("span", { class: "code" }, r.code),
      h("span", { class: r.status === "nouvelle" ? "pill new" : r.status === "fermee" ? "pill" : "pill ok" }, statusLabel(r.status)),
      r.lang ? h("span", { class: "pill plain" }, r.lang.toUpperCase()) : null,
      h("span", { class: "meta" }, t("a.received", { when: relDate(r.created_at), date: fmtDate(r.expires_at) }))),
    h("div", { class: "identity" },
      h("span", {}, h("b", {}, t("a.person")), (p && p.first_name) || t("a.anon")),
      p && p.contact_value
        ? h("span", {}, h("b", {}, t(p.contact_method === "courriel" ? "contact.mail" : "contact.tel")), p.contact_value)
        : h("span", { class: "muted" }, t(r.wants_contact ? "a.missingContact" : "a.noContact"))),
    h("p", { class: "body" }, r.body),
    h("div", { class: "tags" }, (r.needs || []).map((n) => h("span", { class: n === "priere" ? "tag" : "tag gold" }, needLabel(n)))),
    foot);
}

/* ===================== OBSERVATIONS ===================== */
function viewObservations() {
  const list = state.observations.filter((o) =>
    obsFilter === "toutes" ? true : obsFilter === "transmise" ? o.status === "transmise" : o.status !== "transmise");
  return h("div", { class: "stack", style: "gap:24px" },
    pageHead(t("a.obs.title"), t("a.obs.sub")),
    h("div", { class: "toolbar" },
      segmented(t("a.of.label"), [["a-traiter", t("a.of.todo")], ["transmise", t("a.of.sent")], ["toutes", t("a.f.all")]],
        obsFilter, (v) => { obsFilter = v; render(); })),
    h("div", { class: "list" }, list.length ? list.map(obsCard) : h("p", { class: "empty" }, t("a.obs.empty"))));
}

// Le message à envoyer, dans la langue choisie pour cette réponse
function replyTemplate(o, p, l) {
  const greeting = p.first_name ? t("reply.greet.name", { name: p.first_name }, l) : t("reply.greet", null, l);
  return greeting + "\n\n" + t("reply.body", { code: o.request.code }, l) + "\n\n" + o.body + "\n\n" + t("reply.end", null, l);
}

function obsCard(o) {
  const r = o.request;
  const p = r ? one(r.private) : null;
  const canReply = r && r.wants_contact && p && p.contact_value;

  let reply = null;
  if (canReply && o.status !== "transmise") {
    // Par défaut : la langue dans laquelle la personne a écrit sa demande
    const l = replyLang[o.id] || r.lang || lang();
    const ta = h("textarea", { id: "reply-" + o.id, maxlength: "4000" });
    ta.value = replyDrafts[o.id] ?? replyTemplate(o, p, l);
    ta.addEventListener("input", () => { replyDrafts[o.id] = ta.value; updateMail(); });

    const langPick = segmented(t("a.reply.lang"), [["fr", "Français"], ["en", "English"]], l, (v) => {
      replyLang[o.id] = v;
      delete replyDrafts[o.id];   // nouvelle langue = nouveau modèle
      render();
    });

    const copy = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t("a.copy"));
    copy.addEventListener("click", () => copyText(ta.value, ta, t("a.copied"), t("a.copySel")));
    const mailHref = () => "mailto:" + encodeURIComponent(p.contact_value) + "?subject=" + encodeURIComponent(t("reply.subject", null, l)) + "&body=" + encodeURIComponent(ta.value);
    const mail = p.contact_method === "courriel" && !EMAIL_REPLIES_ENABLED
      ? h("a", { class: "btn btn-secondary btn-sm", href: mailHref() }, t("a.openMail"))
      : null;
    function updateMail() { if (mail) mail.href = mailHref(); }

    // Envoi direct par la fonction « send-reply » (si elle est déployée)
    let sendNow = null;
    // Message d'erreur qui reste affiché (un « toast » disparaît trop vite pour être lu)
    const errBox = h("p", { class: "err", role: "alert", hidden: true });
    const showSendError = (msg) => { errBox.textContent = t("a.sendMail.err", { msg }); errBox.hidden = false; };
    if (EMAIL_REPLIES_ENABLED && p.contact_method === "courriel") {
      sendNow = h("button", { class: "btn btn-primary btn-sm", type: "button" }, t("a.sendMail"));
      sendNow.addEventListener("click", async () => {
        sendNow.disabled = true; sendNow.textContent = t("a.sendMail.sending"); errBox.hidden = true;
        let { data, error } = await sb.functions.invoke("send-reply", {
          body: { observation_id: o.id, subject: t("reply.subject", null, l), message: ta.value },
        });
        // En cas d'erreur, la vraie raison est dans la réponse de la fonction : on la lit
        if (error && error.context && typeof error.context.json === "function") {
          try { data = await error.context.json(); } catch { /* réponse sans JSON */ }
          if (!data?.error && error.context.status) data = { error: "HTTP " + error.context.status + (error.context.status === 404 ? " (fonction non déployée ?)" : "") };
        }
        sendNow.disabled = false; sendNow.textContent = t("a.sendMail");
        if (error || !data?.ok) { showSendError(data?.error || error?.message || "?"); return; }
        delete replyDrafts[o.id];
        toast(t("a.sendMail.done"));
        loadAll();
      });
    }

    const sent = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t("a.markSent"));
    sent.addEventListener("click", async () => {
      const ok = await act(sb.from("observations").update({ status: "transmise", transmitted_at: new Date().toISOString() }).eq("id", o.id), "a.markedSent");
      if (ok) delete replyDrafts[o.id];
    });
    reply = h("div", { class: "reply" },
      h("div", { class: "toolbar" },
        h("label", { for: "reply-" + o.id }, t("a.reply.label", { name: p.first_name || t("a.reply.someone"), contact: p.contact_value })),
        langPick),
      h("span", { class: "hint" }, t(p.contact_method === "telephone" ? "a.reply.hintTel" : "a.reply.hintMail")),
      ta,
      h("div", { class: "people" }, sendNow, copy, mail, sent),
      errBox);
  }

  const read = o.status === "nouvelle" ? h("button", { class: "btn btn-ghost btn-sm", type: "button" }, t("a.markRead")) : null;
  if (read) read.addEventListener("click", () => act(sb.from("observations").update({ status: "lue" }).eq("id", o.id)));

  return h("article", { class: "item" },
    h("div", { class: "item-head" },
      h("span", { class: "code" }, r ? r.code : "—"),
      h("span", { class: o.status === "nouvelle" ? "pill new" : o.status === "transmise" ? "pill ok" : "pill" },
        o.status === "nouvelle" ? t("a.obs.st.new") : o.status === "transmise" ? t("a.obs.st.sentOn", { date: fmtDate(o.transmitted_at) }) : t("a.obs.st.read")),
      h("span", { class: "meta" }, t("a.obs.by", { name: memberName(o.member_id), when: relDate(o.created_at) }))),
    h("p", { class: "body" }, o.body),
    r ? h("details", {}, h("summary", { class: "hint", style: "cursor:pointer" }, t("a.seeRequest")), h("p", { class: "body muted", style: "margin-top:8px" }, r.body)) : null,
    !canReply ? h("p", { class: "hint" }, t(r && r.wants_contact ? "a.obs.noDetails" : "a.obs.internal")) : null,
    reply,
    read ? h("div", { class: "item-foot" }, read) : null);
}

/* ===================== INTERCESSEURS ===================== */
function deleteAccountButton(m) {
  return confirmButton(t("a.m.deleteAcc"), t("a.m.delete.q"), t("a.delete.yes"),
    () => act(sb.rpc("delete_member", { p_id: m.id }), "a.m.deleted"));
}

function viewMembers() {
  const openLoad = (id) => state.requests.filter((r) => r.status !== "fermee" && (r.assignments || []).some((a) => a.member_id === id && !a.prayed_at)).length;
  const candidates = state.members.filter((m) => m.role === "candidat");
  const refused = state.members.filter((m) => m.role === "refuse");
  const team = state.members.filter((m) => ["intercesseur", "admin"].includes(m.role));

  const candCard = (m) => {
    const yes = h("button", { class: "btn btn-primary btn-sm", type: "button" }, t("a.m.accept"));
    yes.addEventListener("click", () => act(sb.from("profiles").update({ role: "intercesseur", active: true, approved_at: new Date().toISOString() }).eq("id", m.id), "a.m.accepted"));
    const no = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t("a.m.refuse"));
    no.addEventListener("click", () => act(sb.from("profiles").update({ role: "refuse", active: false }).eq("id", m.id), "a.m.refused"));
    return h("article", { class: "item" },
      h("div", { class: "item-head" },
        avatar(m.id, m.display_name, "lg"),
        h("div", { class: "stack", style: "gap:0" }, h("b", {}, m.display_name || t("a.m.noName")), h("span", { class: "hint" }, m.church || t("a.m.noChurch"))),
        h("span", { class: "meta" }, t("a.m.signedUp", { when: relDate(m.created_at) }))),
      h("p", { class: "body" }, m.motivation || t("a.m.noMotivation")),
      h("div", { class: "tags" }, m.engagement_at
        ? h("span", { class: "pill ok" }, t("a.m.pledgeOk"))
        : h("span", { class: "pill new" }, t("a.m.pledgeNo"))),
      h("div", { class: "item-foot" }, yes, no, h("span", { class: "spacer" }), deleteAccountButton(m)));
  };

  const teamCard = (m) => {
    const isMe = m.id === me.id;
    const toggle = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t(m.active ? "a.m.pause" : "a.m.resume"));
    toggle.addEventListener("click", () => act(sb.from("profiles").update({ active: !m.active }).eq("id", m.id), m.active ? "a.m.pausedToast" : "a.m.resumedToast"));
    return h("article", { class: "item member" },
      avatar(m.id, m.display_name, "lg"),
      h("div", { class: "info" },
        h("b", {}, (m.display_name || t("a.m.noName")) + (isMe ? t("a.m.you") : "")),
        h("span", {}, t(m.role === "admin" ? "role.admin" : "role.int") + " · " + t("a.m.load", { n: openLoad(m.id) }))),
      h("span", { class: m.active ? "pill ok" : "pill" }, t(m.active ? "a.m.active" : "a.m.paused")),
      isMe ? null : toggle,
      isMe ? null : deleteAccountButton(m));
  };

  const refusedCard = (m) => h("article", { class: "item member" },
    avatar(m.id, m.display_name, "lg"),
    h("div", { class: "info" }, h("b", {}, m.display_name || t("a.m.noName")), h("span", {}, t("a.m.signedUp", { when: relDate(m.created_at) }))),
    deleteAccountButton(m));

  return h("div", { class: "stack", style: "gap:24px" },
    pageHead(t("a.nav.members"), t("a.m.sub")),
    h("h2", { style: "font-size:1.4rem" }, t("a.m.cand")),
    candidates.length ? h("div", { class: "list" }, candidates.map(candCard)) : h("p", { class: "empty" }, t("a.m.noCand")),
    h("h2", { style: "font-size:1.4rem" }, t("a.m.team")),
    h("div", { class: "grid-2" }, team.map(teamCard)),
    refused.length ? h("h2", { style: "font-size:1.4rem" }, t("a.m.refusedList")) : null,
    refused.length ? h("p", { class: "hint" }, t("a.m.refusedHint")) : null,
    refused.length ? h("div", { class: "grid-2" }, refused.map(refusedCard)) : null);
}

/* ===================== TÉMOIGNAGES ===================== */
function viewTestimonies() {
  const list = state.testimonies.filter((x) => x.status === tstFilter);
  const card = (x) => {
    const publish = h("button", { class: "btn btn-primary btn-sm", type: "button" }, t("a.tst.publish"));
    publish.addEventListener("click", () => act(sb.from("testimonies").update({ status: "publie" }).eq("id", x.id), "a.tst.published"));
    const unpublish = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t("a.tst.unpublish"));
    unpublish.addEventListener("click", () => act(sb.from("testimonies").update({ status: "en_attente" }).eq("id", x.id), "a.tst.unpublished"));
    const refuse = h("button", { class: "btn btn-secondary btn-sm", type: "button" }, t("a.tst.refuse"));
    refuse.addEventListener("click", () => act(sb.from("testimonies").update({ status: "refuse" }).eq("id", x.id), "a.tst.refused"));
    const del = confirmButton(t("a.delete"), t("a.m.delete.q"), t("a.delete.yes"),
      () => act(sb.from("testimonies").delete().eq("id", x.id), "a.tst.deleted"));
    return h("article", { class: "item" },
      h("div", { class: "item-head" },
        h("span", { class: x.status === "publie" ? "pill ok" : x.status === "refuse" ? "pill" : "pill new" }, t("a.tst.st." + x.status)),
        h("span", { class: "pill plain" }, (x.lang || "fr").toUpperCase()),
        h("span", { class: "meta" }, t("a.tst.by", { name: x.display_name || t("tst.anon"), when: relDate(x.created_at) }))),
      h("p", { class: "body" }, x.body),
      h("div", { class: "item-foot" },
        x.status !== "publie" ? publish : unpublish,
        x.status === "en_attente" ? refuse : null,
        h("span", { class: "spacer" }), del));
  };
  return h("div", { class: "stack", style: "gap:24px" },
    pageHead(t("a.nav.tst"), t("a.tst.sub")),
    h("div", { class: "toolbar" },
      segmented(t("a.nav.tst"), [["en_attente", t("a.tst.f.pending")], ["publie", t("a.tst.f.published")], ["refuse", t("a.tst.f.refused")]],
        tstFilter, (v) => { tstFilter = v; render(); })),
    h("div", { class: "list" }, list.length ? list.map(card) : h("p", { class: "empty" }, t("a.tst.empty"))));
}

/* ===================== RÉGLAGES ===================== */
function viewSettings() {
  const s = state.settings || { auto_assign: true, per_request: 2 };
  const auto = h("input", { type: "checkbox", id: "set-auto", checked: s.auto_assign });
  const per = h("input", { type: "number", id: "set-per", min: "1", max: "10", value: String(s.per_request) });
  const save = h("button", { class: "btn btn-primary", type: "button" }, t("a.s.save"));
  save.addEventListener("click", () => {
    const n = Math.min(10, Math.max(1, parseInt(per.value, 10) || 2));
    act(sb.from("app_settings").update({ auto_assign: auto.checked, per_request: n }).eq("id", 1), "a.s.saved");
  });
  return h("div", { class: "stack", style: "gap:24px" },
    pageHead(t("a.nav.settings"), t("a.s.sub")),
    h("div", { class: "form-card stack", style: "max-width:560px;gap:20px" },
      h("p", { class: "muted" }, t("a.s.explain")),
      h("label", { class: "check" }, auto, h("span", {}, h("b", {}, t("a.s.auto")), h("br"), h("span", { class: "hint" }, t("a.s.auto.hint")))),
      h("div", { class: "field" }, h("label", { for: "set-per" }, t("a.s.per")), per),
      save));
}
