'use client';

import React from 'react';

interface SubscriptionModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onPay: () => Promise<void>;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, email, onClose, onPay }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-crypto-dark rounded-xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
          type="button"
          aria-label="Close subscription modal"
        >
          ✕
        </button>

        <h2 className="text-2xl font-orbitron text-center text-crypto-accent mb-4">
          Renew your subscription
        </h2>

        <p className="text-gray-300 text-center mb-6">
          Your subscription has expired. To continue using the app, please renew it.
        </p>

        <p className="text-gray-400 text-center mb-6 italic">
          Please note that the subscription will be extended for the user: <br />
          <span className="font-semibold text-white">{email}</span>
        </p>

        <button
          onClick={onPay}
          className="w-full py-3 rounded-lg font-bold bg-gradient-to-r from-crypto-accent to-blue-500 hover:from-blue-400 hover:to-crypto-accent"
        >
          Pay via Phantom Wallet
        </button>
      </div>
    </div>
  );
};

export default SubscriptionModal;
