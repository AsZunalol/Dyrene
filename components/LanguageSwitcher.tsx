"use client";

import { useTranslation } from "./LanguageProvider";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();
  return (
    <div className="language-switcher" role="group" aria-label={language === "da" ? "Vælg sprog" : "Choose language"}>
      <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
      <button type="button" lang="da" aria-pressed={language === "da"} onClick={() => setLanguage("da")}>Dansk</button>
    </div>
  );
}
