import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type IngredientInput = {
  ingredient_name: string;
  ingredient_amount: number;
  ingredient_item_id?: string | null;
};

const CRAFTING_ITEM_SELECT = `
  id,
  name,
  image,
  craft_amount,
  updated_at,
  crafting_recipe_ingredients!crafting_recipe_ingredients_crafting_item_id_fkey (
    id,
    ingredient_name,
    ingredient_amount,
    ingredient_item_id,
    linked_item:crafting_items!crafting_recipe_ingredients_ingredient_item_id_fkey (
      id,
      name,
      image,
      craft_amount
    )
  )
`;

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

function normalizeIngredients(rawIngredients: unknown): IngredientInput[] {
  if (!Array.isArray(rawIngredients)) return [];

  return rawIngredients
    .map((ingredient) => {
      const row = ingredient as Record<string, unknown>;

      const ingredientName = String(row.ingredient_name || "").trim();
      const ingredientAmount = Number(row.ingredient_amount);
      const ingredientItemId =
        row.ingredient_item_id === null ||
        row.ingredient_item_id === undefined ||
        String(row.ingredient_item_id).trim() === ""
          ? null
          : String(row.ingredient_item_id).trim();

      return {
        ingredient_name: ingredientName,
        ingredient_amount: ingredientAmount,
        ingredient_item_id: ingredientItemId,
      };
    })
    .filter(
      (ingredient) =>
        ingredient.ingredient_name &&
        Number.isFinite(ingredient.ingredient_amount) &&
        ingredient.ingredient_amount > 0
    );
}

export async function GET() {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("crafting_items")
    .select(CRAFTING_ITEM_SELECT)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  try {
    const auth = await getCurrentUserAndProfile();

    if (auth.error || !auth.user || !auth.profile) {
      return auth.error!;
    }

    if (!auth.profile.is_admin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();

    const name = String(body.name || "").trim();
    const image = body.image ? String(body.image).trim() : null;
    const craftAmount = Number(body.craft_amount || 1);
    const ingredients = normalizeIngredients(body.ingredients);

    if (!name) {
      return NextResponse.json({ error: "Missing item name" }, { status: 400 });
    }

    if (!Number.isFinite(craftAmount) || craftAmount <= 0) {
      return NextResponse.json({ error: "Invalid craft amount" }, { status: 400 });
    }

    if (!ingredients.length) {
      return NextResponse.json({ error: "Add at least one ingredient" }, { status: 400 });
    }

    const { data: item, error: itemError } = await auth.supabase
      .from("crafting_items")
      .insert({
        name,
        image,
        craft_amount: craftAmount,
        updated_by: auth.profile.id,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    const ingredientRows = ingredients.map((ingredient) => ({
      crafting_item_id: item.id,
      ingredient_name: ingredient.ingredient_name,
      ingredient_amount: ingredient.ingredient_amount,
      ingredient_item_id: ingredient.ingredient_item_id ?? null,
    }));

    const { error: ingredientError } = await auth.supabase
      .from("crafting_recipe_ingredients")
      .insert(ingredientRows);

    if (ingredientError) {
      return NextResponse.json({ error: ingredientError.message }, { status: 500 });
    }

    const { data: fullItem, error: fullItemError } = await auth.supabase
      .from("crafting_items")
      .select(CRAFTING_ITEM_SELECT)
      .eq("id", item.id)
      .single();

    if (fullItemError) {
      return NextResponse.json({ error: fullItemError.message }, { status: 500 });
    }

    return NextResponse.json(fullItem);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
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

    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    const image = body.image ? String(body.image).trim() : null;
    const craftAmount = Number(body.craft_amount || 1);
    const ingredients = normalizeIngredients(body.ingredients);

    if (!id) {
      return NextResponse.json({ error: "Missing item id" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Missing item name" }, { status: 400 });
    }

    if (!Number.isFinite(craftAmount) || craftAmount <= 0) {
      return NextResponse.json({ error: "Invalid craft amount" }, { status: 400 });
    }

    if (!ingredients.length) {
      return NextResponse.json({ error: "Add at least one ingredient" }, { status: 400 });
    }

    const { error: updateError } = await auth.supabase
      .from("crafting_items")
      .update({
        name,
        image,
        craft_amount: craftAmount,
        updated_by: auth.profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: deleteIngredientsError } = await auth.supabase
      .from("crafting_recipe_ingredients")
      .delete()
      .eq("crafting_item_id", id);

    if (deleteIngredientsError) {
      return NextResponse.json({ error: deleteIngredientsError.message }, { status: 500 });
    }

    const ingredientRows = ingredients.map((ingredient) => ({
      crafting_item_id: id,
      ingredient_name: ingredient.ingredient_name,
      ingredient_amount: ingredient.ingredient_amount,
      ingredient_item_id: ingredient.ingredient_item_id ?? null,
    }));

    const { error: insertIngredientsError } = await auth.supabase
      .from("crafting_recipe_ingredients")
      .insert(ingredientRows);

    if (insertIngredientsError) {
      return NextResponse.json({ error: insertIngredientsError.message }, { status: 500 });
    }

    const { data: fullItem, error: fullItemError } = await auth.supabase
      .from("crafting_items")
      .select(CRAFTING_ITEM_SELECT)
      .eq("id", id)
      .single();

    if (fullItemError) {
      return NextResponse.json({ error: fullItemError.message }, { status: 500 });
    }

    return NextResponse.json(fullItem);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getCurrentUserAndProfile();

    if (auth.error || !auth.user || !auth.profile) {
      return auth.error!;
    }

    if (!auth.profile.is_admin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || "");

    if (!id) {
      return NextResponse.json({ error: "Missing item id" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("crafting_items")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}