import "server-only";
import { createClient } from "@/lib/supabase/server";

type RoleCheck = { expires: number; value: Promise<number> };
const state = globalThis as typeof globalThis & { botRoleChecks?: Map<string, RoleCheck> };
const roleChecks = state.botRoleChecks ??= new Map<string, RoleCheck>();

async function checkRole(discordId: string, guild: string, role: string, token: string) {
  const key = `${guild}:${role}:${discordId}`;
  const cached = roleChecks.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  // One page loads several protected assets at once. Coalesce those checks to
  // avoid exhausting Discord's member endpoint; never use stale results on errors.
  for (const [id, check] of roleChecks) if (check.expires <= Date.now()) roleChecks.delete(id);
  const value = (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${discordId}`, {
          headers: { Authorization: `Bot ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
        });
        if (response.status === 404) return 403;
        if (response.status === 429 && attempt === 0) {
          const limit = await response.json();
          const delay = Number(limit.retry_after);
          if (Number.isFinite(delay) && delay >= 0 && delay <= 3) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000 + 100));
            continue;
          }
        }
        if (!response.ok) return 503;
        const member = await response.json();
        return Array.isArray(member.roles) && member.roles.includes(role) ? 200 : 403;
      }
    } catch { /* Fail closed when Discord cannot verify the role. */ }
    return 503;
  })();
  const check = { expires: Date.now() + 5000, value };
  roleChecks.set(key, check);
  const status = await value;
  if (status === 503 && roleChecks.get(key) === check) roleChecks.delete(key);
  return status;
}

// Never authorize from user_metadata: a signed-in user can edit it themselves.
export async function botAdminAccess(): Promise<{ status: number; userId?: string }> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { status: 401 };
  const identity = user.identities?.find((item) => item.provider === "discord");
  const discordId = identity?.identity_data?.provider_id ?? identity?.identity_data?.sub;
  if (typeof discordId !== "string" || !/^\d{15,20}$/.test(discordId)) return { status: 403 };
  const guild = process.env.DISCORD_GUILD_ID;
  const role = process.env.DISCORD_ADMIN_ROLE_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!guild || !role || !token) return { status: 503 };
  const status = await checkRole(discordId, guild, role, token);
  return status === 200 ? { status, userId: user.id } : { status };
}

export function botAccessError(status: number) {
  return Response.json({ error: status === 401 ? "Sign in to continue." : status === 403
    ? "Discord administrator access is required." : "Could not verify admin access. Try again shortly." },
  { status, headers: { "Cache-Control": "private, no-store" } });
}
