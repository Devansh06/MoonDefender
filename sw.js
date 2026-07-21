const CACHE = "moon-defender-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-180.png",
  "/src/main.js",
  "/src/state.js",
  "/src/world.js",
  "/src/render.js",
  "/src/rocks.js",
  "/src/weapons.js",
  "/src/physics.js",
  "/src/hazards.js",
  "/src/hud.js",
  "/src/tutorial.js",
  "/src/mission-control.js",
  "/src/leaderboard.js",
  "/src/utils.js",
  "/src/constants.js",
  "/src/config.js",
  "/src/Starnet.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
