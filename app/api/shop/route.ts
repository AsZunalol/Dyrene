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
    };
  }

  return { error: null, supabase };
}

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shop_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error!;

  const body = await req.json();

  const { data, error } = await auth.supabase
    .from("shop_items")
    .insert([
      {
        name: body.name,
        category: body.category || null,
        price: Number(body.price),
        image: body.image || null,
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}