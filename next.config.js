/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // swcMinify: true,  // Уберите или закомментируйте
  transpilePackages: [
    'react-native',
    'react-native-web',
    'expo',
    'expo-linking',
    'expo-constants',
    '@expo/next-adapter',
      'expo-modules-core', // добавьте этот пакет
  'expo-modules-autolinking', // возможно нужно
    'react-native-svg',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
  experimental: {
    forceSwcTransforms: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

const { withExpo } = require('@expo/next-adapter');
module.exports = withExpo(nextConfig);
