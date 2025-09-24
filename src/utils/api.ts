import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface CheckUniqueResponse {
  emailExists: boolean;
  nicknameExists: boolean;
}

interface RegisterParams {
  nickname: string;
  email: string;
  password: string;
  role: string;
  solanaPublicKey?: string | null;
  paymentSignature?: string | null;
  promoCode?: string | null;
}

interface RegisterResult {
  success: boolean;
  error?: string;
  token?: string;
  user?: any;
}

interface LoginResult {
  token: string;
  user: any;
}

export async function checkUnique(email: string, nickname: string): Promise<CheckUniqueResponse> {
  try {
    const { data } = await axios.get(`${API_URL}/auth/check-unique`, {
      params: { email, nickname },
    });
    return data;
  } catch (error) {
    // В случае ошибки считаем, что email и никнейм заняты, чтобы предотвратить регистрацию
    return { emailExists: true, nicknameExists: true };
  }
}

export async function registerUser(params: RegisterParams): Promise<RegisterResult> {
  try {
    const { data } = await axios.post(`${API_URL}/auth/register`, {
      nickname: params.nickname,
      email: params.email,
      password: params.password,
      role: params.role,
      solanaPublicKey: params.solanaPublicKey || null,
      paymentSignature: params.paymentSignature || null,
      promoCode: params.promoCode || null,
    });
    return { success: true, token: data.token, user: data.user };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.data?.error ||
        error.message ||
        'Registration failed',
    };
  }
}

export async function renewSubscription(
  txSignature: string,
  solanaPublicKey: string,
  email: string
): Promise<{ token: string; user: any }> {
  const { data } = await axios.post(`${API_URL}/auth/renew-subscription`, {
    txSignature,
    solanaPublicKey,
    email,
  });
  return data;
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
  return data;
}
