// app/components/SignOutButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleSignOut}
      className="ml-4 px-3 py-2 rounded-md bg-white/6 border border-white/10 text-sm"
    >
      Sign out
    </button>
  );
}

/**
 * Also provide a programmatic helper so the server-side script can call it if dynamically imported.
 * The helper will perform the same sign-out and redirect.
 */
export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/login";
}