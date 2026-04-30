import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* -------------------- ADMIN CHECK -------------------- */
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

/* -------------------- GET (FETCH ALL GANGS) -------------------- */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gangs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

/* -------------------- POST (CREATE GANG) -------------------- */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error!;

  const body = await req.json();

  const { data, error } = await auth.supabase
    .from("gangs")
    .insert([
      {
        name: body.name,
        image: body.image || null,
        description: body.description || null,
        status: body.status || "friendly",
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/* -------------------- PATCH (UPDATE GANG) -------------------- */
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error!;

  const body = await req.json();

  const { data, error } = await auth.supabase
    .from("gangs")
    .update({
      name: body.name,
      image: body.image || null,
      description: body.description || null,
      status: body.status || "friendly",
    })
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/* -------------------- DELETE GANG -------------------- */
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error!;

  const body = await req.json();

  const { error } = await auth.supabase
    .from("gangs")
    .delete()
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}