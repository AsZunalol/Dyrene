import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addGuildMemberRole,
  removeGuildMemberRole,
  getAssignableRoleIds,
} from "@/lib/discord";

type RequestBody = {
  discordUserId?: string;
  roleId?: string;
  action?: "add" | "remove";
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (user.user_metadata?.is_admin !== true) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const { discordUserId, roleId, action } = body;

    if (!discordUserId || !roleId || !action) {
      return NextResponse.json(
        { error: "Missing discordUserId, roleId, or action" },
        { status: 400 }
      );
    }

    if (action !== "add" && action !== "remove") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      return NextResponse.json(
        { error: "Missing DISCORD_GUILD_ID" },
        { status: 500 }
      );
    }

    const assignableRoleIds = getAssignableRoleIds();

    if (!assignableRoleIds.includes(roleId)) {
      return NextResponse.json(
        { error: "That role is not allowed to be managed from the website" },
        { status: 403 }
      );
    }

    const actorName =
      user.user_metadata?.full_name ||
      user.user_metadata?.user_name ||
      user.email ||
      user.id;

    const reason = `Website admin action by ${actorName}`;

    if (action === "add") {
      await addGuildMemberRole(guildId, discordUserId, roleId, reason);
    } else {
      await removeGuildMemberRole(guildId, discordUserId, roleId, reason);
    }

    return NextResponse.json({
      success: true,
      action,
      discordUserId,
      roleId,
    });
  } catch (error) {
    console.error("Admin role update error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}