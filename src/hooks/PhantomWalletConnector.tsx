import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'react-toastify';

export default function PhantomWalletConnector() {
  const { wallet, connected, publicKey, connect, disconnect } = useWallet();
  const walletModal = useWalletModal();

  const [isConnecting, setIsConnecting] = useState(false);
  const [phantomPublicKey, setPhantomPublicKey] = useState<string | null>(null);

  const handleConnectWallet = useCallback(async () => {
    if (connected) {
      toast.info('Phantom Wallet уже подключен');
      return;
    }

    if (!wallet) {
      walletModal.setVisible(true); // Показываем модальное окно выбора кошелька
      return;
    }

    setIsConnecting(true);
    try {
      await connect();
      toast.success('Phantom Wallet успешно подключен!');
    } catch (error) {
      console.error('Ошибка подключения к Phantom:', error);
      toast.error('Не удалось подключить Phantom Wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [connect, connected, wallet, walletModal]);

  const handleDisconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      toast.info('Phantom Wallet отключен');
      setPhantomPublicKey(null);
    } catch (error) {
      console.error('Ошибка отключения Phantom:', error);
    }
  }, [disconnect]);

  useEffect(() => {
    if (connected && publicKey) {
      const pkStr = publicKey.toBase58();
      setPhantomPublicKey(pkStr);
      console.log('Wallet connected:', pkStr);
    } else {
      setPhantomPublicKey(null);
      console.log('Wallet disconnected or not connected');
    }
  }, [connected, publicKey]);

  return (
    <div style={{ maxWidth: 400, margin: 'auto', padding: 20 }}>
      <h3>Phantom Wallet Connection</h3>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <p>Public Key: {phantomPublicKey ?? '—'}</p>

      {!connected && (
        <button
          onClick={handleConnectWallet}
          disabled={isConnecting}
          style={{ padding: '8px 16px', marginBottom: 10 }}
        >
          {isConnecting ? 'Connecting...' : 'Connect Phantom Wallet'}
        </button>
      )}

      {connected && (
        <button
          onClick={handleDisconnectWallet}
          style={{ padding: '8px 16px', backgroundColor: '#f44336', color: 'white' }}
        >
          Disconnect Wallet
        </button>
      )}
    </div>
  );
}
