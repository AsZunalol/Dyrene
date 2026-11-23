"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getTranslator, LANGUAGE_COOKIE, localeFor, type Language } from "@/lib/i18n";

const LanguageContext = createContext({
  language: "en" as Language,
  locale: "en-GB",
  t: getTranslator("en"),
  setLanguage: (_language: Language) => {},
});

export function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: ReactNode }) {
  const [language, updateLanguage] = useState(initialLanguage);
  const router = useRouter();
  const value = useMemo(() => ({
    language,
    locale: localeFor(language),
    t: getTranslator(language),
    setLanguage(next: Language) {
      updateLanguage(next);
      document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
      document.documentElement.lang = next;
      router.refresh();
    },
  }), [language, router]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  return useContext(LanguageContext);
}
