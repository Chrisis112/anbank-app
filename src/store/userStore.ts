import { create } from "zustand";
import axios from "axios";

// Типы пользователя
export type UserRole = "newbie" | "advertiser" | "creator"| "admin";

export type User = {
  id: string;
  nickname: string;
  email: string;
  avatar?: string; // ссылка на картинку
  role: UserRole;
  subscriptionExpiresAt?: string; // дата окончания подписки
};

type UserStore = {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  updateNickname: (nickname: string) => Promise<boolean>;
  updateRole: (role: UserRole) => Promise<boolean>;
  updateAvatar: (file: File) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  clearUser: () => void;
};

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  isLoading: false,

  // Установить или очистить данные пользователя
  setUser: (user) => set({ user }),

  // Обновить никнейм
  async updateNickname(nickname) {
    if (!get().user) return false;
    try {
      const { data } = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${get().user?.id}`,
        { nickname }
      );
      set({ user: { ...get().user!, nickname: data.nickname } });
      return true;
    } catch (err) {
      return false;
    }
  },

  // Обновить роль пользователя
  async updateRole(role) {
    if (!get().user) return false;
    try {
      const { data } = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${get().user?.id}/role`,
        { role }
      );
      set({ user: { ...get().user!, role: data.role } });
      return true;
    } catch (err) {
      return false;
    }
  },

  // Загрузить аватар на S3 → обновить профиль
  async updateAvatar(file) {
    if (!get().user) return false;
    try {
      // 1. Получаем pre-signed URL c backend
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/upload-url`,
        { params: { filename: file.name, filetype: file.type } }
      );

      // 2. Загружаем файл на S3
      await axios.put(data.url, file, {
        headers: { "Content-Type": file.type },
      });

      // 3. Сохраняем ссылку на аватар у пользователя
      const avatarUrl = data.fileUrl;

      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/users/${get().user?.id}/avatar`, {
        avatar: avatarUrl,
      });

      set({ user: { ...get().user!, avatar: avatarUrl } });
      return true;
    } catch (err) {
      return false;
    }
  },

  // Обновить профиль из backend (правильно брать /users/me)
  async refreshProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;
    set({ isLoading: true });
    try {
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      set({
        user: data.user
          ? { ...data.user, id: data.user.id || data.user._id }
          : null,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  // Очистить данные пользователя (например, при выходе)
  clearUser: () => set({ user: null }),
}));
