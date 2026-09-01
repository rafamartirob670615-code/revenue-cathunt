import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import LegalNotice from "./LegalNotice";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "REVENUE | Crear Plan anual",
  description: "Construye, explica, presenta y envía un Plan anual defendible.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon-256.png", sizes: "256x256", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className={geistSans.variable}><body>{children}<LegalNotice /></body></html>;
}
