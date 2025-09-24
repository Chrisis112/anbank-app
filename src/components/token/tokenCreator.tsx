'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FaCoins, FaEye, FaSpinner, FaTimes } from 'react-icons/fa';
import axios from 'axios';

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  generateSigner,
  percentAmount,
} from '@metaplex-foundation/umi';
import { createFungible, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  createTokenIfMissing,
  findAssociatedTokenPda,
  getSplAssociatedTokenProgramId,
  mintTokensTo,
} from '@metaplex-foundation/mpl-toolbox';
import { WalletAdapter, walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { base58 } from '@metaplex-foundation/umi/serializers';

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
} from '@solana/web3.js';

type Web3JsTransactionOrVersionedTransaction = Transaction | VersionedTransaction;

class PhantomWalletAdapter implements WalletAdapter {
  private provider: any;

  constructor(provider: any) {
    this.provider = provider;
  }

  get publicKey() {
    return this.provider.publicKey;
  }

  async connect(): Promise<void> {
    await this.provider.connect();
  }

  async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }

  async signTransaction<T extends Web3JsTransactionOrVersionedTransaction>(transaction: T): Promise<T> {
    return this.provider.signTransaction(transaction) as Promise<T>;
  }

  async signAllTransactions<T extends Web3JsTransactionOrVersionedTransaction>(transactions: T[]): Promise<T[]> {
    return this.provider.signAllTransactions(transactions) as Promise<T[]>;
  }
}

interface PhantomProvider {
  publicKey: PublicKey | null;
  isPhantom: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: string, handler: () => void) => void;
  removeListener: (event: string, handler: () => void) => void;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

function usePhantomWallet() {
  const [phantomWallet, setPhantomWallet] = useState<PhantomProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const commissionInSol = Number(process.env.NEXT_PUBLIC_SOLANA_FOR_TOKEN_CREATION) || 0.0126;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkConnection = async () => {
      if (window.solana?.isPhantom) {
        try {
          const response = await window.solana.connect({ onlyIfTrusted: true });
          if (response.publicKey) {
            setPhantomWallet(window.solana);
          }
        } catch {}
      }
    };
    checkConnection();

    if (window.solana?.isPhantom) {
      const onDisconnect = () => setPhantomWallet(null);
      window.solana.on('disconnect', onDisconnect);
      return () => window.solana.removeListener('disconnect', onDisconnect);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.solana?.isPhantom) {
      throw new Error('Phantom Wallet не установлен');
    }
    try {
      setIsConnecting(true);
      const response = await window.solana.connect();
      if (response.publicKey) {
        setPhantomWallet(window.solana);
      }
    } catch (error) {
      console.error('Ошибка подключения к Phantom:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    if (phantomWallet) {
      try {
        await phantomWallet.disconnect();
        setPhantomWallet(null);
      } catch (error) {
        console.error('Ошибка отключения:', error);
      }
    }
  }, [phantomWallet]);

  return {
    phantomWallet,
    isConnected: !!phantomWallet,
    isConnecting,
    connectWallet,
    disconnectWallet,
    commissionInSol,
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

// Новый компонент для отображения примера токена в реальном времени
function TokenPreview({ data }: { data: TokenFormData }) {
  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-blue-600 text-white max-w-md">
      <h3 className="mb-4 font-semibold text-xl">Пример вашего токена</h3>
      <div className="mb-2">
        <strong>Название:</strong> {data.name || '(пусто)'}
      </div>
      <div className="mb-2">
        <strong>Символ:</strong> {data.symbol || '(пусто)'}
      </div>
      <div className="mb-2">
        <strong>Описание:</strong> {data.description || '(пусто)'}
      </div>
      <div className="mb-2">
        <strong>Общее количество:</strong> {data.supply || '(пусто)'}
      </div>
      <div className="mb-2">
        <strong>Десятичные знаки:</strong> {data.decimals}
      </div>
      {data.imageFile && (
        <div className="mt-4">
          <img
            src={URL.createObjectURL(data.imageFile)}
            alt="Превью токена"
            className="w-32 h-32 object-cover rounded-lg border border-blue-600"
          />
        </div>
      )}
    </div>
  );
}

