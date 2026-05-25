import {
  getGuildMemberWithBot,
  getGuildRolesWithBot,
  memberHasRole,
} from "@/lib/discord";

type MethAccessProfile = {
  is_admin: boolean | null;
  discord_id: string | null;
};

let cachedMethRoleId: string | null | undefined;

async function getMethAnsvarligRoleId() {
  if (cachedMethRoleId !== undefined) {
    return cachedMethRoleId;
  }

  const roleId =
    process.env.DISCORD_METH_ANSVARLIG_ROLE_ID ||
    process.env.METH_ANSVARLIG_ROLE_ID ||
    "";

  if (roleId.trim()) {
    cachedMethRoleId = roleId.trim();
    return cachedMethRoleId;
  }

  const guildId = process.env.DISCORD_GUILD_ID;

  if (!guildId) {
    cachedMethRoleId = null;
    return cachedMethRoleId;
  }

  const roleName = (
    process.env.DISCORD_METH_ANSVARLIG_ROLE_NAME || "meth ansvarlig"
  )
    .trim()
    .toLowerCase();

  try {
    const roles = await getGuildRolesWithBot(guildId);
    const role = roles.find(
      (item) => item.name.trim().toLowerCase() === roleName,
    );

    cachedMethRoleId = role?.id ?? null;
    return cachedMethRoleId;
  } catch (error) {
    console.error("Failed to resolve meth ansvarlig role:", error);
    cachedMethRoleId = null;
    return cachedMethRoleId;
  }
}

export async function canEditMethRecipes(profile: MethAccessProfile | null) {
  if (!profile) return false;
  if (profile.is_admin === true) return true;
  if (!profile.discord_id) return false;

  const guildId = process.env.DISCORD_GUILD_ID;
  const methRoleId = await getMethAnsvarligRoleId();

  if (!guildId || !methRoleId) {
    return false;
  }

  try {
    const member = await getGuildMemberWithBot(guildId, profile.discord_id);
    return memberHasRole(member, methRoleId);
  } catch (error) {
    console.error("Failed to check meth ansvarlig role:", error);
    return false;
  }
}
