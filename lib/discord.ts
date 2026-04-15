const DISCORD_API = "https://discord.com/api/v10";

export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
};

export type DiscordGuildMember = {
  user?: DiscordUser;
  roles?: string[];
};

export type DiscordGuildRole = {
  id: string;
  name: string;
};

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Discord user: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getGuildMemberWithBot(
  guildId: string,
  userId: string
): Promise<DiscordGuildMember> {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Missing DISCORD_BOT_TOKEN");
  }

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

export async function getGuildRolesWithBot(
  guildId: string
): Promise<DiscordGuildRole[]> {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Missing DISCORD_BOT_TOKEN");
  }

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch guild roles: ${res.status} ${text}`);
  }

  return res.json();
}

export async function addGuildMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason?: string
): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Missing DISCORD_BOT_TOKEN");
  }

  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        ...(reason ? { "X-Audit-Log-Reason": encodeURIComponent(reason) } : {}),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to add role: ${res.status} ${text}`);
  }
}

export async function removeGuildMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason?: string
): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Missing DISCORD_BOT_TOKEN");
  }

  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`,
        ...(reason ? { "X-Audit-Log-Reason": encodeURIComponent(reason) } : {}),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to remove role: ${res.status} ${text}`);
  }
}

export function memberHasRole(
  member: DiscordGuildMember,
  roleId: string
): boolean {
  return Array.isArray(member.roles) && member.roles.includes(roleId);
}

export function memberHasRequiredRole(
  member: DiscordGuildMember,
  requiredRoleId: string
): boolean {
  return memberHasRole(member, requiredRoleId);
}

export function memberHasAdminRole(
  member: DiscordGuildMember,
  adminRoleId: string
): boolean {
  return memberHasRole(member, adminRoleId);
}

export function getAssignableRoleIds(): string[] {
  const raw = process.env.DISCORD_ASSIGNABLE_ROLE_IDS || "";

  return raw
    .split(",")
    .map((roleId) => roleId.trim())
    .filter(Boolean);
}