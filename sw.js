const CACHE_NAME = "amh-portal-clean-20260625-1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD36dbXpXZFtDy-OABPYWjWk8rJHuB_Ql4",
  authDomain: "amh-duyuru.firebaseapp.com",
  projectId: "amh-duyuru",
  storageBucket: "amh-duyuru.firebasestorage.app",
  messagingSenderId: "269251868398",
  appId: "1:269251868398:web:4796efbae93b2eea2025ff",
  measurementId: "G-DTWZJZDHXY"
});

firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Yeni duyuru";
  const body = payload.notification?.body || payload.data?.body || "AMH Öğrenci Portalı'nda yeni duyuru var.";
  self.registration.showNotification(title, {
    body,
    icon: "./icon.svg",
    badge: "./icon.svg",
    data: { url: payload.data?.url || "./" }
  });
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin === location.origin && /\.(html|js|css|webmanifest)$/.test(url.pathname)) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "./"));
});
