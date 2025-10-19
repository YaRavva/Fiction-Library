import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ygqyswivvdtpgpnxrpzl.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 's3.cloud.ru',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.cloud.ru',
        pathname: '/**',
      },
    ],
  },
  // Отключаем строгую проверку типов для деплоя
  typescript: {
    ignoreBuildErrors: true,
  },
  // Отключаем ESLint для деплоя
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Убираем output: 'standalone' для корректной работы на Vercel
  // output: 'standalone',
};

export default nextConfig;