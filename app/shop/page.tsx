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
    <main className="hub-page">
      {isAdmin && <AddShopItemForm />}
      <WeaponsShop isAdmin={isAdmin} />
    </main>
  );
}
