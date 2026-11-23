import { getTranslations } from "@/lib/i18n/server";
import PageHeader from "@/components/PageHeader";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import AdminUsersTable from "@/components/AdminUsersTable";
import { getGuildMemberWithBot, getGuildRolesWithBot } from "@/lib/discord";

type Profile = {
  id: string;
  discord_id: string | null;
  discord_username: string | null;
  global_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  last_seen: string | null;
  created_at: string | null;
};

type RoleOption = {
  id: string;
  name: string;
};

type ProfileWithOnlineAndRoles = Profile & {
  online: boolean;
  currentRoles: RoleOption[];
};

function isRecentlyOnline(lastSeen: string | null) {
  if (!lastSeen) return false;

  const diff = Date.now() - new Date(lastSeen).getTime();

  return diff < 5 * 60 * 1000;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const assignableRoles: RoleOption[] = [
  { id: "1494050530668838913", name: "Prøvemedlem" },
  { id: "1452754466549006356", name: "Medlem" },
  { id: "1494052455816757330", name: "Dyrene" },
];

export default async function AdminPage() {
  const { t } = await getTranslations();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.is_admin !== true) {
    redirect("/");
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profiles, error } = await adminSupabase
    .from("profiles")
    .select("*")
    .order("last_seen", { ascending: false });

  if (error) {
    console.error("Failed to load profiles:", JSON.stringify(error, null, 2));
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  const baseUsers = (profiles || []) as Profile[];

  if (!guildId) {
    console.error("Missing DISCORD_GUILD_ID");

    const usersWithoutDiscordRoles: ProfileWithOnlineAndRoles[] = baseUsers.map(
      (profile) => ({
        ...profile,
        online: isRecentlyOnline(profile.last_seen),
        currentRoles: [],
      }),
    );

    return (
    <main className="hub-page">
      <PageHeader icon="shield" eyebrow={t("Management")} title={t("Administration")} description={t("Manage members, review recent activity, and update Discord roles.")} />
      <section className="hub-panel p-4 sm:p-6"><AdminUsersTable
              users={usersWithoutDiscordRoles}
              assignableRoles={assignableRoles}
            /></section>
    </main>
  );
  }

  let guildRoles: RoleOption[] = [];

  try {
    const discordRoles = await getGuildRolesWithBot(guildId);

    guildRoles = discordRoles
      .filter((role) => role.name !== "@everyone")
      .map((role) => ({
        id: role.id,
        name: role.name,
      }));
  } catch (err) {
    console.error("Failed to fetch guild roles:", err);
  }

  const users: ProfileWithOnlineAndRoles[] = [];

  for (const profile of baseUsers) {
    let currentRoles: RoleOption[] = [];

    if (profile.discord_id) {
      try {
        const member = await getGuildMemberWithBot(guildId, profile.discord_id);

        currentRoles = guildRoles.filter(
          (role) =>
            Array.isArray(member.roles) && member.roles.includes(role.id),
        );

        await sleep(150);
      } catch (err) {
        console.error(
          `Failed to fetch Discord roles for user ${profile.discord_id}:`,
          err,
        );
      }
    }

    users.push({
      ...profile,
      online: isRecentlyOnline(profile.last_seen),
      currentRoles,
    });
  }

  return (
    <main className="hub-page">
      <PageHeader icon="shield" eyebrow={t("Management")} title={t("Administration")} description={t("Manage members, review recent activity, and update Discord roles.")} />
      <section className="hub-panel p-4 sm:p-6"><AdminUsersTable users={users} assignableRoles={assignableRoles} /></section>
    </main>
  );
}
