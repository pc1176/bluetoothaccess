// Import and use the Angular service worker
importScripts('./ngsw-worker.js');

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('Push event received:', data);
      
      const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        data: {
          timestamp: data.timestamp
        },
        vibrate: [100, 50, 100],
        actions: [
          {
            action: 'open',
            title: 'Open App'
          }
        ],
        requireInteraction: true,
        tag: 'push-notification-' + Date.now() // Ensure each notification is unique
      };

      event.waitUntil(
        self.registration.showNotification(data.title, options)
          .then(() => {
            console.log('Notification shown successfully');
          })
          .catch(error => {
            console.error('Error showing notification:', error);
          })
      );
    } catch (error) {
      console.error('Error processing push event:', error);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  event.notification.close();

  if (event.action === 'open') {
    // Open the app when notification is clicked
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(function(clientList) {
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i];
            }
          }
          return client.focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});
