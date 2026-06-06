import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ACCESS_COOKIE = "aszuna_access";

type FishingBody = {
  action?: unknown;
  id?: unknown;
  name?: unknown;
  image_url?: unknown;
  sell_price?: unknown;
  bait_id?: unknown;
  baits_used?: unknown;
  location?: unknown;
  session_date?: unknown;
  notes?: unknown;
  catches?: unknown;
  baits?: unknown;
  fish?: unknown;
  sessions?: unknown;
};

type CatchInput = {
  fish_id?: unknown;
  fish_name?: unknown;
  amount?: unknown;
};

type ImportBait = {
  id?: string;
  name?: string;
  image_url?: string | null;
};

type ImportFish = {
  id?: string;
  name?: string;
  image_url?: string | null;
  sell_price?: number | string | null;
};

type ImportSession = {
  bait_id?: string;
  bait_name?: string;
  baits_used?: number | string;
  location?: string | null;
  session_date?: string | null;
  notes?: string | null;
  catches?: CatchInput[];
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

function cleanMoney(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, amount);
}

function cleanDate(value: unknown) {
  const date = cleanText(value);
  if (!date) return new Date().toISOString().slice(0, 10);
  return date;
}

function tableMissingResponse(errorMessage: string) {
  return NextResponse.json(
    {
      error:
        "Fishing tables are missing or outdated in Supabase. Run supabase/aszuna_fishing.sql once, then refresh this page.",
      details: errorMessage,
    },
    { status: 500 },
  );
}

function isMissingTableError(errorMessage: string) {
  const message = errorMessage.toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("column");
}

async function getUserAndAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, userId: null, isAdmin: false };

  if (user.user_metadata?.is_admin === true) return { supabase, userId: user.id, isAdmin: true };

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();

  return { supabase, userId: user.id, isAdmin: profile?.is_admin === true };
}

function requireAdmin(isAdmin: boolean) {
  if (!isAdmin) {
    return NextResponse.json({ error: "Only admins can change AsZuna fishing data." }, { status: 403 });
  }
  return null;
}

const sessionSelect =
  "id,bait_id,baits_used,location,session_date,notes,created_at,aszuna_fishing_baits(id,name,image_url),aszuna_fishing_session_catches(id,fish_id,amount,aszuna_fishing_fish(id,name,image_url,sell_price))";

