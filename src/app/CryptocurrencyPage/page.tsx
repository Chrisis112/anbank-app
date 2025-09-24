'use client';

import React, { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';

interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
}

export default function CryptocurrencyPage() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);

  useEffect(() => {
    (async () => {
      // Получаем список созданных токенов с backend-а
      const { data } = await axios.get<TokenInfo[]>('/api/created-tokens');
      setTokens(data);
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Криптовалюта</h1>
      {tokens.length === 0 ? (
        <p>Токены не созданы</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tokens.map((t) => (
            <div key={t.mint} className="border rounded-lg p-4 bg-white">
              <img src={t.uri && `${t.uri}`} alt={t.name} className="w-16 h-16 mb-2" />
              <h2 className="font-semibold">{t.name}</h2>
              <p className="text-sm text-gray-600">{t.symbol}</p>
              <p className="text-xs break-all mt-2">Mint: {t.mint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
