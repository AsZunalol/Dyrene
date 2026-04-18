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
      error: NextResponse.json({ error: profileError.message }, { status: 500 }),
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

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const limitParam = Number(searchParams.get("limit") || "6");
  const offsetParam = Number(searchParams.get("offset") || "0");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();

  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, 100))
    : 6;

  const offset = Number.isFinite(offsetParam)
    ? Math.max(0, offsetParam)
    : 0;

  let query = supabase
    .from("cars")
    .select("*")
    .order("price", { ascending: false })
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%`);
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error || !auth.supabase) return auth.error!;

    const body = await req.json();

    const { data, error } = await auth.supabase
      .from("cars")
      .insert([
        {
          name: body.name,
          brand: body.brand || null,
          price: body.price ? Number(body.price) : null,
          image: body.image || null,
          status: body.status,
          featured: Boolean(body.featured),
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

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error || !auth.supabase) return auth.error!;

    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Missing car id" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("cars")
      .update({
        name: body.name,
        brand: body.brand || null,
        price: body.price ? Number(body.price) : null,
        image: body.image || null,
        status: body.status,
        featured: Boolean(body.featured),
      })
      .eq("id", body.id)
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
      return NextResponse.json({ error: "Missing car id" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("cars")
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