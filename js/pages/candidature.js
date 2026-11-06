// Script de la page devenir-intercesseur.html
import { sb, showConfigWarning, explain, t, onLangChange } from "../app.js?v=6";
const $ = (id) => document.getElementById(id);
showConfigWarning($("joinForm"));

let lastError = null;   // clé de traduction ou erreur Supabase
function showError() {
  if (!lastError) { $("j-err").hidden = true; return; }
  $("j-err").textContent = typeof lastError === "string" ? t(lastError) : explain(lastError);
  $("j-err").hidden = false;
}
function fail(errorOrKey) { lastError = errorOrKey; showError(); }

$("joinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  lastError = null; showError();
  const name = $("j-name").value.trim();
  const email = $("j-email").value.trim();
  const pass = $("j-pass").value;
  const motivation = $("j-motivation").value.trim();

  if (name.length < 2) return fail("join.e.name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("join.e.email");
  if (pass.length < 8) return fail("err.password");
  if (motivation.length < 10) return fail("join.e.motivation");
  if (!$("j-engage").checked) return fail("join.e.pledge");
  if (!$("j-consent").checked) return fail("join.e.consent");
  if (!$("j-age").checked) return fail("join.e.age");
  if (!sb) return fail("f.notconfigured");

  const btn = $("j-btn");
  btn.disabled = true; btn.textContent = t("sending");
  // signUp crée le compte. Le trigger de la base crée le profil « candidat ».
  const { error } = await sb.auth.signUp({
    email,
    password: pass,
    options: {
      emailRedirectTo: new URL("connexion.html", location.href).href,
      data: { display_name: name, church: $("j-church").value.trim(), motivation, engagement: "true" },
    },
  });
  btn.disabled = false; btn.textContent = t("join.submit");
  if (error) return fail(error);
  $("formSection").hidden = true;
  $("doneSection").hidden = false;
});

onLangChange(showError);
