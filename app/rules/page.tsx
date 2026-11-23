import type { Metadata } from "next";
import RulesHandbook from "./RulesHandbook";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t("Rules & etiquette")} | Dyrene` };
}

export default function RulesPage() {
  return <RulesHandbook />;
}
