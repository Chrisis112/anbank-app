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
        console.log("Current notification permission:", permission);
        if (permission === "default") {
          permission = await Notification.requestPermission();
          console.log("Notification permission after request:", permission);
        }

        if (permission === "granted" && "serviceWorker" in navigator) {
          console.log("Registering service worker...");
          const registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
          );
          console.log("Service worker registered with scope:", registration.scope);

          if (!messaging) {
            throw new Error("Firebase messaging is not initialized");
          }

          console.log("Getting FCM token...");
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_VAPID as string,
            serviceWorkerRegistration: registration,
          });

          console.log("FCM Token received:", token);

          if (token) {
            try {
              const authToken = localStorage.getItem("token");
              if (authToken) {
                const user = useAuthStore.getState().user;
                console.log("Sending push token to server for userId:", user?.id);
                await axios.post(
                  `${process.env.NEXT_PUBLIC_API_URL}/auth/subscribe`,
                  {
                    subscription: token,
                    userId: user?.id,
                  },
                  {
                    headers: { Authorization: `Bearer ${authToken}` },
                  }
                );
                console.log("Push token successfully sent to server");
              } else {
                console.warn("Auth token not found in localStorage");
              }
            } catch (e) {
              console.error("Error sending push token to server:", e);
            }
          } else {
            console.warn("FCM token is null or undefined");
          }
        } else {
          console.warn("Notification permission not granted or Service Worker not supported.");
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
