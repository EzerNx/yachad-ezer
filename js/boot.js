// Lancé tout en haut de chaque page, AVANT l'affichage :
// applique le thème et la langue choisis, pour éviter un « flash » de la mauvaise couleur.
// Si la langue n'est ni le français ni l'anglais, on commence tout de suite
// à télécharger son fichier (js/lang/<code>.js) : il arrive plus vite.
(function () {
  var LANGS = ["fr", "en", "es", "pt", "sw", "ht", "de", "ru", "zh", "ko"];
  var HTML = { fr: "fr-CA", en: "en-CA", pt: "pt-BR", zh: "zh-Hans" };
  try {
    var theme = localStorage.getItem("ye-theme");
    if (theme === "dark" || theme === "light") document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
  var lang = null;
  try { lang = localStorage.getItem("ye-lang"); } catch (e) {}
  if (LANGS.indexOf(lang) < 0) {
    lang = "en";   // aucune de nos langues : l’anglais est le plus partagé
    var wanted = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "fr"];
    for (var i = 0; i < wanted.length; i++) {
      var c = String(wanted[i] || "").toLowerCase().split("-")[0];
      if (LANGS.indexOf(c) >= 0) { lang = c; break; }
    }
  }
  document.documentElement.lang = HTML[lang] || lang;
  if (lang !== "fr" && lang !== "en") {
    var s = document.createElement("script");
    s.id = "ye-pack-" + lang;
    s.src = "js/lang/" + lang + ".js?v=8";
    document.head.appendChild(s);
  }
})();
