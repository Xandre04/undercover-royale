// Service worker: makes Undercover Royale installable and playable offline.
// Code and data are network-first (edits on GitHub show up on the next online launch).
// Images and fonts are cache-first (they rarely change).
const SHELL_CACHE = 'ur-shell-v1';
const ASSET_CACHE = 'ur-assets-v1'; // must match app.js

const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './app.css',
  './manifest.webmanifest',
  './card_data.json?v=2',
  './vendor/preact-htm.js',
  './vendor/icons.js',
  './vendor/fonts/rubik-500.woff2',
  './vendor/fonts/rubik-700.woff2',
  './assets/fonts/Clash_Regular.otf',
  './assets/background.webp',
  './icons/icon-192.png',
  './icons/favicon-32.png',
  './assets/arenas/arena7.webp',
  './assets/arenas/arena12.webp',
  './assets/arenas/arena15.webp',
  './assets/arenas/arena20.webp',
  './assets/arenas/arena22.webp',
  './assets/arenas/arena23.webp',
  './assets/cards/card-legendary-unknown.webp',
  './assets/badges/A_Char_King_01.webp', './assets/badges/A_Char_Knight_01.webp', './assets/badges/A_Char_Goblin_01.webp',
  './assets/badges/A_Char_Pekka_01.webp', './assets/badges/A_Char_Prince_01.webp', './assets/badges/A_Char_MiniPekka_01.webp',
  './assets/badges/A_Char_Barbarian_01.webp', './assets/badges/A_Char_DarkPrince_01.webp', './assets/badges/A_Char_Bomb_01.webp',
  './assets/badges/A_Char_Hammer_01.webp', './assets/badges/A_Char_Rocket_01.webp', './assets/badges/Crown_01.webp',
  './assets/badges/Bolt_01.webp', './assets/badges/Elixir_01.webp', './assets/badges/Diamond_01.webp',
];

const CODE_RE = /\.(?:js|css|json|webmanifest|html)$/;

self.addEventListener('install', (event) => {
  // Cache files one by one so a single missing file does not block offline support.
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.all(SHELL_FILES.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await Promise.race([fetch(request), timeout(4000)]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await caches.match(request) || await caches.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isCode = request.mode === 'navigate' || url.pathname.endsWith('/') || CODE_RE.test(url.pathname);
  event.respondWith(isCode ? networkFirst(request) : cacheFirst(request));
});
