'use client';

import React, { useState } from 'react';
import { toast } from 'react-toastify';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSubmit, loading, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-crypto-dark rounded-xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          type="button"
          aria-label="Close login modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-orbitron gradient-title mb-6 text-center text-crypto-accent">Login</h2>

        {error && (
          <div
            className="bg-red-500/20 border border-red-500 text-red-400 p-2 rounded mb-4 text-center"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="loginEmail" className="block text-sm mb-1 text-white font-semibold">
              Email
            </label>
            <input
              type="email"
              id="loginEmail"
              name="loginEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
              placeholder="email@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="loginPassword" className="block text-sm mb-1 text-white font-semibold">
              Password
            </label>
            <input
              type="password"
              id="loginPassword"
              name="loginPassword"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-bold transition-colors text-lg bg-gradient-to-r from-crypto-accent to-blue-500 hover:from-blue-400 hover:to-crypto-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
