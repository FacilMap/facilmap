// For now we just add offline support for index.html so that FacilMap can be installed as a PWA

const version = "v1";

self.addEventListener('install', (e) => {
	e.waitUntil(caches.open(version).then((cache) => cache.addAll(["/"])));
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then((keyList) => {
			return Promise.all(keyList.map((key) => {
				if(key != version)
					return caches.delete(key);
			}));
		})
	);
});

self.addEventListener('fetch', (event) => {
	event.respondWith(caches.open(version).then((cache) => {
		return fetch(event.request).catch(() => {
			return cache.match(event.request, { ignoreSearch: true });
		});
	}));
});
