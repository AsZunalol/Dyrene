import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import WeaponsShop from "@/components/WeaponsShop";
import AddShopItemForm from "@/components/AddShopItemForm";

export default async function ShopPage() {
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061526] px-4 pb-14 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-[-12rem] top-20 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-64 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />

      <div className="relative mx-auto max-w-7xl">
        {isAdmin && <AddShopItemForm />}
        <WeaponsShop isAdmin={isAdmin} />
      </div>
    </main>
  );
}
