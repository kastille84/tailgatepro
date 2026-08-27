/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST?: unknown[];
};

self.__WB_MANIFEST = [];

const APP_SHELL = ["/", "/index.html"];

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open("tailgatepro-v1").then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then(async (cachedResponse): Promise<Response> => {
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          return await fetch(event.request);
        } catch {
          const fallback = await caches.match("/index.html");
          return fallback ?? new Response("Offline", { status: 503 });
        }
      }),
  );
});
