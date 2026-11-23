import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PageTransitionLoader from "@/components/PageTransitionLoader";
import { isComingSoon } from "@/lib/site-mode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: isComingSoon ? "The Strays — Soon" : "The Strays",
  description: isComingSoon
    ? "The Strays. Something new is on the way. Coming soon. Stay tuned."
    : "Made by AsZuna",
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
        <div className="site-background" aria-hidden="true" />
        {!isComingSoon && <Navbar />}
        <PageTransitionLoader>{children}</PageTransitionLoader>
      </body>
    </html>
  );
}
