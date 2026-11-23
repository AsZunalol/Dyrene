import { redirect } from "next/navigation";
import { botAdminAccess } from "@/lib/bot-admin";
import DiscordDashboard from "@/components/DiscordDashboard";
import { getTranslations } from "@/lib/i18n/server";
import styles from "./page.module.css";

export default async function BotAdminPage() {
  const access = await botAdminAccess();
  if (access.status === 401) redirect("/login");
  if (access.status === 403) redirect("/denied");
  const { t } = await getTranslations();
  return <main className={styles.workspace}>
    {access.status === 200 ? <DiscordDashboard userId={access.userId!} />
      : <section className="hub-panel p-6" role="alert">{t("Could not verify admin access. Try again shortly.")}</section>}
  </main>;
}
