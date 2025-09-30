import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ru">
      <body>
        {children}
      </body>
    </html>
  );
}
