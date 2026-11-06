// Script de la page connexion.html
import { sb, showConfigWarning, explain, getMyProfile, signOut, t, onLangChange } from "../app.js?v=7";
const $ = (id) => document.getElementById(id);
showConfigWarning($("loginForm"));

let waiting = null;    // profil affiché dans l'écran d'attente
let lastError = null;  // dernière erreur, pour la retraduire

function renderWait() {
  if (!waiting) return;
  if (waiting.role === "refuse") {
    $("waitTitle").textContent = t("wait.refused.title");
    $("waitText").textContent = t("wait.refused.text");
  } else if (waiting.role === "intercesseur") {
    $("waitTitle").textContent = t("wait.paused.title");
    $("waitText").textContent = t("wait.paused.text");
  } else {
    $("waitTitle").textContent = t("wait.title");
    $("waitText").textContent = t("wait.text", { name: waiting.display_name || "" });
  }
}

function showError() {
  if (!lastError) return;
  $("l-err").textContent = lastError === "notconfigured" ? t("f.notconfigured") : explain(lastError);
  $("l-err").hidden = false;
}

// Envoie chaque personne vers le bon portail selon son rôle
async function route() {
  const me = await getMyProfile();
  if (!me) return;
  if (me.active && me.role === "admin") return location.replace("admin.html");
  if (me.active && me.role === "intercesseur") return location.replace("membre.html");
  $("loginSection").hidden = true;
  $("waitSection").hidden = false;
  waiting = me;
  renderWait();
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("l-err").hidden = true;
  lastError = null;
  if (!sb) { lastError = "notconfigured"; showError(); return; }
  $("l-btn").disabled = true;
  const { error } = await sb.auth.signInWithPassword({
    email: $("l-email").value.trim(),
    password: $("l-pass").value,
  });
  $("l-btn").disabled = false;
  if (error) { lastError = error; showError(); return; }
  route();
});

$("logoutBtn").addEventListener("click", signOut);
onLangChange(() => { renderWait(); showError(); });
route();
