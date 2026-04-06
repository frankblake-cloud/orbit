const CACHE = 'orbit-share-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept the share target POST
  if (url.pathname === '/share-contact' && event.request.method === 'POST') {
    event.respondWith(handleShareContact(event.request));
    return;
  }
});

async function handleShareContact(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('contact');
    if (files.length > 0) {
      const file = files[0];
      const text = await file.text();
      // Store the vCard text in cache so the app can read it
      const cache = await caches.open(CACHE);
      await cache.put(
        '/pending-contact',
        new Response(text, { headers: { 'Content-Type': 'text/plain' } })
      );
    }
  } catch (err) {
    console.error('[SW] Share handling error:', err);
  }
  // Redirect to the friends page
  return Response.redirect('/#/friends', 303);
}
