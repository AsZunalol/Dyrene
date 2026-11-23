import { getTranslations } from "@/lib/i18n/server";
import PageHeader from "@/components/PageHeader";
import HubIcon from "@/components/HubIcon";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AsZunaFishingTracker from "@/components/AsZunaFishingTracker";

const ACCESS_COOKIE = "aszuna_access";
const DEFAULT_PASSCODE = "2075";

async function unlockAsZunaPage(formData: FormData) {
  "use server";

  const passcode = String(formData.get("passcode") ?? "").trim();
  const secretPasscode = process.env.ASZUNA_PASSCODE ?? DEFAULT_PASSCODE;

  if (passcode !== secretPasscode) {
    redirect("/aszuna?locked=1");
  }

  const cookieStore = await cookies();

  cookieStore.set(ACCESS_COOKIE, "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/aszuna");
}

async function lockAsZunaPage() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/aszuna");
}

export default async function AsZunaPage() {
  const { t } = await getTranslations();
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(ACCESS_COOKIE)?.value === "true";

  if (!hasAccess) {
    return (
      <main className="hub-page flex min-h-[calc(100svh-var(--topbar-height))] items-center justify-center">
        <section className="hub-auth-card">
          <div className="hub-auth-mark"><HubIcon name="lock" width="26" height="26" /></div>
          <p className="hub-eyebrow">{t("Personal workspace")}</p>
          <h1>AsZuna</h1>
          <p>{t("Enter your passcode to open your private tools.")}</p>
          <form action={unlockAsZunaPage} className="mt-6">
            <label htmlFor="passcode" className="mb-2 block text-sm text-muted">{t("Passcode")}</label>
            <input id="passcode" name="passcode" type="password" autoComplete="off" placeholder={t("Enter your passcode")} required className="w-full rounded-lg border border-line bg-inset px-4 py-3 text-foreground outline-none focus:border-accent/60" />
            <button type="submit" className="hub-primary">{t("Unlock workspace")}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="hub-page max-w-[1800px]">
      <PageHeader icon="user" eyebrow={t("Personal workspace")} title="AsZuna" description={t("Manage your fishing sessions, compare catches, and track returns.")} actions={<form action={lockAsZunaPage}><button type="submit" className="hub-secondary">{t("Lock workspace")}</button></form>} />
      <AsZunaFishingTracker />
    </main>
  );
}
