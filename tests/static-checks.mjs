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
const ok = (cond, name) => { if (cond) { pass++; console.log("PASS | " + name); } else { fail++; console.log("FAIL | " + name); } };

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
  const allowed = f.endsWith("/js/i18n.js") ? 2 : 0;   // traductions et icônes, jamais des données
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

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
