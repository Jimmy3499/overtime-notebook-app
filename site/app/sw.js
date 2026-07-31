const CACHE = 'overtime-notebook-v1';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function(x){return x!==CACHE;}).map(function(x){return caches.delete(x);})); }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url); if (url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) { if (res && res.status===200 && res.type==='basic') c.put(req, res.clone()); return res; }).catch(function(){ return hit || Response.error(); });
    });
  }));
});
