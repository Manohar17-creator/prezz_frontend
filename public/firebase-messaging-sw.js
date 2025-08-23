importScripts('/firebase-app.js');
importScripts('/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyCgju-qT8orwanDwqHkPCdgWKWHQ9yu8BI",
  authDomain: "prezz-5581d.firebaseapp.com",
  projectId: "prezz-5581d",
  storageBucket: "prezz-5581d.firebasestorage.app",
  messagingSenderId: "640305527750",
  appId: "1:640305527750:web:0164bc28b70c7ef6fe10c7",
  measurementId: "G-NDFBXYR7Z1"
});

const messaging = firebase.getMessaging();
messaging.onBackgroundMessage((payload) => {
  const { notification } = payload;
  self.registration.showNotification(notification.title, {
    body: notification.body,
    icon: '/favicon.ico'
  });
});