import { redirect } from "next/navigation";
import CraftingManager from "@/components/CraftingManager";
import { createServerClient } from "@/lib/supabase/server";

export default async function CraftingPage() {
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
    <main className="relative min-h-screen overflow-hidden bg-[#04111f] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-[#07192d] via-[#0b2742] to-[#020617]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(88,101,242,0.26),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_bottom,rgba(15,23,42,0.78),transparent_48%)]" />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 w-full px-4 pb-10 pt-28 sm:px-6 lg:px-8 2xl:px-10">
        <CraftingManager isAdmin={isAdmin} />
      </div>
    </main>
  );
}