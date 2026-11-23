import { da } from "./da";
import { discordDa } from "./discord-da";

export type Language = "en" | "da";
export const LANGUAGE_COOKIE = "dyrene-language";
export const localeFor = (language: Language) => language === "da" ? "da-DK" : "en-GB";

// Keep stored values and user-authored content in their original language.
// Only interface copy is passed through this translator.
const englishOverrides: Record<string, string> = {
  Fosfor: "Phosphorus", Renhed: "Purity", Stabiliseringstid: "Stabilisation time",
  "Renhed:": "Purity:", "· Stabiliseringstid:": "· Stabilisation time:",
  Pseudoephedrin: "Pseudoephedrine",
  "Highest renhed": "Highest purity", "Lowest renhed": "Lowest purity",
  "Highest stabiliseringstid": "Longest stabilisation time", "Lowest stabiliseringstid": "Shortest stabilisation time",
  "Only missing renhed/stabiliseringstid": "Only missing purity/stabilisation time",
  "Admin mode: you can edit renhed and stabiliseringstid": "Admin mode: you can edit purity and stabilisation time",
  "Picks a random recipe that still needs renhed or stabiliseringstid.": "Picks a random recipe that still needs purity or stabilisation time.",
  "Browse recipes 50 at a time for the selected fosfor color.": "Browse recipes 50 at a time for the selected phosphorus colour.",
  "Connecting to Discord?": "Connecting to Discord…",
};

export function getTranslator(language: Language) {
  return (text: string, values?: Record<string, string | number>): string => {
    const translated = language === "da" ? (discordDa[text] ?? da[text] ?? text) : (englishOverrides[text] ?? text);
    return values ? translated.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match)) : translated;
  };
}

export type Translate = ReturnType<typeof getTranslator>;
