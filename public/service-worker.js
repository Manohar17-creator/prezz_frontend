self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('attendance-tracker-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/static/js/bundle.js',
        '/static/css/main.css',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('push', (event) => {
  const payload = event.data.json();
  fetch('some-endpoint', { method: 'POST', body: JSON.stringify(payload) })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .catch(error => {
      console.error('Fetch error in service worker:', error);
      // Optionally, show a notification to the user
      self.registration.showNotification('Error', {
        body: 'Failed to process push notification due to a network error.',
      });
    });
});