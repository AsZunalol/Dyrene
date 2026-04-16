import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getGuildMemberWithBot, memberHasRole } from "@/lib/discord";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/denied", origin));
  }

  let response = NextResponse.redirect(new URL("/", origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get("cookie") ?? "";
          if (!cookieHeader) return [];

          return cookieHeader.split(";").map((cookie) => {
            const [name, ...rest] = cookie.trim().split("=");
            return {
              name,
              value: rest.join("="),
            };
          });
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  try {
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
      const deniedResponse = NextResponse.redirect(new URL("/denied", origin));
      deniedResponse.cookies.set("sb-access-token", "", { maxAge: 0, path: "/" });
      deniedResponse.cookies.set("sb-refresh-token", "", { maxAge: 0, path: "/" });
      return deniedResponse;
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

    return response;
  } catch (err) {
    console.error("Discord callback error:", err);
    return NextResponse.redirect(new URL("/denied", origin));
  }
}