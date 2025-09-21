/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'react-native',
    'react-native-web',
    'expo',
    'expo-linking',
    'expo-constants',
    'expo-modules-core',
    'expo-modules-autolinking',
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
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native$': 'react-native-web',
    };
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

let withExpo;
try {
  withExpo = require('@expo/next-adapter').withExpo;
} catch (e) {
  console.warn(
    '@expo/next-adapter not found. Skipping withExpo wrapper. Please install it if you need expo support.'
  );
  withExpo = (config) => config;
}

module.exports = withExpo(nextConfig);
