// components/NotificationPermission.tsx
"use client";

import { useEffect } from "react";
import { getToken, messaging } from "@/utils/firebase-config";

const NotificationPermission = () => {
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        
        if (permission === "granted") {
          const registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
          );

          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (token) {
            console.log("FCM Token:", token);
            // Сохраните токен в базе данных
          }
        }
      } catch (error) {
        console.error("Error:", error);
      }
    };

    if ('serviceWorker' in navigator) {
      requestPermission();
    }
  }, []);

  return null;
};

export default NotificationPermission;
