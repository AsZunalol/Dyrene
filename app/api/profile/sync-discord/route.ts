import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const discordIdentity = user.identities?.find(
    (identity) => identity.provider === "discord",
  );

  const identityData = discordIdentity?.identity_data;

  const discordId =
    discordIdentity?.id ||
    identityData?.provider_id ||
    identityData?.sub ||
    null;

  const discordName =
    identityData?.full_name ||
    identityData?.name ||
    identityData?.preferred_username ||
    identityData?.user_name ||
    identityData?.username ||
    null;

  const discordAvatar =
    identityData?.avatar_url ||
    identityData?.picture ||
    identityData?.avatar ||
    null;

  const { error } = await supabase
    .from("profiles")
    .update({
      discord_id: discordId,
      discord_name: discordName,
      discord_avatar: discordAvatar,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    discord_id: discordId,
    discord_name: discordName,
    discord_avatar: discordAvatar,
  });
}
