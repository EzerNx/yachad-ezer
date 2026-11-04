// =====================================================================
//  Service worker : permet d'installer le site comme une application
//  et de l'ouvrir même avec une connexion faible.
//
//  Règles de sécurité :
//   · on ne garde en cache QUE les fichiers du site (HTML, CSS, JS, polices, images)
//   · on ne touche JAMAIS aux appels vers Supabase (les données restent privées)
//   · les pages sont toujours redemandées au réseau d'abord (version la plus récente)
// =====================================================================
const CACHE = "yachad-ezer-v5";
const ASSETS = [
  "./", "index.html", "suivi.html", "connexion.html", "devenir-intercesseur.html", "mot-de-passe.html",
  "membre.html", "admin.html",
  "css/style.css?v=5", "css/fonts.css?v=5",
  "js/boot.js?v=5", "js/i18n.js?v=5", "js/app.js?v=5", "js/config.js?v=5", "js/vendor/supabase-2.117.3.js",
  "js/pages/accueil.js?v=5", "js/pages/suivi.js?v=5", "js/pages/connexion.js?v=5", "js/pages/candidature.js?v=5",
  "js/pages/mot-de-passe.js?v=5", "js/pages/membre.js?v=5", "js/pages/admin.js?v=5",
  "favicon.svg", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;   // Supabase et autres : pas touché

  if (req.mode === "navigate") {
    // Pages : réseau d'abord, copie locale si hors ligne
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
    return;
  }
  // Fichiers (versionnés) : copie locale d'abord, sinon réseau
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
