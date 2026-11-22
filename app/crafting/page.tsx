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
    <main className="hub-page max-w-none">
      <CraftingManager isAdmin={isAdmin} />
    </main>
  );
}
