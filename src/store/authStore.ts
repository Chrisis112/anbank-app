import { create } from "zustand";
import axios from "axios";

export type UserRole = "newbie" | "advertiser" | "creator" | "admin";

export type User = {
  id: string;
  nickname: string;
  email: string;
  avatar?: string;
  role: UserRole;
  subscriptionExpiresAt?: string;
  subscribed?: boolean;
  solanaPublicKey?: string;
};

export interface LoginResponse {
  success: boolean;
  user?: User;
  error?: string;
  token?: string;
}

interface RegisterResponse {
  success: boolean;
  user?: User;
  error?: string;
  token?: string;
}

type AuthStore = {
  user: User | null;
  token: string | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<LoginResponse>;
  register: (
    nickname: string,
    email: string,
    password: string,
    role: UserRole,
    solanaPublicKey: string | null,
    paymentSignature: string | null,
    promoCode?: string | null
  ) => Promise<RegisterResponse>;

  logout: () => void;
  fetchProfile: () => Promise<void>;
  setLanguage: (lang: "en" | "ru") => void;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        { email, password }
      );

      if (data.token) {
        localStorage.setItem("token", data.token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
      }

      set({ token: data.token || null, user: data.user || null, isLoading: false });

      return {
        success: true,
        user: data.user,
        token: data.token,
      };
    } catch (err: any) {
      set({ isLoading: false });
      return {
        success: false,
        error: err.response?.data?.message || "Login failed",
      };
    }
  },

register: async (
  nickname,
  email,
  password,
  role,
  solanaPublicKey = null,
  paymentSignature = null,
  promoCode = null
) => {
  set({ isLoading: true });
  try {
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
      {
        nickname,
        email,
        password,
        role: [role], // <--- Передаем массив ролей
        solanaPublicKey,
        paymentSignature,
        promoCode,
      }
    );

    if (data.token) {
      localStorage.setItem("token", data.token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    }

    set({ token: data.token || null, user: data.user || null, isLoading: false });

    return {
      success: true,
      user: data.user,
      token: data.token,
    };
  } catch (err: any) {
    set({ isLoading: false });
    return {
      success: false,
      error:
        err.response?.data?.message || err.response?.data?.error || "Registration failed",
    };
  }
},

  logout() {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    set({ token: null, user: null });
  },

  fetchProfile: async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    set({ isLoading: true });
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    try {
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/me`);
      set({ user: data ? { ...data, id: data.id || data._id } : null, token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  setLanguage(lang) {
    // Реализуйте, если нужно
  },
}));
