import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import AddGangModal from "@/components/AddGangModal";
import GangsList from "@/components/GangsList";

export default async function GangsPage() {
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

  if (!profile?.is_admin) return redirect("/denied");

  const { data: gangs } = await supabase
    .from("gangs")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07203a] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a223d] via-[#103b63] to-[#06111f]" />
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-6xl mx-auto">
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/70">
                  Dyrene Gangs
                </p>
                <h1 className="text-4xl font-bold mt-2">Gangs</h1>
                <p className="text-gray-300 mt-2 text-lg">Gang relations.</p>
              </div>

              <AddGangModal />
            </div>
          </div>

          <div
            className="rounded-2xl p-6 border border-white/10 shadow-lg"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              backdropFilter: "blur(10px)",
            }}
          >
            <GangsList gangs={gangs ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
