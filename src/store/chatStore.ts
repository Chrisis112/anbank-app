import { create } from "zustand";

// Типы
export type MessageType = "text" | "image" | "video";

export type Message = {
  id: string; // Можно добавить, если backend отдаёт id
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  chatId: string; // "global" или ID личного чата
  content: string;
  type: MessageType;
  createdAt: string;
    reactions?: Record<string, string[]>; // 👈 Заменить string → string[]
};

export type OnlineUser = {
  id: string;
  nickname: string;
  avatar?: string;
};

type ChatStore = {
  messages: Message[];
  selectedChat: string | null; // null = общий чат
  onlineUsers: OnlineUser[];
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  setSelectedChat: (chatId: string | null) => void;
  clearMessages: () => void;
  addReaction: (messageId: string, emoji: string, userId: string) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  selectedChat: null,
  onlineUsers: [],

  addMessage: (msg: Message) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  setMessages: (msgs: Message[]) =>
    set(() => ({
      messages: msgs,
    })),

  setOnlineUsers: (users: OnlineUser[]) =>
    set(() => ({
      onlineUsers: users,
    })),

  setSelectedChat: (chatId: string | null) =>
    set(() => ({
      selectedChat: chatId,
    })),

  clearMessages: () =>
    set(() => ({
      messages: [],
    })),

  addReaction: (messageId: string, emoji: string, userId: string) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg;

        const currentUsers = msg.reactions?.[emoji] || [];
        const hasReacted = currentUsers.includes(userId);

        // Обновляем реакцию: снимаем, если уже есть, или добавляем
        const updatedUsers = hasReacted
          ? currentUsers.filter((u) => u !== userId)
          : [...currentUsers, userId];

        // Создаем новый объект reactions с обновленной реакцией
        const newReactions = {
          ...msg.reactions,
          [emoji]: updatedUsers,
        };

        // Если после удаления реакций массив пуст, удалим ключ emoji для чистоты
        if (updatedUsers.length === 0) {
          delete newReactions[emoji];
        }

        return {
          ...msg,
          reactions: newReactions,
        };
      }),
    })),
}));
