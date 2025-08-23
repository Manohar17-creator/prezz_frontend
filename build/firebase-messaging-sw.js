importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCgju-qT8orwanDwqHkPCdgWKWHQ9yu8BI",
  authDomain: "prezz-5581d.firebaseapp.com",
  projectId: "prezz-5581d",
  storageBucket: "prezz-5581d.firebasestorage.app",
  messagingSenderId: "640305527750",
  appId: "1:640305527750:web:0164bc28b70c7ef6fe10c7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png',
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});