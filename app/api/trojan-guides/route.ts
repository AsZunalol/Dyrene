import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TrojanGuideRow = {
  id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  short_description: string | null;
  content: string | null;
  cover_image: string | null;
  images: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

type ProfileRow = {
  id: string;
  discord_username: string | null;
  global_name: string | null;
  avatar_url: string | null;
};

function getDiscordDisplayName(profile?: ProfileRow) {
  return profile?.global_name || profile?.discord_username || "Unknown operator";
}

async function attachAuthors(supabase: Awaited<ReturnType<typeof createClient>>, guides: TrojanGuideRow[]) {
  const authorIds = Array.from(
    new Set(guides.map((guide) => guide.created_by).filter(Boolean) as string[]),
  );

  if (authorIds.length === 0) {
    return guides.map((guide) => ({
      ...guide,
      author_name: "Unknown operator",
      author_avatar_url: null,
    }));
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, discord_username, global_name, avatar_url")
    .in("id", authorIds);

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return guides.map((guide) => {
    const profile = guide.created_by ? profileMap.get(guide.created_by) : undefined;

    return {
      ...guide,
      author_name: getDiscordDisplayName(profile),
      author_avatar_url: profile?.avatar_url ?? null,
    };
  });
}

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

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trojan_guides")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const guidesWithAuthors = await attachAuthors(supabase, (data ?? []) as TrojanGuideRow[]);

  return NextResponse.json(guidesWithAuthors);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase || !auth.user) return auth.error!;

  const body = await req.json();
  const title = String(body.title || "").trim();

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("trojan_guides")
    .insert([
      {
        title,
        category: body.category || null,
        difficulty: body.difficulty || null,
        short_description: body.short_description || null,
        content: body.content || "",
        cover_image: body.cover_image || null,
        images: Array.isArray(body.images) ? body.images : [],
        created_by: auth.user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error!;

  const body = await req.json();
  const id = String(body.id || "").trim();
  const title = String(body.title || "").trim();

  if (!id || !title) {
    return NextResponse.json(
      { error: "Guide id and title are required" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("trojan_guides")
    .update({
      title,
      category: body.category || null,
      difficulty: body.difficulty || null,
      short_description: body.short_description || null,
      content: body.content || "",
      cover_image: body.cover_image || null,
      images: Array.isArray(body.images) ? body.images : [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error!;

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();

  if (!id) {
    return NextResponse.json({ error: "Guide id is required" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("trojan_guides")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
