// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCgju-qT8orwanDwqHkPCdgWKWHQ9yu8BI",
  authDomain: "prezz-5581d.firebaseapp.com",
  projectId: "prezz-5581d",
  storageBucket: "prezz-5581d.firebasestorage.app",
  messagingSenderId: "640305527750",
  appId: "1:640305527750:web:0164bc28b70c7ef6fe10c7",
  measurementId: "G-NDFBXYR7Z1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

export const requestForToken = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: "BFFnV-EWy5GCgE_DfvsFAj5I4kNBzTqUOLpQp3uWDaQJHKDtk__X8WN4WiGz81luODt6_D_gyQRMu-C2L8rQjSU" // From Firebase Console > Cloud Messaging > Web Push Certificates
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('FCM token error:', error);
    return null;
  }
};