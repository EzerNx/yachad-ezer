// =====================================================================
//  Bouton « Traduire » : traduit une demande SUR L'APPAREIL.
//
//  Pourquoi pas Google Traduction ou DeepL ? Parce qu'une demande de prière
//  est confidentielle : en la collant dans un site de traduction, son texte
//  sortirait de l'équipe et irait sur les serveurs d'une entreprise.
//
//  Chrome (ordinateur, version 138 et plus) a un traducteur intégré :
//  le modèle est téléchargé une fois sur l'ordinateur, puis la traduction
//  se fait localement. Rien n'est envoyé. Les autres navigateurs ne l'ont
//  pas encore : on l'explique simplement.
//  Documentation : https://developer.chrome.com/docs/ai/translator-api
// =====================================================================
import { h, t, lang, toast } from "./app.js?v=8";

export const canTranslate = () => "Translator" in self;

// Le traducteur parle en codes BCP 47 ; « zh » = chinois simplifié chez nous
const code = (c) => (c === "zh" ? "zh" : c);

const cache = new Map();   // une traduction déjà faite n'est pas refaite

// Langue d'un texte inconnu (ex. une observation) : détectée sur l'appareil aussi
async function detect(text) {
  if (!("LanguageDetector" in self)) throw new Error("pair_unavailable");
  const d = await self.LanguageDetector.create();
  const [best] = await d.detect(text);
  d.destroy?.();
  if (!best || best.detectedLanguage === "und") throw new Error("pair_unavailable");
  return best.detectedLanguage;
}

export async function translateText(text, from, to) {
  if (from === "auto") from = await detect(text);
  if (from.split("-")[0] === to) return text;
  const key = from + ">" + to + ":" + text;
  if (cache.has(key)) return cache.get(key);
  const opts = { sourceLanguage: code(from), targetLanguage: code(to) };
  const availability = await self.Translator.availability(opts);
  if (availability === "unavailable") throw new Error("pair_unavailable");
  const tr = await self.Translator.create({
    ...opts,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        if (e.loaded < 1) toast(t("tr.downloading", { pct: Math.round(e.loaded * 100) }));
      });
    },
  });
  const out = await tr.translate(text);
  tr.destroy?.();
  cache.set(key, out);
  return out;
}

// Un bouton + une zone qui affiche la traduction sous le texte original.
// from : langue du texte (ex. la langue de la demande). to : langue du site.
export function translateButton(text, from) {
  const to = lang();
  if (!text || !from || from === to) return null;
  const fromLabel = from === "auto" ? t("tr.auto") : window.YE.langName(from);
  const out = h("div", { class: "translation", hidden: true, "aria-live": "polite" });
  const btn = h("button", { class: "btn btn-ghost btn-sm", type: "button" },
    t("tr.btn", { from: fromLabel }));
  btn.addEventListener("click", async () => {
    if (!out.hidden && out.dataset.done) { out.hidden = true; delete out.dataset.done; return; }
    out.hidden = false;
    if (!canTranslate()) {
      out.replaceChildren(h("p", { class: "hint" }, t("tr.unsupported")));
      return;
    }
    btn.disabled = true;
    out.replaceChildren(h("p", { class: "hint" }, t("tr.working")));
    try {
      const result = await translateText(text, from, to);
      out.replaceChildren(
        h("span", { class: "hint" }, t("tr.label", { to: window.YE.langName(to) })),
        h("p", { lang: to }, result));
      out.dataset.done = "1";
    } catch (e) {
      console.warn(e);
      out.replaceChildren(h("p", { class: "hint" }, t(/pair_unavailable/.test(e?.message || "") ? "tr.pair" : "tr.failed")));
    } finally {
      btn.disabled = false;
    }
  });
  return h("div", { class: "tr-wrap stack", style: "gap:8px;align-items:flex-start" }, btn, out);
}
