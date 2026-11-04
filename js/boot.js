// Lancé tout en haut de chaque page, AVANT l'affichage :
// applique le thème et la langue choisis, pour éviter un « flash » de la mauvaise couleur.
(function () {
  try {
    var theme = localStorage.getItem("ye-theme");
    if (theme === "dark" || theme === "light") document.documentElement.setAttribute("data-theme", theme);
    var lang = localStorage.getItem("ye-lang");
    if (lang !== "fr" && lang !== "en") lang = /^en/i.test(navigator.language || "") ? "en" : "fr";
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
  } catch (e) {}
})();
