import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { NetworkLab } from "@/components/NetworkLab";
import { StoreProvider } from "@/components/StoreProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Bookly: book and pay for local services", template: "%s · Bookly" },
  description:
    "Book stylists, trainers, photographers and coaches across Lagos and Accra. Real-time availability, payments in ₦, $ and ₵.",
};

export const viewport: Viewport = { themeColor: "#0c7a57" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <StoreProvider>
          <Header />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <footer className="border-t border-line py-8 pb-20 text-center text-xs text-muted">
            Bookly is a portfolio project by Elizabeth Daniel. No real payments are taken.
          </footer>
          <NetworkLab />
        </StoreProvider>
      </body>
    </html>
  );
}
