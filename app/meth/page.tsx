import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import MethRecipesTable from "@/components/MethRecipesTable";

export default async function MethPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = Boolean(profile?.is_admin);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07203a] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a223d] via-[#103b63] to-[#06111f]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(15,23,42,0.65),transparent_45%)]" />
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-7xl mx-auto">
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
              backdropFilter: "blur(10px)",
            }}
          >
            <p className="text-sm uppercase tracking-[0.3em] text-white/70">
              Dyrene Lab
            </p>
            <h1 className="text-4xl font-bold text-white mt-2">Meth Recipes</h1>
            <p className="text-gray-300 mt-2 text-lg max-w-3xl">
              Choose fosfor color, browse all 1000 combinations for that color,
              and sort by renhed or stabiliseringstid.
            </p>
          </div>

          <div
            className="rounded-2xl p-6 border border-white/10 shadow-lg"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              backdropFilter: "blur(10px)",
            }}
          >
            <MethRecipesTable isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </div>
  );
}