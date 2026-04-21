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

type StatusFilter = "all" | "completed" | "missing";
type SortOption =
  | "default"
  | "renhed-desc"
  | "renhed-asc"
  | "stabiliseringstid-desc"
  | "stabiliseringstid-asc";

function normalizeSearch(value: string) {
  return value.replace(/,/g, "-").trim();
}

function tryParseCombo(search: string) {
  const normalized = normalizeSearch(search);
  const match = normalized.match(/^(\d+)\s*-\s*(\d+)\s*-\s*(\d+)$/);

  if (!match) return null;

  const [, fosforAmount, pseudoephedrin, lithium] = match;

  return {
    fosfor_amount: Number(fosforAmount),
    pseudoephedrin: Number(pseudoephedrin),
    lithium: Number(lithium),
  };
}

function applySharedFilters(
  query: any,
  color: string,
  status: StatusFilter,
  search: string
) {
  let nextQuery = query.eq("fosfor_color", color);

  const normalizedSearch = normalizeSearch(search);

  if (normalizedSearch) {
    const combo = tryParseCombo(normalizedSearch);

    // ✅ ONLY allow exact combo search (no ilike on integers)
    if (combo) {
      nextQuery = nextQuery
        .eq("fosfor_amount", combo.fosfor_amount)
        .eq("pseudoephedrin", combo.pseudoephedrin)
        .eq("lithium", combo.lithium);
    }
  }

  if (status === "completed") {
    nextQuery = nextQuery
      .not("renhed", "is", null)
      .not("stabiliseringstid", "is", null);
  }

  if (status === "missing") {
    nextQuery = nextQuery.or("renhed.is.null,stabiliseringstid.is.null");
  }

  return nextQuery;
}

function applySort(query: any, sort: SortOption) {
  switch (sort) {
    case "renhed-desc":
      return query
        .order("renhed", { ascending: false, nullsFirst: false })
        .order("fosfor_amount", { ascending: true })
        .order("pseudoephedrin", { ascending: true })
        .order("lithium", { ascending: true });

    case "renhed-asc":
      return query
        .order("renhed", { ascending: true, nullsFirst: false })
        .order("fosfor_amount", { ascending: true })
        .order("pseudoephedrin", { ascending: true })
        .order("lithium", { ascending: true });

    case "stabiliseringstid-desc":
      return query
        .order("stabiliseringstid", { ascending: false, nullsFirst: false })
        .order("fosfor_amount", { ascending: true })
        .order("pseudoephedrin", { ascending: true })
        .order("lithium", { ascending: true });

    case "stabiliseringstid-asc":
      return query
        .order("stabiliseringstid", { ascending: true, nullsFirst: false })
        .order("fosfor_amount", { ascending: true })
        .order("pseudoephedrin", { ascending: true })
        .order("lithium", { ascending: true });

    default:
      return query
        .order("fosfor_amount", { ascending: true })
        .order("pseudoephedrin", { ascending: true })
        .order("lithium", { ascending: true });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const color = searchParams.get("color") || "green";
  const status = (searchParams.get("status") || "all") as StatusFilter;
  const sort = (searchParams.get("sort") || "default") as SortOption;
  const search = searchParams.get("search")?.trim() || "";
  const randomMissing = searchParams.get("randomMissing") === "true";

  const limitParam = Number(searchParams.get("limit") || "50");
  const offsetParam = Number(searchParams.get("offset") || "0");

  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, 200))
    : 50;
  const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

  if (!["green", "red", "blue"].includes(color)) {
    return NextResponse.json({ error: "Invalid color" }, { status: 400 });
  }

  const supabase = await createClient();

  if (randomMissing) {
    const randomQuery = applySharedFilters(
      supabase.from("meth_recipes").select("*"),
      color,
      "missing",
      search
    );

    const { data, error } = await randomQuery.limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = data ?? [];
    const item =
      items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;

    return NextResponse.json({ item });
  }

  let itemsQuery = applySharedFilters(
    supabase.from("meth_recipes").select("*"),
    color,
    status,
    search
  );

  itemsQuery = applySort(itemsQuery, sort);

  const [
    { data: items, error: itemsError },
    { count: total, error: totalError },
  ] = await Promise.all([
    itemsQuery.range(offset, offset + limit - 1),
    applySharedFilters(
      supabase.from("meth_recipes").select("id", { count: "exact", head: true }),
      color,
      status,
      search
    ),
  ]);

  if (itemsError || totalError) {
    return NextResponse.json(
      { error: itemsError?.message || totalError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: items ?? [],
    total: total ?? 0,
  });
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
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}