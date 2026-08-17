import type { Metadata } from "next";
import "./globals.css";
import LegalNotice from "./LegalNotice";

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
  return <html lang="es"><body>{children}<LegalNotice /></body></html>;
}