export default function TokenCreator({ onTokenCreated }: { onTokenCreated?: (tokenAddress: string, solanaWallet: string) => void }) {
  const {
    phantomWallet,
    connectWallet,
    disconnectWallet,
    isConnected,
    isConnecting,
    commissionInSol,
  } = usePhantomWallet();

  const [isCreating, setIsCreating] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    supply: '1000000',
    decimals: 6,
    imageFile: null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const checkBalance = async () => {
      if (phantomWallet?.publicKey) {
        try {
          const clusterUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.devnet.solana.com';
          const connection = new Connection(clusterUrl, 'confirmed');
          const balance = await connection.getBalance(phantomWallet.publicKey);
          setWalletBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error('Ошибка получения баланса:', error);
        }
      }
    };
    checkBalance();
  }, [phantomWallet]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, imageFile: file }));
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  async function payCommission() {
    if (!phantomWallet?.publicKey) throw new Error('Подключите кошелек');

    const receiverAddress = process.env.NEXT_PUBLIC_RECEIVER_WALLET;
    if (!receiverAddress) throw new Error('Не задан адрес получателя комиссии');

    const commissionReceiver = new PublicKey(receiverAddress);

    const clusterUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.devnet.solana.com';
    const connection = new Connection(clusterUrl, 'confirmed');

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: phantomWallet.publicKey,
        toPubkey: commissionReceiver,
        lamports: Math.round(commissionInSol * LAMPORTS_PER_SOL),
      })
    );

    transaction.feePayer = phantomWallet.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signedTx = await phantomWallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(txid, 'confirmed');

    return txid;
  }

  async function createToken() {
    if (!phantomWallet?.publicKey) {
      alert('Пожалуйста, подключите Phantom кошелек');
      return;
    }
    if (!formData.name || !formData.symbol || !formData.supply) {
      alert('Пожалуйста, заполните обязательные поля: название, символ и количество');
      return;
    }
    if (walletBalance < commissionInSol + 0.05) {
      alert(
        `Недостаточно SOL для оплаты комиссии и создания токена.\nВаш баланс: ${walletBalance.toFixed(
          4
        )} SOL\nМинимум нужно: ${(commissionInSol + 0.05).toFixed(4)} SOL (комиссия + создание).`
      );
      return;
    }

    const userConfirmed = window.confirm(
      `Для создания токена необходимо оплатить комиссию в размере ${commissionInSol.toFixed(
        6
      )} SOL.\nЭто примерно соответствует 3 USD (реальное значение зависит от курса).\n\nПродолжить и оплатить комиссию?`
    );
    if (!userConfirmed) {
      return;
    }

    setIsCreating(true);

    try {
      const commissionTxId = await payCommission();
      console.log('Комиссия оплачена, txid:', commissionTxId);

      const clusterUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.devnet.solana.com';
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Не найден токен авторизации, пожалуйста войдите в систему.');
        setIsCreating(false);
        return;
      }

      const phantomAdapter = new PhantomWalletAdapter(window.solana);
      const umi = createUmi(clusterUrl)
        .use(mplTokenMetadata())
        .use(walletAdapterIdentity(phantomAdapter));

      const mintSigner = generateSigner(umi);

      let imageUri = '';
      if (formData.imageFile) {
        try {
          const { data } = await axios.get(`${baseUrl}/upload-url`, {
            params: {
              filename: formData.imageFile.name,
              filetype: formData.imageFile.type,
            },
            headers: { Authorization: `Bearer ${token}` },
          });
          const uploadUrl = data.url;
          await axios.put(uploadUrl, formData.imageFile, {
            headers: { 'Content-Type': formData.imageFile.type },
          });
          imageUri = uploadUrl.split('?')[0];
        } catch (error) {
          console.error('Ошибка загрузки изображения:', error);
        }
      }

      const createFungibleIx = createFungible(umi, {
        mint: mintSigner,
        name: formData.name,
        symbol: formData.symbol,
        uri: imageUri,
        sellerFeeBasisPoints: percentAmount(0),
        decimals: formData.decimals,
      });

      const createTokenIx = createTokenIfMissing(umi, {
        mint: mintSigner.publicKey,
        owner: umi.identity.publicKey,
        ataProgram: getSplAssociatedTokenProgramId(umi),
      });

      const supply = BigInt(formData.supply) * BigInt(10 ** formData.decimals);

      const mintTokensIx = mintTokensTo(umi, {
        mint: mintSigner.publicKey,
        token: findAssociatedTokenPda(umi, {
          mint: mintSigner.publicKey,
          owner: umi.identity.publicKey,
        }),
        amount: supply,
      });

      console.log('Отправка транзакции создания токена...');

      const tx = await createFungibleIx
        .add(createTokenIx)
        .add(mintTokensIx)
        .sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

      const signature = base58.deserialize(tx.signature)[0];
      console.log('Transaction signature:', signature);

      const newBalance = await new Connection(clusterUrl, 'confirmed').getBalance(phantomWallet.publicKey);
      setWalletBalance(newBalance / LAMPORTS_PER_SOL);

      alert(
        `Токен успешно создан!\n\nАдрес mint: ${mintSigner.publicKey}\nВы получили ${formData.supply} ${formData.symbol} токенов\n\nОбновленный баланс: ${(
          newBalance / LAMPORTS_PER_SOL
        ).toFixed(4)} SOL\n\nПосмотреть транзакцию:\nhttps://explorer.solana.com/tx/${signature}?cluster=${clusterUrl.includes(
          'devnet'
        )
          ? 'devnet'
          : 'mainnet'}\n\nПосмотреть токен:\nhttps://explorer.solana.com/address/${mintSigner.publicKey}?cluster=${clusterUrl.includes(
          'devnet'
        )
          ? 'devnet'
          : 'mainnet'}`
      );

      if (onTokenCreated) {
        onTokenCreated(mintSigner.publicKey.toString(), phantomWallet.publicKey.toString());
      }

      // Сброс данных формы после успешного создания токена
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
      if (axios.isAxiosError(error)) {
        console.error('Ошибка axios:', error.response?.status, error.response?.data);
        alert(`Ошибка создания токена: ${error.response?.data?.error || error.message}`);
      } else {
      }
    } finally {
      setIsCreating(false);
    }
  }


  const networkUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.devnet.solana.com';
  const networkName = networkUrl.includes('devnet')
    ? 'Devnet'
    : networkUrl.includes('mainnet')
    ? 'Mainnet'
    : 'Custom RPC';

