import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Indian Stock Market Dashboard | Real-time Technical Analysis",
  description: "Comprehensive Indian Stock Market Dashboard with real-time technical analysis, candlestick charts, RSI, MACD, Bollinger Bands, and intelligent buy/sell signals for NSE stocks.",
  keywords: ["Indian Stock Market", "NSE", "Technical Analysis", "Stock Dashboard", "Candlestick Charts", "RSI", "MACD", "Bollinger Bands", "Trading", "Investment"],
  authors: [{ name: "Stock Dashboard Team" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📈</text></svg>",
  },
  openGraph: {
    title: "Indian Stock Market Dashboard",
    description: "Real-time technical analysis and trading signals for NSE stocks",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Indian Stock Market Dashboard",
    description: "Real-time technical analysis and trading signals for NSE stocks",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
