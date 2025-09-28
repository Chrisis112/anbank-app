// firebase-config.ts
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD6UHZSAZjr-vgM3rGvKsJS3W_TDH6fG4s",
  authDomain: "anbanktoken-e378c.firebaseapp.com",
  projectId: "anbanktoken-e378c",
  storageBucket: "anbanktoken-e378c.firebasestorage.app",
  messagingSenderId: "299210750747",
  appId: "1:299210750747:web:4ba5ab63ea75507fdcb1be",
  measurementId: "G-WDKZB9BCNW"
};

let messaging: ReturnType<typeof getMessaging>;

if (typeof window !== "undefined" && "navigator" in window) {
  const app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
}

export { messaging, getToken, onMessage };
