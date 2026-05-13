import GtaMap from "@/components/GtaMap";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    isAdmin = profile?.is_admin === true;
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#0fa8d2]">
      <GtaMap isAdmin={isAdmin} />
    </main>
  );
}
