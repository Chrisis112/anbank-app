'use client';

import React, { useState } from 'react';
import PromoCodeInput from './PromoCodeInput';
import { toast } from 'react-toastify';

type Role = 'newbie' | 'advertiser' | 'creator';

interface RegisterFormProps {
  onSubmit: (data: {
    nickname: string;
    email: string;
    password: string;
    confirmPassword: string;
    role: Role;
    promoCode: string | null;
  }) => Promise<void>;
  loading: boolean;
  onPromoSuccess: (code: string) => void;
  onPromoFail: (message: string) => void;
  initialNickname?: string;
  initialEmail?: string;
  initialRole?: Role;
}

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  loading,
  onPromoSuccess,
  onPromoFail,
  initialNickname = '',
  initialEmail = '',
  initialRole = 'newbie',
}) => {
  const [nickname, setNickname] = useState(initialNickname);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>(initialRole);
  const [promoCode, setPromoCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname || !email || !password || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    await onSubmit({ nickname, email, password, confirmPassword, role, promoCode });
  };

  const handlePromoSuccess = (code: string) => {
    setPromoCode(code);
    onPromoSuccess(code);
  };

  const handlePromoFail = (message: string) => {
    setPromoCode(null);
    onPromoFail(message);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block mb-1 text-white font-semibold">Nickname</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
          placeholder="Choose a nickname"
          required
        />
      </div>

      <div>
        <label className="block mb-1 text-white font-semibold">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
          placeholder="email@example.com"
          required
        />
      </div>

      <div>
        <label className="block mb-1 text-white font-semibold">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
          required
        />
      </div>

      <div>
        <label className="block mb-1 text-white font-semibold">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
          required
        />
      </div>

      <div>
        <label className="block mb-1 text-white font-semibold">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light"
        >
          <option value="newbie">Newbie</option>
          <option value="advertiser">Advertiser</option>
          <option value="creator">Creator</option>
        </select>
      </div>

      <PromoCodeInput onSuccess={handlePromoSuccess} onFail={handlePromoFail} />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg font-bold transition-colors text-lg bg-gradient-to-r from-crypto-accent to-blue-500 hover:from-blue-400 hover:to-crypto-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Loading...' : 'Register'}
      </button>
    </form>
  );
};

export default RegisterForm;
