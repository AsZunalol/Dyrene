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
    <main className="relative min-h-screen overflow-hidden text-white">

      <div className="relative z-10 w-full px-4 pb-10 pt-28 sm:px-6 lg:px-8 2xl:px-10">
        <CraftingManager isAdmin={isAdmin} />
      </div>
    </main>
  );
}