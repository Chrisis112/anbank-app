"use client";

import { useEffect } from "react";
import { getToken, messaging } from "@/utils/firebase-config";
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const NotificationPermission = () => {
  useEffect(() => {
    const requestPermission = async () => {
      try {
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }

        if (permission === "granted" && 'serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
          );

          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (token) {
            console.log("FCM Token:", token);
            // Важно: отправьте этот токен на ваш сервер, например:
            try {
              const authToken = localStorage.getItem("token");
              if (authToken) {
                const user = useAuthStore(state => state.user);
                await axios.post(
                  `${process.env.NEXT_PUBLIC_API_URL}/auth/subscribe`,
                  { subscription: token, userId: user?.id },
                  { headers: { Authorization: `Bearer ${authToken}` } }
                );
              }
            } catch (e) {
              console.error("Ошибка при отправке токена на сервер", e);
            }
          }
        }
      } catch (error) {
        console.error("Notification permission error:", error);
      }
    };

    requestPermission();
  }, []);

  return null;
};

export default NotificationPermission;
