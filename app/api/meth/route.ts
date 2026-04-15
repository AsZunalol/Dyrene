import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getCurrentUserAndProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return {
      supabase,
      user,
      profile: null,
      error: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  return {
    supabase,
    user,
    profile,
    error: null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const color = searchParams.get("color") || "green";

  if (!["green", "red", "blue"].includes(color)) {
    return NextResponse.json({ error: "Invalid color" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meth_recipes")
    .select("*")
    .eq("fosfor_color", color)
    .order("lithium", { ascending: true })
    .order("pseudoephedrin", { ascending: true })
    .order("fosfor_amount", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  try {
    const auth = await getCurrentUserAndProfile();

    if (auth.error || !auth.user || !auth.profile) {
      return auth.error!;
    }

    if (!auth.profile.is_admin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Missing recipe id" }, { status: 400 });
    }

    const updatePayload: {
      renhed?: number | null;
      stabiliseringstid?: number | null;
      updated_by: string;
      updated_at: string;
    } = {
      updated_by: auth.profile.id,
      updated_at: new Date().toISOString(),
    };

    if ("renhed" in body) {
      updatePayload.renhed =
        body.renhed === "" || body.renhed === null ? null : Number(body.renhed);
    }

    if ("stabiliseringstid" in body) {
      updatePayload.stabiliseringstid =
        body.stabiliseringstid === "" || body.stabiliseringstid === null
          ? null
          : Number(body.stabiliseringstid);
    }

    const { data, error } = await auth.supabase
      .from("meth_recipes")
      .update(updatePayload)
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