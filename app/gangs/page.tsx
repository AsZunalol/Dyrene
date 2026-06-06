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

  const isAdmin = Boolean(profile?.is_admin);

  const { data: gangs } = await supabase
    .from("gangs")
    .select("*")
    .order("created_at", { ascending: false });

  const gangList = gangs ?? [];
  const friendlyCount = gangList.filter((gang) => gang.status === "friendly").length;
  const conflictCount = gangList.filter((gang) => gang.status === "conflict").length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030a13] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_28%),linear-gradient(135deg,#06111f_0%,#09233d_45%,#020617_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />
      <div className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />

      <section className="relative z-10 px-4 pb-14 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="relative p-6 sm:p-8 lg:p-10">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />

              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-blue-200">
                    Dyrene Relations
                  </div>

                  <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                    Gang Network
                  </h1>

                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                    Track alliances, conflicts, members, meetings and important intel in one clean overview.
                  </p>
                </div>

                {isAdmin ? <AddGangModal /> : null}
              </div>

              <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total gangs</p>
                  <p className="mt-2 text-3xl font-black">{gangList.length}</p>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Friendly</p>
                  <p className="mt-2 text-3xl font-black text-emerald-300">{friendlyCount}</p>
                </div>

                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-red-200">Conflict</p>
                  <p className="mt-2 text-3xl font-black text-red-300">{conflictCount}</p>
                </div>
              </div>
            </div>
          </div>

          <GangsList gangs={gangList} isAdmin={isAdmin} />
        </div>
      </section>
    </main>
  );
}
