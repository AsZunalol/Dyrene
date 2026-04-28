import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import WeaponsShop from "@/components/WeaponsShop";

export default async function WeaponsPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  return <WeaponsShop />;
}