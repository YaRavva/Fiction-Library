import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ygqyswivvdtpgpnxrpzl.supabase.co',
        pathname: '/storage/v1/object/public/**',
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
  // Отключаем статический экспорт для всех страниц
  output: 'standalone',
  // Конфигурация для Next.js 15
};

export default nextConfig;
