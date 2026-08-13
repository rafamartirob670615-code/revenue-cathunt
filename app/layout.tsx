import type { Metadata } from "next";
import "./globals.css";
import LegalNotice from "./LegalNotice";

export const metadata: Metadata = {
  title: "REVENUE | Crear Plan anual",
  description: "Construye, explica, presenta y envía un Plan anual defendible.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}<LegalNotice /></body></html>;
}
