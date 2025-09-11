'use client';

import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';
import { getI18nInstance } from '../i18n';
import type { i18n as I18nType } from 'i18next';
import { useEffect, useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [i18nInstance, setI18nInstance] = useState<I18nType | null>(null);

  useEffect(() => {
    async function init() {
      const instance = await getI18nInstance();
      setI18nInstance(instance ?? null); // coerce undefined to null
    }
    init();
  }, []);

  if (!i18nInstance) {
    return (
      <html lang="ru">
        <head>
          {/* Подключение Orbitron через Google Fonts */}
          <link
            href="https://fonts.googleapis.com/css?family=Orbitron:wght@500;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body></body>
      </html>
    );
  }

  return (
    <html lang={i18nInstance.language || 'ru'}>
      <head>
        {/* Подключение Orbitron через Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css?family=Orbitron:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
          <main>{children}</main>
      </body>
    </html>
  );
}
