const nextConfig = {
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
  // Отключаем сборку статических страниц
  experimental: {
    serverComponentsExternalPackages: ['react', 'react-dom'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ygqyswivvdtpgpnxrpzl.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = nextConfig;