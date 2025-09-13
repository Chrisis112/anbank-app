import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link
          href="https://fonts.googleapis.com/css?family=Orbitron:wght@500;700&display=swap"
          rel="stylesheet"
        />
        {/* При необходимости можно добавить мета-теги для темы PWA */}
        <meta name="theme-color" content="#0057ff" />
        {/* Регистрация service worker */}
<script>
  if('serviceWorker' in navigator)
    navigator.serviceWorker.register('/sw.js')
</script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
