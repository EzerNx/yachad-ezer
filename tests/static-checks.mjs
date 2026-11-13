// =====================================================================
//  Vérifications automatiques du code du site (sans réseau)
//  Lancement : node tests/static-checks.mjs
//
//  1. Chaque page a une politique de sécurité (CSP) stricte
//  2. Aucun script « en ligne » : tout le code vient de fichiers du site
//  3. Aucun appel à un serveur extérieur (polices, CDN…)
//  4. Aucune clé secrète dans le code envoyé aux navigateurs
//  5. innerHTML n'est utilisé qu'avec les traductions (jamais avec des données)
//  6. Chaque texte traduit existe en français ET en anglais
// =====================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log("PASS | " + name); } else { fail++; console.log("FAIL | " + name); } return !!cond; };

// Retire les commentaires (pour ne pas confondre une explication avec du code)
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1").replace(/<!--[\s\S]*?-->/g, "");

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (f.startsWith(".") || f === "node_modules" || f === "tests" || f === "supabase") return [];
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(root);
const html = files.filter((f) => f.endsWith(".html"));
const ownJs = files.filter((f) => f.endsWith(".js") && !f.includes("/vendor/"));

console.log("== Pages HTML ==");
for (const f of html) {
  const s = readFileSync(f, "utf8");
  const name = f.replace(root, "");
  const csp = (s.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  ok(csp.includes("script-src 'self';") && csp.includes("object-src 'none'") && csp.includes("base-uri 'self'"), `${name} : politique de sécurité (CSP) stricte`);
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(s), `${name} : aucun script en ligne`);
  ok(!/(src|href)="https?:\/\/(?!ezernx\.github\.io)/i.test(s.replace(/<meta[^>]*>/g, "").replace(/<link rel="canonical"[^>]*>/g, "")), `${name} : aucun fichier chargé depuis un autre site`);
  ok(/<meta name="referrer"/.test(s), `${name} : politique de référent définie`);
}

console.log("== Secrets ==");
const secretPatterns = [/sb_secret_[A-Za-z0-9_-]{10,}/, /service_role/i, /eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/];
for (const f of [...html, ...ownJs]) {
  const s = stripComments(readFileSync(f, "utf8"));
  ok(!secretPatterns.some((re) => re.test(s)), `${f.replace(root, "")} : aucune clé secrète`);
}

console.log("== Injection de code (XSS) ==");
for (const f of ownJs) {
  const s = readFileSync(f, "utf8");
  const uses = (s.match(/\.innerHTML\s*=/g) || []).length;
  const allowed = f.endsWith("/js/i18n.js") ? 3 : 0;   // traductions et icônes (constantes), jamais des données
  ok(uses <= allowed, `${f.replace(root, "")} : innerHTML utilisé ${uses} fois (permis : ${allowed})`);
  ok(!/\beval\(|new Function\(|document\.write\(/.test(s), `${f.replace(root, "")} : pas d'eval / document.write`);
}

console.log("== Traductions ==");
const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} }, navigator: { language: "fr" },
  document: { documentElement: { lang: "", getAttribute: () => null, setAttribute() {} }, querySelectorAll: () => [], querySelector: () => null },
  Event: class {}, console };
ctx.window.dispatchEvent = () => {};
vm.createContext(ctx);
vm.runInContext(readFileSync(join(root, "js/i18n.js"), "utf8"), ctx);
const keys = new Set(ctx.window.YE.keys());
const used = new Set();
for (const f of [...html, ...ownJs]) {
  const s = stripComments(readFileSync(f, "utf8"));
  for (const m of s.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) used.add(m[1]);
  for (const m of s.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(";").forEach((p) => used.add(p.split(":")[1].trim()));
  for (const m of s.matchAll(/\bt\("([^"]+)"/g)) used.add(m[1]);
}
// Clés construites dynamiquement : "need." + n, "st." + s, "a.tst.st." + statut
const prefixes = [...used].filter((k) => k.endsWith("."));
for (const pre of prefixes) { used.delete(pre); ok([...keys].some((k) => k.startsWith(pre)), `des clés existent pour le préfixe ${pre}`); }
const missing = [...used].filter((k) => !keys.has(k));
ok(missing.length === 0, `toutes les clés utilisées existent (${used.size} clés)${missing.length ? " — manquantes : " + missing.join(", ") : ""}`);
const D = vm.runInContext("1", ctx) && ctx.window.YE;
const bad = [...keys].filter((k) => { const fr = D.t(k, null, "fr"), en = D.t(k, null, "en"); return !fr || !en; });
ok(bad.length === 0, "chaque texte existe en français et en anglais");

console.log("== Autres langues (js/lang/*.js) ==");
// Les clés des pages publiques (et des réponses envoyées aux personnes) doivent
// exister dans chaque langue. Les portails restent en français / anglais.
const PUBLIC = { "index.html": "accueil", "suivi.html": "suivi", "devenir-intercesseur.html": "candidature",
                 "connexion.html": "connexion", "mot-de-passe.html": "mot-de-passe" };
const publicKeys = new Set();
const addFrom = (src) => {
  const s = stripComments(src);
  for (const m of s.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) publicKeys.add(m[1]);
  for (const m of s.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(";").forEach((p) => publicKeys.add(p.split(":")[1].trim()));
  for (const m of s.matchAll(/\bt\("([^"]+)"/g)) publicKeys.add(m[1]);
  // clés passées indirectement, ex. fail("join.e.name") puis t(lastError)
  for (const m of s.matchAll(/["'`]([a-z][\w-]*(?:\.[\w-]+)+)["'`]/g)) publicKeys.add(m[1]);
};
for (const [page, script] of Object.entries(PUBLIC)) {
  addFrom(readFileSync(join(root, page), "utf8"));
  addFrom(readFileSync(join(root, "js/pages", script + ".js"), "utf8"));
}
addFrom(readFileSync(join(root, "js/app.js"), "utf8"));
addFrom(readFileSync(join(root, "js/profil.js"), "utf8"));
for (const k of keys) if (/^(nav|prefs|v|err|need|st|reply|dispo|privacy|crisis)\./.test(k)) publicKeys.add(k);
for (const k of [...publicKeys]) if (k.endsWith(".") || !keys.has(k)) publicKeys.delete(k);

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const tags = (s) => [...String(s).matchAll(/<\/?([a-z]+)/gi)].map((m) => m[1].toLowerCase()).sort().join(",");
for (const code of ["es", "pt", "sw", "ht", "de", "ru", "zh", "ko"]) {
  const f = join(root, "js/lang", code + ".js");
  let pack = null;
  try {
    const c2 = { window: {} };
    vm.createContext(c2);
    vm.runInContext(readFileSync(f, "utf8"), c2);
    pack = c2.window.YE_PACKS && c2.window.YE_PACKS[code];
  } catch (e) { pack = null; }
  if (!ok(pack && typeof pack === "object", `js/lang/${code}.js se charge`)) continue;
  // Swahili et créole : pas de Bible au statut libre vérifié, les versets restent en anglais / français
  const verseFallback = code === "sw" || code === "ht";
  const miss = [...publicKeys].filter((k) => !(verseFallback && /^v\./.test(k)) && (typeof pack[k] !== "string" || !pack[k].trim()));
  ok(miss.length === 0, `${code} : tous les textes publics sont traduits (${publicKeys.size})${miss.length ? " — manquants : " + miss.slice(0, 12).join(", ") : ""}`);
  const unknown = Object.keys(pack).filter((k) => !keys.has(k));
  ok(unknown.length === 0, `${code} : aucune clé inconnue${unknown.length ? " — " + unknown.join(", ") : ""}`);
  const badVars = Object.keys(pack).filter((k) => keys.has(k) && placeholders(pack[k]) !== placeholders(D.t(k, null, "en")));
  ok(badVars.length === 0, `${code} : les {variables} sont les mêmes qu'en anglais${badVars.length ? " — " + badVars.join(", ") : ""}`);
  const badTags = Object.keys(pack).filter((k) => keys.has(k) && tags(pack[k]) !== tags(D.t(k, null, "en")));
  ok(badTags.length === 0, `${code} : mêmes balises HTML qu'en anglais (rien d'ajouté)${badTags.length ? " — " + badTags.join(", ") : ""}`);
  ok(!Object.values(pack).some((v) => /<script|javascript:|\son\w+\s*=/i.test(v)), `${code} : aucun script ni attribut on…= dans les textes`);
}

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
