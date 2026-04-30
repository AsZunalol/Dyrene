import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      supabase: null,
      user: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return {
      error: NextResponse.json({ error: "Not authorized" }, { status: 403 }),
      supabase: null,
      user: null,
    };
  }

  return { error: null, supabase, user };
}

async function getDiscordServerName(discordId?: string | null) {
  if (
    !discordId ||
    !process.env.DISCORD_GUILD_ID ||
    !process.env.DISCORD_BOT_TOKEN
  ) {
    return null;
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      },
    );

    if (!res.ok) return null;

    const member = await res.json();

    return (
      member?.nick ||
      member?.user?.global_name ||
      member?.user?.username ||
      null
    );
  } catch {
    return null;
  }
}

function normalizeImages(body: any) {
  if (Array.isArray(body.images)) {
    return body.images.filter(
      (image: unknown) => typeof image === "string" && image.trim().length > 0,
    );
  }

  if (typeof body.image === "string" && body.image.trim().length > 0) {
    return [body.image];
  }

  return [];
}

function normalizeCategory(category: unknown) {
  const allowedCategories = [
    "Intel",
    "Meeting",
    "Fight",
    "Alliance",
    "Warning",
    "Screenshot",
  ];

  if (typeof category !== "string") return "Intel";

  const cleanCategory = category.trim();

  const matchedCategory = allowedCategories.find(
    (allowedCategory) =>
      allowedCategory.toLowerCase() === cleanCategory.toLowerCase(),
  );

  return matchedCategory || "Intel";
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const gangId = searchParams.get("gangId");

  if (!gangId) {
    return NextResponse.json({ error: "Missing gangId" }, { status: 400 });
  }

  const { data: members, error: membersError } = await supabase
    .from("gang_members")
    .select("*")
    .eq("gang_id", gangId)
    .order("created_at", { ascending: false });

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const { data: events, error: eventsError } = await supabase
    .from("gang_events")
    .select(
      `
      *,
      gang_event_members (
        member:gang_members (
          id,
          name,
          role,
          phone,
          avatar
        )
      )
    `,
    )
    .eq("gang_id", gangId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  return NextResponse.json({
    members: members ?? [],
    events: events ?? [],
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase || !auth.user) return auth.error!;

  const body = await req.json();

  if (body.type === "member") {
    const { data, error } = await auth.supabase
      .from("gang_members")
      .insert([
        {
          gang_id: body.gangId,
          name: body.name,
          role: body.role,
          phone: body.phone || null,
          avatar: body.avatar || null,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }

  if (body.type === "event") {
    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("discord_name, discord_id")
      .eq("id", auth.user.id)
      .single();

    const discordServerName = await getDiscordServerName(profile?.discord_id);

    const addedByName =
      discordServerName ||
      profile?.discord_name ||
      auth.user.user_metadata?.full_name ||
      auth.user.email ||
      "Unknown";

    const addedByAvatar =
      auth.user.user_metadata?.avatar_url ||
      auth.user.user_metadata?.picture ||
      null;

    const images = normalizeImages(body);
    const category = normalizeCategory(body.category);

    const { data, error } = await auth.supabase
      .from("gang_events")
      .insert([
        {
          gang_id: body.gangId,
          title: body.title,
          description: body.description || null,
          category,
          image: images[0] || null,
          images,
          pinned: Boolean(body.pinned),
          added_by: auth.user.id,
          added_by_email: addedByName,
          added_by_avatar: addedByAvatar,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (Array.isArray(body.memberIds) && body.memberIds.length > 0) {
      const links = body.memberIds.map((memberId: string) => ({
        event_id: data.id,
        member_id: memberId,
      }));

      const { error: linkError } = await auth.supabase
        .from("gang_event_members")
        .insert(links);

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }

    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error!;

  const body = await req.json();

  if (body.type === "member") {
    const { data, error } = await auth.supabase
      .from("gang_members")
      .update({
        name: body.name,
        role: body.role,
        phone: body.phone || null,
        avatar: body.avatar || null,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  if (body.type === "event") {
    const images = normalizeImages(body);
    const category = normalizeCategory(body.category);

    const { data, error } = await auth.supabase
      .from("gang_events")
      .update({
        title: body.title,
        description: body.description || null,
        category,
        image: images[0] || null,
        images,
        pinned: Boolean(body.pinned),
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: deleteLinksError } = await auth.supabase
      .from("gang_event_members")
      .delete()
      .eq("event_id", body.id);

    if (deleteLinksError) {
      return NextResponse.json(
        { error: deleteLinksError.message },
        { status: 500 },
      );
    }

    if (Array.isArray(body.memberIds) && body.memberIds.length > 0) {
      const links = body.memberIds.map((memberId: string) => ({
        event_id: body.id,
        member_id: memberId,
      }));

      const { error: linkError } = await auth.supabase
        .from("gang_event_members")
        .insert(links);

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }

    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error!;

  const body = await req.json();

  if (body.type === "member") {
    const { error } = await auth.supabase
      .from("gang_members")
      .delete()
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (body.type === "event") {
    await auth.supabase
      .from("gang_event_members")
      .delete()
      .eq("event_id", body.id);

    const { error } = await auth.supabase
      .from("gang_events")
      .delete()
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
