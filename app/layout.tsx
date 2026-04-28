import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import packageJson from "@/package.json";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Salon Admin",
  description: "Salon management MVP for customer and chart operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-gray-200 bg-white px-4 py-2">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between text-xs text-gray-500">
            <span>Salon MVP v{packageJson.version}</span>
            <a href="/api/health" className="hover:underline">
              health
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
