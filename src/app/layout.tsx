import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const manrope = Manrope({
	subsets: ["latin", "cyrillic"],
	variable: "--font-sans",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Fiction Library - электронная библиотека",
	description:
		"Премиальная электронная библиотека с каталогом, поиском и синхронизацией книг.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ru" suppressHydrationWarning className={manrope.variable}>
			<body className={manrope.className} suppressHydrationWarning>
				<AppProviders>{children}</AppProviders>
			</body>
		</html>
	);
}
