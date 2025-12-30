import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ToasterProvider } from "@/components/providers/toaster-provider";

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
    <html lang="ru" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}