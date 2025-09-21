'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Connection, Keypair, Transaction, PublicKey } from '@solana/web3.js';
import {
  createMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { FaCoins, FaSpinner } from 'react-icons/fa';

function usePhantomWallet() {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedKey = localStorage.getItem('phantom_public_key');
    if (savedKey) {
      try {
        setPhantomWalletPublicKey(new PublicKey(savedKey));
      } catch {
        localStorage.removeItem('phantom_public_key');
      }
    }

    if (window.solana && window.solana.isPhantom) {
      const onDisconnect = () => {
        setPhantomWalletPublicKey(null);
        localStorage.removeItem('phantom_public_key');
      };
      window.solana.on('disconnect', onDisconnect);

      return () => {
        window.solana.removeListener('disconnect', onDisconnect);
      };
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.solana?.isPhantom) {
      throw new Error('Phantom Wallet не установлен');
    }
    try {
      setIsConnecting(true);
      const response = await window.solana.connect();
      const publicKey = new PublicKey(response.publicKey.toString());
      setPhantomWalletPublicKey(publicKey);
      localStorage.setItem('phantom_public_key', publicKey.toString());
    } catch (error) {
      console.error('Ошибка подключения к Phantom:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        await window.solana.disconnect();
      } catch (error) {
        console.error('Ошибка отключения:', error);
      }
    }
  }, []);

  return {
    phantomWalletPublicKey,
    isConnected: !!phantomWalletPublicKey,
    isConnecting,
    connectWallet,
    disconnectWallet,
  };
}

interface TokenFormData {
  name: string;
  symbol: string;
  description: string;
  supply: string;
  decimals: number;
  imageFile: File | null;
}

interface TokenCreatorProps {
  onTokenCreated?: (tokenAddress: string, solanaWallet: string) => void;
}

export default function TokenCreator({ onTokenCreated }: TokenCreatorProps) {
  const { phantomWalletPublicKey, connectWallet, disconnectWallet, isConnected, isConnecting } = usePhantomWallet();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    supply: '1000000',
    decimals: 6,
    imageFile: null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, imageFile: file }));

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function createToken() {
    if (!phantomWalletPublicKey) {
      alert('Пожалуйста, подключите Phantom кошелек');
      return;
    }
    if (!formData.name || !formData.symbol || !formData.supply) {
      alert('Пожалуйста, заполните обязательные поля: название, символ и количество');
      return;
    }

    setIsCreating(true);

    try {
      const clusterUrl =
        process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
          ? 'https://api.mainnet-beta.solana.com'
          : 'https://api.devnet.solana.com';

      const connection = new Connection(clusterUrl, 'confirmed');

      const mintAuthority = Keypair.generate();

      const mint = await createMint(
        connection,
        mintAuthority,
        phantomWalletPublicKey,
        null,
        formData.decimals
      );

      const ata = await getAssociatedTokenAddress(
        mint,
        phantomWalletPublicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(ata);

      if (!accountInfo) {
        const createAtaTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            phantomWalletPublicKey,
            ata,
            phantomWalletPublicKey,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );

        const signed = await window.solana.signTransaction(createAtaTx);
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
      }

      alert(`Токен успешно создан!\nАдрес mint: ${mint.toBase58()}`);

      if (onTokenCreated) {
        onTokenCreated(mint.toBase58(), phantomWalletPublicKey.toBase58());
      }

      setFormData({
        name: '',
        symbol: '',
        description: '',
        supply: '1000000',
        decimals: 6,
        imageFile: null,
      });
      setImagePreview(null);
    } catch (error: any) {
      console.error('Ошибка создания токена:', error);
      alert(`Ошибка создания токена: ${error.message || error.toString()}`);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="p-6 bg-crypto-dark rounded-lg border border-crypto-accent">
      <div className="flex items-center gap-3 mb-6">
        <FaCoins className="text-crypto-accent text-2xl" />
        <h2 className="text-2xl font-orbitron font-bold text-white">Создать токен</h2>
      </div>

      {!isConnected ? (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full py-4 px-6 bg-gradient-to-r from-crypto-accent to-blue-500 text-crypto-dark font-orbitron font-bold text-lg rounded-lg hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? 'Подключение кошелька...' : 'Подключить Phantom Wallet'}
        </button>
      ) : (
        <>
          <button
            onClick={disconnectWallet}
            className="mb-4 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Отключить кошелек
          </button>

          <div className="space-y-4">
            {/* Название токена */}
            <div>
              <label className="block text-white font-semibold mb-2">Название токена *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Например: My Amazing Token"
                className="w-full p-3 rounded-lg bg-crypto-input border border-crypto-accent text-white placeholder-gray-400 focus:ring-2 focus:ring-crypto-accent focus:border-transparent"
                maxLength={32}
              />
            </div>

            {/* Символ токена */}
            <div>
              <label className="block text-white font-semibold mb-2">Символ токена *</label>
              <input
                type="text"
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                placeholder="Например: MAT"
                className="w-full p-3 rounded-lg bg-crypto-input border border-crypto-accent text-white placeholder-gray-400 focus:ring-2 focus:ring-crypto-accent focus:border-transparent uppercase"
                maxLength={10}
              />
            </div>

            {/* Описание */}
            <div>
              <label className="block text-white font-semibold mb-2">Описание</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Опишите ваш токен..."
                rows={3}
                className="w-full p-3 rounded-lg bg-crypto-input border border-crypto-accent text-white placeholder-gray-400 focus:ring-2 focus:ring-crypto-accent focus:border-transparent resize-none"
              />
            </div>

            {/* Количество токенов */}
            <div>
              <label className="block text-white font-semibold mb-2">Общее количество *</label>
              <input
                type="number"
                name="supply"
                value={formData.supply}
                onChange={handleInputChange}
                placeholder="1000000"
                min="1"
                className="w-full p-3 rounded-lg bg-crypto-input border border-crypto-accent text-white placeholder-gray-400 focus:ring-2 focus:ring-crypto-accent focus:border-transparent"
              />
            </div>

            {/* Десятичные знаки */}
            <div>
              <label className="block text-white font-semibold mb-2">Десятичные знаки</label>
              <select
                name="decimals"
                value={formData.decimals}
                onChange={handleInputChange}
                className="w-full p-3 rounded-lg bg-crypto-input border border-crypto-accent text-white focus:ring-2 focus:ring-crypto-accent focus:border-transparent"
              >
                <option value={0}>0 (целые числа)</option>
                <option value={2}>2 (как доллары)</option>
                <option value={6}>6 (стандарт)</option>
                <option value={9}>9 (как SOL)</option>
              </select>
            </div>

            {/* Изображение токена */}
            <div>
              <label className="block text-white font-semibold mb-2">Изображение токена</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full p-3 rounded-lg bg-crypto-input border border-crypto-accent text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-crypto-accent file:text-crypto-dark hover:file:bg-opacity-80"
              />
              {imagePreview && (
                <div className="mt-3">
                  <img
                    src={imagePreview}
                    alt="Предпросмотр"
                    className="w-32 h-32 object-cover rounded-lg border border-crypto-accent"
                  />
                </div>
              )}
            </div>

            {/* Кнопка создания */}
            <button
              onClick={createToken}
              disabled={isCreating}
              className="w-full py-4 px-6 bg-gradient-to-r from-crypto-accent to-blue-500 text-crypto-dark font-orbitron font-bold text-lg rounded-lg hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isCreating ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Создание токена...
                </>
              ) : (
                <>
                  <FaCoins />
                  Создать токен
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
