import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface RegisterUserData {
  nickname: string;
  email: string;
  password: string;
  role: string;
  promoCode?: string | null;
  solanaPublicKey?: string | null;
  paymentSignature?: string | null;
}

// Проверьте уникальность email и nickname.
// Сделаем запрос GET, чтоб соответствовать серверному роуту.
export const checkUnique = async (email: string, nickname: string) => {
  const response = await api.get('/auth/check-unique', {
    params: { email, nickname }
  });
  return response.data;
};

export const registerUser = async (data: RegisterUserData) => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

export const loginUser = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const renewSubscription = async (
  signature: string,
  solanaPublicKey: string,
  email: string
) => {
  const response = await api.post('/auth/renew-subscription', {
    signature,
    solanaPublicKey,
    email,
  });
  return response.data;
};
