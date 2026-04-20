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

const assignableRoles: RoleOption[] = [
  { id: "1494050530668838913", name: "Prøvemedlem" },
  { id: "1452754466549006356", name: "Medlem" },
  { id: "1494052455816757330", name: "Dyrene" },
];

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.is_admin !== true) {
    redirect("/");
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles, error } = await adminSupabase
    .from("profiles")
    .select("*")
    .order("last_seen", { ascending: false });

  if (error) {
    console.error("Failed to load profiles:", JSON.stringify(error, null, 2));
  }

  const guildId = process.env.DISCORD_GUILD_ID!;
  const baseUsers = (profiles || []) as Profile[];

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

  const users: ProfileWithOnlineAndRoles[] = await Promise.all(
    baseUsers.map(async (profile) => {
      let currentRoles: RoleOption[] = [];

      if (profile.discord_id) {
        try {
          const member = await getGuildMemberWithBot(guildId, profile.discord_id);

          currentRoles = guildRoles.filter(
            (role) =>
              Array.isArray(member.roles) && member.roles.includes(role.id)
          );
        } catch (err) {
          console.error(
            `Failed to fetch Discord roles for user ${profile.discord_id}:`,
            err
          );
        }
      }

      return {
        ...profile,
        online: isRecentlyOnline(profile.last_seen),
        currentRoles,
      };
    })
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07203a]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="absolute inset-0 backdrop-blur-md bg-black/50" />

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-7xl mx-auto">
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              backdropFilter: "blur(10px)",
            }}
          >
            <h1 className="text-4xl font-bold text-white">Admin Panel</h1>
            <p className="text-gray-300 mt-2">
              Manage users and Discord roles
            </p>
          </div>

          <AdminUsersTable
            users={users}
            assignableRoles={assignableRoles}
          />
        </div>
      </div>
    </div>
  );
}