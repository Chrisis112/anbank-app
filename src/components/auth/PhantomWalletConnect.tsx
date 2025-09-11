"use client";

import { useEffect, useState } from "react";

export default function PhantomWalletConnect() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Проверка, уже ли подключено при загрузке
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).solana?.isPhantom) {
      const provider = (window as any).solana;
      provider.on("connect", (pubKey: { toBase58: () => string }) => {
        setWalletConnected(true);
        setWalletAddress(pubKey.toBase58());
        setError(null);
      });
      provider.on("disconnect", () => {
        setWalletConnected(false);
        setWalletAddress(null);
      });
      // Проверим: уже подключён?
      provider.connect({ onlyIfTrusted: true }).catch(() => {});
    }
  }, []);

  const handleConnect = async () => {
    setError(null);
    try {
      if (!(window as any).solana?.isPhantom) {
        setError("Phantom Wallet not found. Please install Phantom extension.");
        return;
      }
      const provider = (window as any).solana;
      const resp = await provider.connect();
      setWalletConnected(true);
      setWalletAddress(resp.publicKey.toBase58());
    } catch (err: any) {
      setError(err?.message || "Failed to connect Phantom wallet.");
      setWalletConnected(false);
      setWalletAddress(null);
    }
  };

  const handleDisconnect = () => {
    if ((window as any).solana?.isPhantom) {
      (window as any).solana.disconnect();
    }
  };

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow max-w-md mx-auto text-white">
      <h2 className="text-xl font-bold mb-4">Phantom Wallet</h2>

      {walletConnected && walletAddress ? (
        <div>
          <div className="mb-2">
            <span className="inline-block mr-2 bg-green-600 px-2 py-1 rounded text-sm font-semibold">
              Connected
            </span>
            <span className="text-gray-400 break-all">{walletAddress}</span>
          </div>
          <button
            className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          <button
            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded"
            onClick={handleConnect}
          >
            Connect Phantom Wallet
          </button>
          {error && <div className="text-red-400 mt-2">{error}</div>}
        </div>
      )}
    </div>
  );
}
