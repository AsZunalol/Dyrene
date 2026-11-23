import { cookies } from "next/headers";
import { getTranslator, LANGUAGE_COOKIE, localeFor, type Language } from "./index";

export async function getLanguage(): Promise<Language> {
  return (await cookies()).get(LANGUAGE_COOKIE)?.value === "da" ? "da" : "en";
}

export async function getTranslations() {
  const language = await getLanguage();
  return { language, locale: localeFor(language), t: getTranslator(language) };
}
