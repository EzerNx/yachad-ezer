// Script de la page mot-de-passe.html
// Étape 1 : la personne demande un lien.
// Étape 2 : elle clique le lien du courriel ; Supabase la ramène ici
//           avec un jeton temporaire (événement PASSWORD_RECOVERY).
import { sb, t, explain } from "../app.js?v=8";

const $ = (id) => document.getElementById(id);

function showNewPasswordForm() {
  $("askSection").hidden = true;
  $("newSection").hidden = false;
}

if (sb) {
  sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") showNewPasswordForm();
  });
}
if (/type=recovery/.test(location.hash)) showNewPasswordForm();

$("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("p-err").hidden = true;
  const email = $("p-email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $("p-err").textContent = t("join.e.email"); $("p-err").hidden = false; return; }
  if (!sb) { $("p-err").textContent = t("f.notconfigured"); $("p-err").hidden = false; return; }
  $("p-btn").disabled = true;
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("mot-de-passe.html", location.href).href,
  });
  $("p-btn").disabled = false;
  // Même message que le compte existe ou non : on ne révèle pas qui est inscrit.
  if (error && /rate limit/i.test(error.message || "")) { $("p-err").textContent = explain(error); $("p-err").hidden = false; return; }
  $("askForm").hidden = true;
  $("p-sent").hidden = false;
});

$("newForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("n-err");
  err.hidden = true;
  const p1 = $("n-pass").value, p2 = $("n-pass2").value;
  if (p1.length < 8) { err.textContent = t("err.password"); err.hidden = false; return; }
  if (p1 !== p2) { err.textContent = t("pw.new.mismatch"); err.hidden = false; return; }
  $("n-btn").disabled = true;
  const { error } = await sb.auth.updateUser({ password: p1 });
  $("n-btn").disabled = false;
  if (error) { err.textContent = explain(error); err.hidden = false; return; }
  await sb.auth.signOut();
  $("newForm").hidden = true;
  $("n-done").hidden = false;
});
