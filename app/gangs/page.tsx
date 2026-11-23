import { getTranslations } from "@/lib/i18n/server";
import PageHeader from "@/components/PageHeader";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import AddGangModal from "@/components/AddGangModal";
import GangsList from "@/components/GangsList";

export default async function GangsPage() {
  const { t } = await getTranslations();
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = Boolean(profile?.is_admin);

  const { data: gangs } = await supabase
    .from("gangs")
    .select("*")
    .order("created_at", { ascending: false });

  const gangList = gangs ?? [];
  const friendlyCount = gangList.filter((gang) => gang.status === "friendly").length;
  const conflictCount = gangList.filter((gang) => gang.status === "conflict").length;

  return (
    <main className="hub-page">
      <PageHeader icon="gangs" eyebrow={t("Relations")} title={t("Gang network")} description={t("Keep track of relationships, members, meetings, and shared intel.")} actions={isAdmin ? <AddGangModal /> : undefined} />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="hub-stat"><p>{t("Total gangs")}</p><p>{gangList.length}</p></div>
        <div className="hub-stat"><p>{t("Friendly")}</p><p className="text-accent">{friendlyCount}</p></div>
        <div className="hub-stat"><p>{t("In conflict")}</p><p className="text-red-300">{conflictCount}</p></div>
      </div>
      <GangsList gangs={gangList} isAdmin={isAdmin} />
    </main>
  );
}
