import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// 06 §5: fontlar next/font ile build'de self-host edilir — runtime Google Fonts isteği YOK
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Piravel OS",
  description: "Ajans, finans, müşteri ve operasyon yönetim sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${instrumentSans.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
