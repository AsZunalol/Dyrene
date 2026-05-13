import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      supabase: null,
      user: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return {
      error: NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      ),
      supabase: null,
      user: null,
    };
  }

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
    .from("map_pins")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error || !auth.supabase || !auth.user) return auth.error!;

    const body = await req.json();

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "").trim();
    const icon = String(body.icon || "pin").trim();
    const color = String(body.color || "#ef4444").trim();
    const image_url = String(body.image_url || "").trim();
    const x_position = Number(body.x_position);
    const y_position = Number(body.y_position);

    if (
      !title ||
      !Number.isFinite(x_position) ||
      !Number.isFinite(y_position)
    ) {
      return NextResponse.json(
        { error: "Missing title or map position" },
        { status: 400 },
      );
    }

    const { data, error } = await auth.supabase
      .from("map_pins")
      .insert([
        {
          title,
          description: description || null,
          category: category || null,
          icon,
          color,
          image_url: image_url || null,
          x_position,
          y_position,
          created_by: auth.user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error || !auth.supabase) return auth.error!;

    const body = await req.json();

    const id = String(body.id || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "").trim();
    const icon = String(body.icon || "pin").trim();
    const color = String(body.color || "#ef4444").trim();
    const image_url = String(body.image_url || "").trim();

    if (!id || !title) {
      return NextResponse.json(
        { error: "Missing pin id or title" },
        { status: 400 },
      );
    }

    const { data, error } = await auth.supabase
      .from("map_pins")
      .update({
        title,
        description: description || null,
        category: category || null,
        icon,
        color,
        image_url: image_url || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error || !auth.supabase) return auth.error!;

    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Missing pin id" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("map_pins")
      .delete()
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
