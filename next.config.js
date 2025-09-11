/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    domains: ['your-domain.s3.amazonaws.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
