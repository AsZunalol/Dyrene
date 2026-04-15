import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGuildMemberWithBot, memberHasRole } from "@/lib/discord";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/denied", origin));
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error("Supabase code exchange error:", error);
      return NextResponse.redirect(new URL("/denied", origin));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/denied", origin));
    }

    const discordUserId = user.user_metadata?.provider_id;

    if (!discordUserId) {
      console.error("Missing Discord provider_id");
      return NextResponse.redirect(new URL("/denied", origin));
    }

    const guildId = process.env.DISCORD_GUILD_ID!;
    const requiredRoleId = process.env.DISCORD_REQUIRED_ROLE_ID!;
    const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID!;

    const member = await getGuildMemberWithBot(guildId, discordUserId);

    const hasAccess = memberHasRole(member, requiredRoleId);
    const isAdmin = memberHasRole(member, adminRoleId);

    if (!hasAccess) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/denied", origin));
    }

    await supabase.auth.updateUser({
      data: {
        is_admin: isAdmin,
      },
    });

    await supabase.from("profiles").upsert({
      id: user.id,
      discord_id: discordUserId,
      discord_username:
        user.user_metadata?.user_name ||
        user.user_metadata?.preferred_username ||
        user.user_metadata?.name ||
        null,
      global_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.custom_claims?.global_name ||
        null,
      avatar_url: user.user_metadata?.avatar_url || null,
      is_admin: isAdmin,
      last_seen: new Date().toISOString(),
    });

    return NextResponse.redirect(new URL("/", origin));
  } catch (err) {
    console.error("Discord callback error:", err);
    return NextResponse.redirect(new URL("/denied", origin));
  }
}