export async function GET() {
  const accessError = await requireAsZunaAccess();
  if (accessError) return accessError;

  const { supabase, isAdmin } = await getUserAndAdmin();

  const [baitsResult, fishResult, sessionsResult] = await Promise.all([
    supabase.from("aszuna_fishing_baits").select("id,name,image_url,created_at").order("name"),
    supabase.from("aszuna_fishing_fish").select("id,name,image_url,sell_price,created_at").order("name"),
    supabase.from("aszuna_fishing_sessions").select(sessionSelect).order("session_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);

  const firstError = baitsResult.error || fishResult.error || sessionsResult.error;
  if (firstError) {
    if (isMissingTableError(firstError.message)) return tableMissingResponse(firstError.message);
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    isAdmin,
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
  const { supabase, userId, isAdmin } = await getUserAndAdmin();

  const adminError = requireAdmin(isAdmin);
  if (adminError) return adminError;

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
    const sellPrice = cleanMoney(body.sell_price);
    if (!name) return NextResponse.json({ error: "Fish name is required." }, { status: 400 });

    const { data, error } = await supabase
      .from("aszuna_fishing_fish")
      .insert([{ name, image_url: imageUrl || null, sell_price: sellPrice, created_by: userId }])
      .select("id,name,image_url,sell_price,created_at")
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
    const location = cleanText(body.location);
    const sessionDate = cleanDate(body.session_date);
    const notes = cleanText(body.notes);
    const catches = Array.isArray(body.catches) ? (body.catches as CatchInput[]) : [];

    const cleanCatches = catches
      .map((catchRow) => ({ fish_id: cleanText(catchRow.fish_id), amount: cleanNumber(catchRow.amount) }))
      .filter((catchRow) => catchRow.fish_id && catchRow.amount > 0);

    if (!baitId) return NextResponse.json({ error: "Pick what bait you used." }, { status: 400 });
    if (cleanCatches.length === 0) return NextResponse.json({ error: "Add at least one fish/result from the session." }, { status: 400 });

    const { data: session, error: sessionError } = await supabase
      .from("aszuna_fishing_sessions")
      .insert([{ bait_id: baitId, baits_used: baitsUsed, location: location || null, session_date: sessionDate, notes: notes || null, created_by: userId }])
      .select("id")
      .single();

    if (sessionError) {
      if (isMissingTableError(sessionError.message)) return tableMissingResponse(sessionError.message);
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const { error: catchesError } = await supabase.from("aszuna_fishing_session_catches").insert(
      cleanCatches.map((catchRow) => ({ session_id: session.id, fish_id: catchRow.fish_id, amount: catchRow.amount })),
    );

    if (catchesError) {
      await supabase.from("aszuna_fishing_sessions").delete().eq("id", session.id);
      if (isMissingTableError(catchesError.message)) return tableMissingResponse(catchesError.message);
      return NextResponse.json({ error: catchesError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (action === "import") {
    const baits = Array.isArray(body.baits) ? (body.baits as ImportBait[]) : [];
    const fish = Array.isArray(body.fish) ? (body.fish as ImportFish[]) : [];
    const sessions = Array.isArray(body.sessions) ? (body.sessions as ImportSession[]) : [];

    const baitNameToId = new Map<string, string>();
    const fishNameToId = new Map<string, string>();

    for (const bait of baits) {
      const name = cleanText(bait.name);
      if (!name) continue;
      const { data: existingBait } = await supabase
        .from("aszuna_fishing_baits")
        .select("id,name")
        .ilike("name", name)
        .maybeSingle();

      if (existingBait) {
        const { error } = await supabase
          .from("aszuna_fishing_baits")
          .update({ image_url: cleanText(bait.image_url) || null })
          .eq("id", existingBait.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        baitNameToId.set(existingBait.name.toLowerCase(), existingBait.id);
        if (bait.id) baitNameToId.set(String(bait.id), existingBait.id);
        continue;
      }

      const { data, error } = await supabase
        .from("aszuna_fishing_baits")
        .insert({ name, image_url: cleanText(bait.image_url) || null, created_by: userId })
        .select("id,name")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      baitNameToId.set(data.name.toLowerCase(), data.id);
      if (bait.id) baitNameToId.set(String(bait.id), data.id);
    }

    for (const item of fish) {
      const name = cleanText(item.name);
      if (!name) continue;
      const { data: existingFish } = await supabase
        .from("aszuna_fishing_fish")
        .select("id,name")
        .ilike("name", name)
        .maybeSingle();

      if (existingFish) {
        const { error } = await supabase
          .from("aszuna_fishing_fish")
          .update({ image_url: cleanText(item.image_url) || null, sell_price: cleanMoney(item.sell_price) })
          .eq("id", existingFish.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        fishNameToId.set(existingFish.name.toLowerCase(), existingFish.id);
        if (item.id) fishNameToId.set(String(item.id), existingFish.id);
        continue;
      }

      const { data, error } = await supabase
        .from("aszuna_fishing_fish")
        .insert({ name, image_url: cleanText(item.image_url) || null, sell_price: cleanMoney(item.sell_price), created_by: userId })
        .select("id,name")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      fishNameToId.set(data.name.toLowerCase(), data.id);
      if (item.id) fishNameToId.set(String(item.id), data.id);
    }

    for (const session of sessions) {
      const baitId = baitNameToId.get(cleanText(session.bait_id)) || baitNameToId.get(cleanText(session.bait_name).toLowerCase());
      if (!baitId) continue;
      const cleanCatches = (Array.isArray(session.catches) ? session.catches : [])
        .map((catchRow) => ({
          fish_id: fishNameToId.get(cleanText(catchRow.fish_id)) || fishNameToId.get(cleanText(catchRow.fish_name).toLowerCase()),
          amount: cleanNumber(catchRow.amount),
        }))
        .filter((catchRow): catchRow is { fish_id: string; amount: number } => Boolean(catchRow.fish_id));
      if (cleanCatches.length === 0) continue;

      const { data: newSession, error: sessionError } = await supabase
        .from("aszuna_fishing_sessions")
        .insert([{ bait_id: baitId, baits_used: cleanNumber(session.baits_used), location: cleanText(session.location) || null, session_date: cleanDate(session.session_date), notes: cleanText(session.notes) || null, created_by: userId }])
        .select("id")
        .single();
      if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

      const { error: catchesError } = await supabase.from("aszuna_fishing_session_catches").insert(
        cleanCatches.map((catchRow) => ({ session_id: newSession.id, fish_id: catchRow.fish_id, amount: catchRow.amount })),
      );
      if (catchesError) return NextResponse.json({ error: catchesError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown fishing action." }, { status: 400 });
}

export async function PUT(req: Request) {
  const accessError = await requireAsZunaAccess();
  if (accessError) return accessError;

  const body = (await req.json()) as FishingBody;
  const action = cleanText(body.action);
  const id = cleanText(body.id);
  const { supabase, isAdmin } = await getUserAndAdmin();

  const adminError = requireAdmin(isAdmin);
  if (adminError) return adminError;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  if (action === "update_bait") {
    const name = cleanText(body.name);
    const imageUrl = cleanText(body.image_url);
    if (!name) return NextResponse.json({ error: "Bait name is required." }, { status: 400 });

    const { error } = await supabase.from("aszuna_fishing_baits").update({ name, image_url: imageUrl || null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_fish") {
    const name = cleanText(body.name);
    const imageUrl = cleanText(body.image_url);
    if (!name) return NextResponse.json({ error: "Fish name is required." }, { status: 400 });

    const { error } = await supabase
      .from("aszuna_fishing_fish")
      .update({ name, image_url: imageUrl || null, sell_price: cleanMoney(body.sell_price) })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_session") {
    const baitId = cleanText(body.bait_id);
    const baitsUsed = cleanNumber(body.baits_used);
    const catches = Array.isArray(body.catches) ? (body.catches as CatchInput[]) : [];
    const cleanCatches = catches
      .map((catchRow) => ({ fish_id: cleanText(catchRow.fish_id), amount: cleanNumber(catchRow.amount) }))
      .filter((catchRow) => catchRow.fish_id && catchRow.amount > 0);

    if (!baitId) return NextResponse.json({ error: "Pick what bait you used." }, { status: 400 });
    if (cleanCatches.length === 0) return NextResponse.json({ error: "Add at least one fish/result from the session." }, { status: 400 });

    const { error } = await supabase
      .from("aszuna_fishing_sessions")
      .update({ bait_id: baitId, baits_used: baitsUsed, location: cleanText(body.location) || null, session_date: cleanDate(body.session_date), notes: cleanText(body.notes) || null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("aszuna_fishing_session_catches").delete().eq("session_id", id);
    const { error: catchesError } = await supabase.from("aszuna_fishing_session_catches").insert(
      cleanCatches.map((catchRow) => ({ session_id: id, fish_id: catchRow.fish_id, amount: catchRow.amount })),
    );
    if (catchesError) return NextResponse.json({ error: catchesError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown fishing update action." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const accessError = await requireAsZunaAccess();
  if (accessError) return accessError;

  const { supabase, isAdmin } = await getUserAndAdmin();
  const adminError = requireAdmin(isAdmin);
  if (adminError) return adminError;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  if (!type || !id) return NextResponse.json({ error: "Missing type or id." }, { status: 400 });

  const table = type === "session" ? "aszuna_fishing_sessions" : type === "bait" ? "aszuna_fishing_baits" : type === "fish" ? "aszuna_fishing_fish" : null;
  if (!table) return NextResponse.json({ error: "Unknown delete type." }, { status: 400 });

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    if (isMissingTableError(error.message)) return tableMissingResponse(error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
