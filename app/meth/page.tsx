import { getTranslations } from "@/lib/i18n/server";
import PageHeader from "@/components/PageHeader";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import MethRecipesTable from "@/components/MethRecipesTable";
import { canEditMethRecipes } from "@/lib/meth-access";

export default async function MethPage() {
  const { t } = await getTranslations();
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, discord_id")
    .eq("id", user.id)
    .single();

  const canEditMeth = await canEditMethRecipes(profile ?? null);

  return (
    <main className="hub-page">
      <PageHeader icon="lab" eyebrow={t("Research")} title={t("Meth recipes")} description="Explore combinations by phosphorus color, compare results, and track your research." />
      <section className="hub-panel p-4 sm:p-6" aria-label={t("Recipe research")}>
        <MethRecipesTable isAdmin={canEditMeth} />
      </section>
    </main>
  );
}
