import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Comfortaa } from "next/font/google";

const comfortaa = Comfortaa({
  subsets: ["latin", "cyrillic"],
  variable: "--font-comfortaa",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fiction Library - Электронная библиотека",
  description: "Удобная читалка FB2 файлов с возможностью скачивания",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className={comfortaa.variable}>
      <body className={comfortaa.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}