import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ACCESS_COOKIE = "aszuna_access";

type FishingBody = {
  action?: unknown;
  id?: unknown;
  name?: unknown;
  image_url?: unknown;
  bait_id?: unknown;
  baits_used?: unknown;
  notes?: unknown;
  catches?: unknown;
};

type CatchInput = {
  fish_id?: unknown;
  amount?: unknown;
};

async function requireAsZunaAccess() {
  const cookieStore = await cookies();

  if (cookieStore.get(ACCESS_COOKIE)?.value !== "true") {
    return NextResponse.json({ error: "AsZuna page is locked." }, { status: 403 });
  }

  return null;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function cleanNumber(value: unknown, fallback = 1) {
  const amount = Math.floor(Number(value ?? fallback));
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(1, amount);
}

function tableMissingResponse(errorMessage: string) {
  return NextResponse.json(
    {
      error:
        "Fishing tables are missing in Supabase. Run supabase/aszuna_fishing.sql once, then refresh this page.",
      details: errorMessage,
    },
    { status: 500 },
  );
}

function isMissingTableError(errorMessage: string) {
  const message = errorMessage.toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache");
}

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, userId: user?.id ?? null };
}

export async function GET() {
  const accessError = await requireAsZunaAccess();
  if (accessError) return accessError;

  const supabase = await createClient();

  const [baitsResult, fishResult, sessionsResult] = await Promise.all([
    supabase.from("aszuna_fishing_baits").select("id,name,image_url,created_at").order("name"),
    supabase.from("aszuna_fishing_fish").select("id,name,image_url,created_at").order("name"),
    supabase
      .from("aszuna_fishing_sessions")
      .select(
        "id,bait_id,baits_used,notes,created_at,aszuna_fishing_baits(id,name,image_url),aszuna_fishing_session_catches(id,fish_id,amount,aszuna_fishing_fish(id,name,image_url))",
      )
      .order("created_at", { ascending: false }),
  ]);

  const firstError = baitsResult.error || fishResult.error || sessionsResult.error;
  if (firstError) {
    if (isMissingTableError(firstError.message)) return tableMissingResponse(firstError.message);
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    baits: baitsResult.data ?? [],
    fish: fishResult.data ?? [],
    sessions: sessionsResult.data ?? [],
  });
}

export async function POST(req: Request) {
  const accessError = await requireAsZunaAccess();
  if (accessError) return accessError;

  const body = (await req.json()) as FishingBody;
  const action = cleanText(body.action);
  const { supabase, userId } = await getUserId();

  if (action === "add_bait") {
    const name = cleanText(body.name);
    const imageUrl = cleanText(body.image_url);

    if (!name) return NextResponse.json({ error: "Bait name is required." }, { status: 400 });

    const { data, error } = await supabase
      .from("aszuna_fishing_baits")
      .insert([{ name, image_url: imageUrl || null, created_by: userId }])
      .select("id,name,image_url,created_at")
      .single();

    if (error) {
      if (isMissingTableError(error.message)) return tableMissingResponse(error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }

  if (action === "add_fish") {
    const name = cleanText(body.name);
    const imageUrl = cleanText(body.image_url);

    if (!name) return NextResponse.json({ error: "Fish name is required." }, { status: 400 });

    const { data, error } = await supabase
      .from("aszuna_fishing_fish")
      .insert([{ name, image_url: imageUrl || null, created_by: userId }])
      .select("id,name,image_url,created_at")
      .single();

    if (error) {
      if (isMissingTableError(error.message)) return tableMissingResponse(error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }

  if (action === "add_session") {
    const baitId = cleanText(body.bait_id);
    const baitsUsed = cleanNumber(body.baits_used);
    const notes = cleanText(body.notes);
    const catches = Array.isArray(body.catches) ? (body.catches as CatchInput[]) : [];

    const cleanCatches = catches
      .map((catchRow) => ({ fish_id: cleanText(catchRow.fish_id), amount: cleanNumber(catchRow.amount) }))
      .filter((catchRow) => catchRow.fish_id && catchRow.amount > 0);

    if (!baitId) return NextResponse.json({ error: "Pick what bait you used." }, { status: 400 });
    if (cleanCatches.length === 0) {
      return NextResponse.json({ error: "Add at least one fish/result from the session." }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("aszuna_fishing_sessions")
      .insert([{ bait_id: baitId, baits_used: baitsUsed, notes: notes || null, created_by: userId }])
      .select("id")
      .single();

    if (sessionError) {
      if (isMissingTableError(sessionError.message)) return tableMissingResponse(sessionError.message);
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const { error: catchesError } = await supabase.from("aszuna_fishing_session_catches").insert(
      cleanCatches.map((catchRow) => ({
        session_id: session.id,
        fish_id: catchRow.fish_id,
        amount: catchRow.amount,
      })),
    );

    if (catchesError) {
      await supabase.from("aszuna_fishing_sessions").delete().eq("id", session.id);
      if (isMissingTableError(catchesError.message)) return tableMissingResponse(catchesError.message);
      return NextResponse.json({ error: catchesError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown fishing action." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const accessError = await requireAsZunaAccess();
  if (accessError) return accessError;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json({ error: "Missing type or id." }, { status: 400 });
  }

  const supabase = await createClient();
  const table =
    type === "session"
      ? "aszuna_fishing_sessions"
      : type === "bait"
        ? "aszuna_fishing_baits"
        : type === "fish"
          ? "aszuna_fishing_fish"
          : null;

  if (!table) return NextResponse.json({ error: "Unknown delete type." }, { status: 400 });

  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    if (isMissingTableError(error.message)) return tableMissingResponse(error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
