'use client';

import React from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function RegisterWithPhantom() {
  const { connected, publicKey, connect, sendTransaction, wallet } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  const handleRegisterAndPay = async () => {
    if (!connected) {
      if (!wallet) {
        // Открываем выбор кошелька
        setVisible(true);
        return;
      }
      try {
        await connect();
      } catch (error) {
        alert('Failed to connect wallet');
        return;
      }
    }

    if (!publicKey || !connection) {
      alert('Wallet not connected or no connection available');
      return;
    }

    try {
      const receiver = new PublicKey(process.env.NEXT_PUBLIC_RECEIVER_WALLET || '');
      const amount = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.36');
      const lamports = amount * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: receiver,
          lamports: Math.floor(lamports),
        })
      );

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(signature, 'confirmed');

      alert('Payment successful! Signature: ' + signature);
      // Здесь разместите вашу логику после успешной оплаты (регистрация и т.д.)
    } catch (error) {
      alert('Payment failed: ' + error);
    }
  };

  return (
    <>
      <button onClick={handleRegisterAndPay}>
        Register and Pay
      </button>
      {isMobile && <p>Pay with Phantom Wallet</p>}
    </>
  );
}
