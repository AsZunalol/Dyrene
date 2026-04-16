import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const DISCORD_API = "https://discord.com/api/v10";

async function getGuildMemberWithBot(guildId: string, userId: string) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) throw new Error("Missing DISCORD_BOT_TOKEN");

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch guild member: ${res.status} ${text}`);
  }

  return res.json();
}

function hasRole(member: { roles?: string[] }, roleId: string) {
  return Array.isArray(member.roles) && member.roles.includes(roleId);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/denied" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const discordUserId = user.user_metadata?.provider_id;

  if (!discordUserId) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/denied", request.url));
  }

  try {
    const guildId = process.env.DISCORD_GUILD_ID!;
    const requiredRole = process.env.DISCORD_REQUIRED_ROLE_ID!;
    const adminRole = process.env.DISCORD_ADMIN_ROLE_ID!;

    const member = await getGuildMemberWithBot(guildId, discordUserId);

    const hasAccess = hasRole(member, requiredRole);
    const isAdmin = hasRole(member, adminRole);

    if (!hasAccess) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/denied", request.url));
    }

    const currentAdmin = user.user_metadata?.is_admin === true;

    if (currentAdmin !== isAdmin) {
      await supabase.auth.updateUser({
        data: { is_admin: isAdmin },
      });
    }

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
  } catch (err) {
    console.error("Proxy error:", err);
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/denied", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};