const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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
        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
          <div className="mb-2">
            <span className="text-white text-sm">Подключено к сети: </span>
            <span className="text-highlight font-semibold">{networkName}</span>
          </div>
          <p className="text-white text-sm">
            Адрес кошелька:{' '}
            <span className="font-mono text-xs">
              {phantomWallet?.publicKey?.toString().slice(0, 8)}...
              {phantomWallet?.publicKey?.toString().slice(-8)}
            </span>
          </p>
          <p className="text-white text-sm">
            Баланс кошелька:{' '}
            <span className="font-bold">{walletBalance.toFixed(4)} SOL</span>
            {walletBalance < commissionInSol + 0.05 && (
              <span className="block text-red-400 mt-1">
                ⚠️ Рекомендуется иметь минимум {(commissionInSol + 0.05).toFixed(4)} SOL для оплаты комиссии и создания токена
              </span>
            )}
          </p>
        </div>

        <button
          onClick={disconnectWallet}
          className="mb-4 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          Отключить кошелек
        </button>

        {/* Кнопка для открытия предпросмотра */}
        <button
          onClick={() => setIsPreviewOpen(true)}
          className="mb-6 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <FaEye />
          Предпросмотр токена
        </button>

        <div className="space-y-4">
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

          <button
            onClick={createToken}
            disabled={isCreating || walletBalance < 0.02}
            className="w-full py-4 px-6 bg-gradient-to-r from-crypto-accent to-blue-500 text-crypto-dark font-orbitron font-bold text-lg rounded-lg hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isCreating ? (
              <>
                <FaSpinner className="animate-spin" />
                Создание токена...
              </>
            ) : walletBalance < 0.02 ? (
              'Недостаточно SOL'
            ) : (
              <>
                <FaCoins />
                Создать токен
              </>
            )}
          </button>
        </div>

        {/* Модальное окно предпросмотра */}
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Фон-затемнение */}
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsPreviewOpen(false)}
            ></div>
            
            {/* Модальное окно */}
            <div className="relative z-10 w-full max-w-sm sm:max-w-md mx-auto animate-in slide-in-from-left duration-300">
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Заголовок модального окна */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-5 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl font-bold text-white">Ваш токен</h3>
                    <button
                      onClick={() => setIsPreviewOpen(false)}
                      className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                      <FaTimes className="text-white text-base sm:text-lg" />
                    </button>
                  </div>
                </div>

                {/* Содержимое модального окна */}
                <div className="p-4 sm:p-5 bg-white overflow-y-auto flex-1">
                  {/* Изображение токена */}
                  {imagePreview && (
                    <div className="flex justify-center mb-4 sm:mb-5">
                      <img
                        src={imagePreview}
                        alt="Токен"
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-gray-200 object-cover"
                      />
                    </div>
                  )}

                  {/* Основная информация */}
                  <div className="text-center mb-4 sm:mb-5">
                    <h4 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">
                      {formData.name || 'Название не указано'}
                    </h4>
                    <p className="text-base sm:text-lg text-gray-500 font-mono">
                      {formData.symbol || 'СИМВОЛ'}
                    </p>
                  </div>

                  {/* Описание */}
                  {formData.description && (
                    <div className="mb-4 sm:mb-5 p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm sm:text-base text-gray-700 text-center">{formData.description}</p>
                    </div>
                  )}

                  {/* Детали токена */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-sm sm:text-base text-gray-600">Общее количество:</span>
                      <span className="text-sm sm:text-base font-semibold text-gray-800">
                        {formData.supply ? Number(formData.supply).toLocaleString() : '0'}
                      </span>
                    </div>

                    <div className="py-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm sm:text-base text-gray-600">Десятичные знаки:</span>
                        <span className="text-sm sm:text-base font-semibold text-gray-800">{formData.decimals}</span>
                      </div>
                      
                      {/* Объяснение десятичных знаков */}
                      <div className="bg-blue-50 p-2.5 sm:p-3 rounded-lg">
                        <p className="text-xs sm:text-sm text-blue-800">
                          {Number(formData.decimals) === 0 && (
                            <>
                              <strong>Целые числа:</strong> Ваш токен нельзя делить. Например: 1, 5, 100 токенов. 
                              Подходит для NFT или билетов.
                            </>
                          )}
                          {Number(formData.decimals) === 2 && (
                            <>
                              <strong>Как доллары:</strong> Ваш токен можно делить до 2 знаков. Например: 1.50, 99.99 токенов. 
                              Подходит для stablecoin или валютных токенов.
                            </>
                          )}
                          {Number(formData.decimals) === 6 && (
                            <>
                              <strong>Стандартная точность:</strong> Ваш токен можно делить до 6 знаков. Например: 0.000001 токена. 
                              Самый популярный выбор для большинства токенов.
                            </>
                          )}
                          {Number(formData.decimals) === 9 && (
                            <>
                              <strong>Высокая точность:</strong> Ваш токен можно делить до 9 знаков, как SOL. Например: 0.000000001 токена. 
                              Подходит для микроплатежей и DeFi.
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Пример отображения */}
                    <div className="bg-green-50 p-2.5 sm:p-3 rounded-lg">
                      <h5 className="text-sm sm:text-base font-semibold text-green-800 mb-1 sm:mb-2">Пример:</h5>
                      <p className="text-xs sm:text-sm text-green-700">
                        {Number(formData.decimals) === 0 && "1 токен = 1 токен (нельзя разделить)"}
                        {Number(formData.decimals) === 2 && "1 токен = 1.00 токена (можно: 0.50, 0.01)"}
                        {Number(formData.decimals) === 6 && "1 токен = 1.000000 токена (можно: 0.000001)"}
                        {Number(formData.decimals) === 9 && "1 токен = 1.000000000 токена (можно: 0.000000001)"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Футер модального окна */}
                <div className="p-4 sm:p-5 bg-gray-50 border-t flex-shrink-0">
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm sm:text-base font-semibold rounded-lg hover:opacity-90 transition-all duration-200"
                  >
                    Понятно, закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

}