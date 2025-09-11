"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useChatStore } from "../../store/chatStore";
import { useUserStore } from "../../store/userStore";

type SocketContextType = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
});

type Props = {
  children: ReactNode;
};

export function SocketProvider({ children }: Props) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const addMessage = useChatStore((state) => state.addMessage);
  const setOnlineUsers = useChatStore((state) => state.setOnlineUsers);
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    if (!user) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
      query: { userId: user.id },
      transports: ["websocket"],
      autoConnect: true,
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
    });

    socketInstance.on("onlineUsers", (users) => {
      setOnlineUsers(users);
    });

    socketInstance.on("newMessage", (msg) => {
      addMessage(msg);
    });

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, addMessage, setOnlineUsers]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

// Хук для удобного доступа к сокету в компонентах
export function useSocket() {
  return useContext(SocketContext);
}
