import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PageTransitionLoader from "@/components/PageTransitionLoader";
import { isComingSoon } from "@/lib/site-mode";
import { getLanguage } from "@/lib/i18n/server";
import { LanguageProvider } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const danish = (await getLanguage()) === "da";
  return {
    title: isComingSoon ? (danish ? "Dyrene — Kommer i december" : "Dyrene — Coming in December") : "Dyrene Gangsite",
    description: isComingSoon
      ? (danish ? "Noget nyt er på vej. Kommer 1. december 2026. Følg med." : "Something new is on the way. Coming December 1, 2026. Stay tuned.")
      : (danish ? "Lavet af AsZuna" : "Made by AsZuna"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getLanguage();
  return (
    <html
      lang={language}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" data-site-mode={isComingSoon ? "prelaunch" : "workspace"}>
        <div className="site-background" aria-hidden="true" />
        <LanguageProvider initialLanguage={language}>
          <LanguageSwitcher />
          {!isComingSoon && <Navbar />}
          <div className="page-content">
            <PageTransitionLoader>{children}</PageTransitionLoader>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
