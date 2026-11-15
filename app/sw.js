// sw.js
// Service worker: saves the app files so it works offline.
// Change CACHE_NAME (v1 -> v2) each time you change the app or the data.

const CACHE_NAME = "wordsmith-v1";

const FILES_TO_CACHE = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "js/icons.js",
  "js/storage.js",
  "js/data.js",
  "js/wordforms.js",
  "js/search.js",
  "js/claude.js",
  "js/screens.js",
  "js/app.js",
  "data/dictionary.json.gz",
  "fonts/silkscreen-latin-400-normal.woff2",
  "fonts/silkscreen-latin-700-normal.woff2",
  "fonts/pixelify-sans-latin-400-normal.woff2",
  "fonts/pixelify-sans-latin-700-normal.woff2",
  "fonts/nunito-latin-400-normal.woff2",
  "fonts/nunito-latin-700-normal.woff2",
  "fonts/nunito-latin-800-normal.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

// Install: download and save all the files.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: delete caches from older versions.
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      const deletions = [];
      for (const name of names) {
        if (name !== CACHE_NAME) {
          deletions.push(caches.delete(name));
        }
      }
      return Promise.all(deletions);
    })
  );
  self.clients.claim();
});

// Fetch: answer from the saved files first, then from the network.
self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle our own files. Calls to Claude always go to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (saved) {
      if (saved) {
        return saved;
      }
      return fetch(request);
    })
  );
});
