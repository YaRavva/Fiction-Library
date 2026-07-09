import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "ygqyswivvdtpgpnxrpzl.supabase.co",
				pathname: "/storage/v1/object/public/**",
			},
			{
				protocol: "https",
				hostname: "s3.cloud.ru",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "*.s3.cloud.ru",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
				pathname: "/**",
			},
		],
	},
	// Включаем строгую проверку типов
	typescript: {
		ignoreBuildErrors: false,
	},
	// Убираем output: 'standalone' для корректной работы на Vercel
	// output: 'standalone',
};

export default nextConfig;
