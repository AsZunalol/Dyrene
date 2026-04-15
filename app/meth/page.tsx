import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import MethRecipesTable from "@/components/MethRecipesTable";

export const dynamic = "force-dynamic";

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
      <Navbar />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-7xl mx-auto">
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
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