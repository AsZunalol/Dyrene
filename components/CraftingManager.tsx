"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type Ingredient = {
  id?: string;
  ingredient_name: string;
  ingredient_amount: number;
  ingredient_item_id?: string | null;
};

type CraftingItem = {
  id: string;
  name: string;
  image: string | null;
  craft_amount: number;
  updated_at?: string | null;
  crafting_recipe_ingredients: Ingredient[];
};

type CartItem = {
  itemId: string;
  quantity: number;
};

type Props = {
  isAdmin: boolean;
};

type FormIngredient = {
  ingredient_name: string;
  ingredient_amount: string;
  ingredient_item_id: string;
};

type AdminModalTab = "recipe" | "raw" | "nonRaw";
type IngredientPickerTab = "raw" | "nonRaw";

const emptyIngredient = (): FormIngredient => ({
  ingredient_name: "",
  ingredient_amount: "",
  ingredient_item_id: "",
});

type CraftingCacheEntry = {
  items: CraftingItem[];
  savedAt: number;
};

type CraftingUiCache = {
  search: string;
  recipeFilter?: "all" | "images" | "craftable";
  selectedItemId: string;
  cart: CartItem[];
  scrollY: number;
};

const CRAFTING_CACHE_KEY = "dyrene-crafting-items-cache-v1";
const CRAFTING_UI_CACHE_KEY = "dyrene-crafting-ui-cache-v1";
const CRAFTING_CACHE_TTL_MS = 1000 * 60 * 10;

function readCraftingItemsCache() {
  if (typeof window === "undefined") return null as CraftingCacheEntry | null;

  try {
    const raw = window.sessionStorage.getItem(CRAFTING_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CraftingCacheEntry;
    if (
      !parsed ||
      !Array.isArray(parsed.items) ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > CRAFTING_CACHE_TTL_MS
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCraftingItemsCache(items: CraftingItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      CRAFTING_CACHE_KEY,
      JSON.stringify({
        items,
        savedAt: Date.now(),
      }),
    );
  } catch {}
}

function clearCraftingCache() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(CRAFTING_CACHE_KEY);
    window.sessionStorage.removeItem(CRAFTING_UI_CACHE_KEY);
  } catch {}
}

function roundAmount(value: number) {
  return Number(value.toFixed(2));
}

function addToTotals(
  totals: Map<string, number>,
  ingredientName: string,
  amount: number,
) {
  const current = totals.get(ingredientName) || 0;
  totals.set(ingredientName, roundAmount(current + amount));
}

function expandCraftingCost(
  itemId: string,
  quantityWanted: number,
  itemsMap: Map<string, CraftingItem>,
  rawTotals: Map<string, number>,
  subCraftedTotals: Map<string, number>,
  visited: Set<string> = new Set(),
  isRoot = true,
) {
  const item = itemsMap.get(itemId);
  if (!item) return;

  if (visited.has(itemId)) {
    throw new Error(`Recipe loop detected for "${item.name}"`);
  }

  const itemIngredients = item.crafting_recipe_ingredients || [];

  if (!isRoot && itemIngredients.length === 0) {
    addToTotals(rawTotals, item.name, quantityWanted);
    return;
  }

  if (!isRoot) {
    addToTotals(subCraftedTotals, item.name, quantityWanted);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(itemId);

  const multiplier = quantityWanted / item.craft_amount;

  for (const ingredient of itemIngredients) {
    const neededAmount = ingredient.ingredient_amount * multiplier;

    if (ingredient.ingredient_item_id) {
      expandCraftingCost(
        ingredient.ingredient_item_id,
        neededAmount,
        itemsMap,
        rawTotals,
        subCraftedTotals,
        nextVisited,
        false,
      );
    } else {
      addToTotals(rawTotals, ingredient.ingredient_name, neededAmount);
    }
  }
}

export default function CraftingManager({ isAdmin }: Props) {
  const [items, setItems] = useState<CraftingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [recipeFilter, setRecipeFilter] = useState<
    "all" | "images" | "craftable"
  >("all");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
  const hasFetchedRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isTotalsModalOpen, setIsTotalsModalOpen] = useState(false);
  const [adminModalTab, setAdminModalTab] = useState<AdminModalTab>("recipe");
  const [ingredientPickerTab, setIngredientPickerTab] =
    useState<IngredientPickerTab>("raw");
  const [ingredientPickerSearch, setIngredientPickerSearch] = useState("");
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [craftAmount, setCraftAmount] = useState("1");
  const [ingredients, setIngredients] = useState<FormIngredient[]>([
    emptyIngredient(),
  ]);

  async function fetchItems(forceRefresh = false) {
    setLoading(true);
    setError(null);

    try {
      if (!forceRefresh) {
        const cached = readCraftingItemsCache();
        if (cached) {
          setItems(cached.items);
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/crafting");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch crafting items");
      }

      setItems(json);
      writeCraftingItemsCache(json);

      setSelectedItemId((current) => {
        if (current && json.some((item: CraftingItem) => item.id === current)) {
          return current;
        }

        return json.length > 0 ? json[0].id : "";
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch crafting items",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      setHydratedFromCache(true);
      return;
    }

    try {
      const rawUi = window.sessionStorage.getItem(CRAFTING_UI_CACHE_KEY);
      const ui = rawUi ? (JSON.parse(rawUi) as CraftingUiCache) : null;
      const cached = readCraftingItemsCache();

      if (ui?.search) {
        setSearch(ui.search);
      }

      if (
        ui?.recipeFilter === "all" ||
        ui?.recipeFilter === "images" ||
        ui?.recipeFilter === "craftable"
      ) {
        setRecipeFilter(ui.recipeFilter);
      }

      if (ui?.selectedItemId) {
        setSelectedItemId(ui.selectedItemId);
      }

      if (Array.isArray(ui?.cart)) {
        setCart(
          ui.cart.filter(
            (entry) =>
              entry &&
              typeof entry.itemId === "string" &&
              typeof entry.quantity === "number" &&
              entry.quantity > 0,
          ),
        );
      }

      if (cached) {
        setItems(cached.items);
        setLoading(false);
        setShouldRestoreScroll(true);
      }
    } catch {
      // ignore bad cache data
    } finally {
      setHydratedFromCache(true);
    }
  }, []);

  useEffect(() => {
    if (!hydratedFromCache || hasFetchedRef.current) return;

    hasFetchedRef.current = true;
    fetchItems();
  }, [hydratedFromCache]);

  const recipeItems = useMemo(() => {
    return items.filter((item) => item.crafting_recipe_ingredients.length > 0);
  }, [items]);

  const dashboardStats = useMemo(() => {
    const withImages = recipeItems.filter((item) => item.image).length;
    const craftableInputs = recipeItems.filter((item) =>
      item.crafting_recipe_ingredients.some(
        (ingredient) => ingredient.ingredient_item_id,
      ),
    ).length;
    const rawIngredients = new Set<string>();

    for (const item of recipeItems) {
      for (const ingredient of item.crafting_recipe_ingredients) {
        if (!ingredient.ingredient_item_id) {
          rawIngredients.add(ingredient.ingredient_name.toLowerCase());
        }
      }
    }

    return {
      totalRecipes: recipeItems.length,
      withImages,
      craftableInputs,
      rawIngredients: rawIngredients.size,
    };
  }, [recipeItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return recipeItems.filter((item) => {
      if (recipeFilter === "images" && !item.image) return false;
      if (
        recipeFilter === "craftable" &&
        !item.crafting_recipe_ingredients.some(
          (ingredient) => ingredient.ingredient_item_id,
        )
      ) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        item.name,
        ...item.crafting_recipe_ingredients.map(
          (ingredient) => ingredient.ingredient_name,
        ),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [recipeItems, recipeFilter, search]);

  useEffect(() => {
    if (!items.length) return;

    setSelectedItemId((current) => {
      if (current && items.some((item) => item.id === current)) {
        return current;
      }

      return items[0]?.id || "";
    });
  }, [items]);

  useEffect(() => {
    if (!hydratedFromCache || typeof window === "undefined") return;

    const saveUiState = () => {
      try {
        window.sessionStorage.setItem(
          CRAFTING_UI_CACHE_KEY,
          JSON.stringify({
            search,
            recipeFilter,
            selectedItemId,
            cart,
            scrollY: window.scrollY,
          }),
        );
      } catch {}
    };

    saveUiState();
    window.addEventListener("scroll", saveUiState, { passive: true });
    window.addEventListener("beforeunload", saveUiState);

    return () => {
      window.removeEventListener("scroll", saveUiState);
      window.removeEventListener("beforeunload", saveUiState);
    };
  }, [cart, hydratedFromCache, recipeFilter, search, selectedItemId]);

  useEffect(() => {
    if (!shouldRestoreScroll || typeof window === "undefined") return;

    try {
      const rawUi = window.sessionStorage.getItem(CRAFTING_UI_CACHE_KEY);
      const ui = rawUi ? (JSON.parse(rawUi) as CraftingUiCache) : null;
      const scrollY = typeof ui?.scrollY === "number" ? ui.scrollY : 0;

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "auto" });
        setShouldRestoreScroll(false);
      });
    } catch {
      setShouldRestoreScroll(false);
    }
  }, [items.length, shouldRestoreScroll]);

  const shoppingSummary = useMemo(() => {
    const directTotals = new Map<string, number>();
    const subCraftedTotals = new Map<string, number>();
    const expandedTotals = new Map<string, number>();
    const selectedCrafts: Array<{
      itemName: string;
      quantity: number;
      craftAmount: number;
      ingredients: Ingredient[];
    }> = [];

    const itemsMap = new Map(items.map((item) => [item.id, item]));
    const errors: string[] = [];

    for (const cartItem of cart) {
      const item = itemsMap.get(cartItem.itemId);
      if (!item || cartItem.quantity <= 0) continue;

      selectedCrafts.push({
        itemName: item.name,
        quantity: cartItem.quantity,
        craftAmount: item.craft_amount,
        ingredients: item.crafting_recipe_ingredients,
      });

      const multiplier = cartItem.quantity / item.craft_amount;

      for (const ingredient of item.crafting_recipe_ingredients) {
        const neededAmount = ingredient.ingredient_amount * multiplier;
        addToTotals(directTotals, ingredient.ingredient_name, neededAmount);
      }

      try {
        expandCraftingCost(
          item.id,
          cartItem.quantity,
          itemsMap,
          expandedTotals,
          subCraftedTotals,
        );
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : `Failed to expand "${item.name}"`,
        );
      }
    }

    return {
      selectedCrafts,
      directIngredients: Array.from(directTotals.entries())
        .map(([name, amount]) => ({
          name,
          amount: roundAmount(amount),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),

      subCraftedIngredients: Array.from(subCraftedTotals.entries())
        .map(([name, amount]) => ({
          name,
          amount: roundAmount(amount),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),

      expandedIngredients: Array.from(expandedTotals.entries())
        .map(([name, amount]) => ({
          name,
          amount: roundAmount(amount),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),

      errors,
    };
  }, [cart, items]);

  const linkableItems = useMemo(() => {
    return items
      .filter((item) => item.id !== editingId)
      .sort((a, b) => {
        const aIsMaterial = a.crafting_recipe_ingredients.length === 0;
        const bIsMaterial = b.crafting_recipe_ingredients.length === 0;

        if (aIsMaterial !== bIsMaterial) return aIsMaterial ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [items, editingId]);

  const rawMaterialItems = useMemo(() => {
    return linkableItems.filter(
      (item) => item.crafting_recipe_ingredients.length === 0,
    );
  }, [linkableItems]);

  const nonRawMaterialItems = useMemo(() => {
    return linkableItems.filter(
      (item) => item.crafting_recipe_ingredients.length > 0,
    );
  }, [linkableItems]);

  const filteredIngredientPickerItems = useMemo(() => {
    const term = ingredientPickerSearch.trim().toLowerCase();
    const sourceItems =
      ingredientPickerTab === "raw" ? rawMaterialItems : nonRawMaterialItems;

    if (!term) return sourceItems;

    return sourceItems.filter((item) =>
      item.name.toLowerCase().includes(term),
    );
  }, [ingredientPickerSearch, ingredientPickerTab, nonRawMaterialItems, rawMaterialItems]);

  useEffect(() => {
    if (!hydratedFromCache || !items.length) return;
    writeCraftingItemsCache(items);
  }, [hydratedFromCache, items]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setImage("");
    setCraftAmount("1");
    setIngredients([emptyIngredient()]);
  }

  function openAddRecipeModal(tab: AdminModalTab = "recipe") {
    resetForm();
    setAdminModalTab(tab);
    setIsRecipeModalOpen(true);
  }

  function closeRecipeModal() {
    setIsRecipeModalOpen(false);
    setAdminModalTab("recipe");
    resetForm();
  }

  function startEdit(item: CraftingItem) {
    setAdminModalTab(
      item.crafting_recipe_ingredients.length ? "recipe" : "nonRaw",
    );
    setEditingId(item.id);
    setName(item.name);
    setImage(item.image || "");
    setCraftAmount(String(item.craft_amount || 1));
    setIngredients(
      item.crafting_recipe_ingredients.length
        ? item.crafting_recipe_ingredients.map((ingredient) => ({
            ingredient_name: ingredient.ingredient_name,
            ingredient_amount: String(ingredient.ingredient_amount),
            ingredient_item_id: ingredient.ingredient_item_id || "",
          }))
        : [emptyIngredient()],
    );
    setIsRecipeModalOpen(true);
  }

  function addIngredientRow() {
    setIngredients((prev) => [...prev, emptyIngredient()]);
  }

  function updateIngredientRow(
    index: number,
    key: "ingredient_name" | "ingredient_amount" | "ingredient_item_id",
    value: string,
  ) {
    setIngredients((prev) =>
      prev.map((ingredient, i) =>
        i === index ? { ...ingredient, [key]: value } : ingredient,
      ),
    );
  }

  function handleLinkedItemChange(index: number, linkedItemId: string) {
    const linkedItem = items.find((item) => item.id === linkedItemId);

    setIngredients((prev) =>
      prev.map((ingredient, i) => {
        if (i !== index) return ingredient;

        if (!linkedItemId) {
          return {
            ...ingredient,
            ingredient_item_id: "",
          };
        }

        return {
          ...ingredient,
          ingredient_item_id: linkedItemId,
          ingredient_name: linkedItem?.name || ingredient.ingredient_name,
        };
      }),
    );
  }

  function addIngredientFromPicker(item: CraftingItem) {
    setIngredients((prev) => {
      const firstEmptyIndex = prev.findIndex(
        (ingredient) =>
          !ingredient.ingredient_name.trim() &&
          !ingredient.ingredient_amount.trim() &&
          !ingredient.ingredient_item_id.trim(),
      );

      const newIngredient: FormIngredient = {
        ingredient_name: item.name,
        ingredient_amount: "1",
        ingredient_item_id: item.id,
      };

      if (firstEmptyIndex === -1) {
        return [...prev, newIngredient];
      }

      return prev.map((ingredient, index) =>
        index === firstEmptyIndex ? newIngredient : ingredient,
      );
    });
  }

  function removeIngredientRow(index: number) {
    setIngredients((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  async function uploadRecipeImage(file: File) {
    setUploadingImage(true);

    try {
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("crafting-images")
        .upload(fileName, file);

      if (uploadError) {
        alert(uploadError.message);
        return;
      }

      const { data } = supabase.storage
        .from("crafting-images")
        .getPublicUrl(fileName);

      setImage(data.publicUrl);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveRecipe(e: React.FormEvent) {
    e.preventDefault();

    const isRawMaterialTab = adminModalTab === "raw";
    const needsIngredients = !isRawMaterialTab;
    const cleanIngredients = needsIngredients
      ? ingredients
          .map((ingredient) => ({
            ingredient_name: ingredient.ingredient_name.trim(),
            ingredient_amount: Number(ingredient.ingredient_amount),
            ingredient_item_id: ingredient.ingredient_item_id.trim() || null,
          }))
          .filter(
            (ingredient) =>
              ingredient.ingredient_name &&
              Number.isFinite(ingredient.ingredient_amount) &&
              ingredient.ingredient_amount > 0,
          )
      : [];

    if (!name.trim()) {
      return alert("Enter an item name");
    }

    if (needsIngredients && !cleanIngredients.length) {
      return alert("Add at least one valid ingredient");
    }

    setSaving(true);

    try {
      const res = await fetch("/api/crafting", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          name: name.trim(),
          image: image.trim() || null,
          craft_amount: needsIngredients ? Number(craftAmount) || 1 : 1,
          ingredients: cleanIngredients,
          allow_empty_ingredients: isRawMaterialTab,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error || "Failed to save recipe");
        return;
      }

      clearCraftingCache();
      await fetchItems(true);
      closeRecipeModal();
    } catch (err) {
      console.error(err);
      alert("Network error while saving recipe");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecipe(id: string) {
    const ok = window.confirm("Delete this crafting recipe?");
    if (!ok) return;

    try {
      const res = await fetch("/api/crafting", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error || "Failed to delete recipe");
        return;
      }

      clearCraftingCache();
      setItems((prev) => prev.filter((item) => item.id !== id));
      setCart((prev) => prev.filter((entry) => entry.itemId !== id));

      if (selectedItemId === id) {
        setSelectedItemId("");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      alert("Network error while deleting recipe");
    }
  }

  function addToCart(itemId: string) {
    if (!itemId) return;

    setCart((prev) => {
      const existing = prev.find((entry) => entry.itemId === itemId);

      if (existing) {
        return prev.map((entry) =>
          entry.itemId === itemId
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry,
        );
      }

      return [...prev, { itemId, quantity: 1 }];
    });
  }

  function updateCartQuantity(itemId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.itemId === itemId ? { ...entry, quantity } : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => prev.filter((entry) => entry.itemId !== itemId));
  }

  function findItemByName(itemName: string) {
    return items.find(
      (item) => item.name.toLowerCase() === itemName.toLowerCase(),
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-none flex-col space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.04] to-indigo-500/10 p-5 shadow-2xl shadow-black/20 md:p-7 xl:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-indigo-200/70">
              Dyrene crafting
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
              Crafting Dashboard
            </h1>
            <p className="mt-3 text-base text-gray-300">
              Search recipes, build a shopping list, and manage crafting items
              from one full-page overview.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => openAddRecipeModal("recipe")}
              className="w-full rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:scale-[1.01] xl:w-auto"
              style={{
                background: "linear-gradient(90deg,#5865F2,#7c3aed)",
              }}
            >
              + Add Recipe
            </button>
          )}
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-2xl font-black text-white">
              {dashboardStats.totalRecipes}
            </div>
            <div className="mt-1 text-sm text-gray-400">Recipes</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-2xl font-black text-white">
              {dashboardStats.withImages}
            </div>
            <div className="mt-1 text-sm text-gray-400">With images</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-2xl font-black text-white">
              {dashboardStats.craftableInputs}
            </div>
            <div className="mt-1 text-sm text-gray-400">Linked recipes</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-2xl font-black text-white">
              {dashboardStats.rawIngredients}
            </div>
            <div className="mt-1 text-sm text-gray-400">Raw materials</div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="space-y-6">
          <div className="sticky top-4 z-20 rounded-3xl border border-white/10 bg-[#081527]/90 p-4 shadow-xl shadow-black/20 backdrop-blur md:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-semibold text-gray-200">
                  Search recipes or ingredients
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pistol, plastic, spring..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-indigo-300/50"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "images", label: "With images" },
                  { key: "craftable", label: "Uses recipes" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() =>
                      setRecipeFilter(
                        filter.key as "all" | "images" | "craftable",
                      )
                    }
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      recipeFilter === filter.key
                        ? "border-indigo-300/40 bg-indigo-500/25 text-white"
                        : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-h-[680px] rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">Recipes</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Showing {filteredItems.length} of {recipeItems.length} recipes.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
                Click <span className="font-bold text-white">Add to list</span>{" "}
                to calculate materials
              </div>
            </div>

            {loading && <div className="text-gray-300">Loading recipes...</div>}
            {error && <div className="text-red-300">{error}</div>}

            {!loading && !error && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [@media(min-width:1900px)]:grid-cols-5">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="group overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-lg shadow-black/10 transition hover:-translate-y-1 hover:border-indigo-300/40 hover:bg-white/[0.06]"
                  >
                    <div className="relative aspect-[16/10] bg-white/5">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                          No image
                        </div>
                      )}

                      <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                        Output: {item.craft_amount}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-black text-white">
                            {item.name}
                          </h3>
                          <p className="mt-1 text-sm text-gray-400">
                            {item.crafting_recipe_ingredients.length}{" "}
                            ingredients
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {item.crafting_recipe_ingredients
                          .slice(0, 4)
                          .map((ingredient) => (
                            <div
                              key={
                                ingredient.id ||
                                `${item.id}-${ingredient.ingredient_name}`
                              }
                              className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-gray-200">
                                  {ingredient.ingredient_name}
                                </div>
                                {ingredient.ingredient_item_id && (
                                  <div className="text-xs text-amber-300">
                                    Craftable ingredient
                                  </div>
                                )}
                              </div>
                              <span className="shrink-0 font-bold text-white">
                                {ingredient.ingredient_amount}
                              </span>
                            </div>
                          ))}

                        {item.crafting_recipe_ingredients.length > 4 && (
                          <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-gray-400">
                            + {item.crafting_recipe_ingredients.length - 4} more
                            ingredients
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          onClick={() => addToCart(item.id)}
                          className="flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white"
                          style={{
                            background:
                              "linear-gradient(90deg,#5865F2,#6772E5)",
                          }}
                        >
                          Add to list
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => startEdit(item)}
                              className="rounded-2xl border border-amber-400/20 bg-amber-500/15 px-4 py-3 text-sm font-bold text-amber-100 hover:bg-amber-500/25"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => handleDeleteRecipe(item.id)}
                              className="rounded-2xl border border-red-400/20 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-500/25"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredItems.length === 0 && (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-gray-400 md:col-span-2 xl:col-span-3 2xl:col-span-4 [@media(min-width:1900px)]:col-span-5">
                    No crafting recipes found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 2xl:sticky 2xl:top-4 2xl:self-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white">
                  Crafting List
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Choose recipes and the calculator totals everything.
                </p>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-white/10"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mb-4 flex gap-2">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="min-w-0 flex-1 appearance-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                style={{ colorScheme: "dark" }}
              >
                <option value="" className="bg-[#0b0f1a] text-white">
                  Select item
                </option>
                {items.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    className="bg-[#0b0f1a] text-white"
                  >
                    {item.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => addToCart(selectedItemId)}
                className="rounded-2xl px-4 py-3 font-bold text-white"
                style={{
                  background: "linear-gradient(90deg,#5865F2,#6772E5)",
                }}
              >
                Add
              </button>
            </div>

            <div className="space-y-3">
              {cart.map((entry) => {
                const item = items.find((recipe) => recipe.id === entry.itemId);
                if (!item) return null;

                return (
                  <div
                    key={entry.itemId}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-white">
                          {item.name}
                        </div>
                        <div className="mt-1 text-sm text-gray-400">
                          Output per craft: {item.craft_amount}
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(entry.itemId)}
                        className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3">
                      <label className="mb-2 block text-sm text-gray-400">
                        Amount wanted
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={entry.quantity}
                        onChange={(e) =>
                          updateCartQuantity(
                            entry.itemId,
                            Number(e.target.value),
                          )
                        }
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                      />
                    </div>
                  </div>
                );
              })}

              {cart.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-gray-400">
                  Your crafting list is empty.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
            <h2 className="text-2xl font-black text-white">
              Materials Needed
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Open a clean popup with images and total amounts for everything in
              your crafting list.
            </p>

            <button
              type="button"
              onClick={() => setIsTotalsModalOpen(true)}
              disabled={cart.length === 0}
              className="mt-5 w-full rounded-2xl px-5 py-4 text-base font-black text-white shadow-lg shadow-indigo-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background:
                  cart.length === 0
                    ? "linear-gradient(90deg,#374151,#4b5563)"
                    : "linear-gradient(90deg,#10b981,#5865F2)",
              }}
            >
              Show total needed
            </button>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-2xl font-black text-white">
                  {shoppingSummary.expandedIngredients.length}
                </div>
                <div className="mt-1 text-sm text-gray-400">Raw items</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-2xl font-black text-white">
                  {shoppingSummary.subCraftedIngredients.length}
                </div>
                <div className="mt-1 text-sm text-gray-400">Sub-crafts</div>
              </div>
            </div>

            {cart.length === 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
                Add recipes to the crafting list first.
              </div>
            )}

            {shoppingSummary.errors.length > 0 && (
              <div className="mt-4 space-y-2">
                {shoppingSummary.errors.map((error, index) => (
                  <div
                    key={`${error}-${index}`}
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                  >
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isTotalsModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              role="button"
              aria-label="Close materials popup"
              tabIndex={0}
              onClick={() => setIsTotalsModalOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setIsTotalsModalOpen(false);
                }
              }}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            <div className="relative z-[10000] max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#081527] p-5 shadow-2xl shadow-black/50 md:p-7">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">
                    Crafting calculator
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-white">
                    Total Needed To Craft
                  </h2>
                  <p className="mt-2 text-sm text-gray-300">
                    Full material breakdown for your current crafting list with
                    saved item images.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTotalsModalOpen(false)}
                  className="self-start rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Close
                </button>
              </div>

              {cart.length > 0 && (
                <div className="mb-6 rounded-3xl border border-white/10 bg-black/20 p-4">
                  <h3 className="font-bold text-white">Crafting list</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {cart.map((entry) => {
                      const item = items.find(
                        (recipe) => recipe.id === entry.itemId,
                      );
                      if (!item) return null;

                      return (
                        <div
                          key={`modal-cart-${entry.itemId}`}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                        >
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/20">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-bold text-white">
                              {item.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              Amount wanted: {entry.quantity}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="rounded-3xl border border-emerald-400/10 bg-emerald-500/5 p-4 md:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-white">
                        Raw materials
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Final items you need to farm, buy, or collect.
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-bold text-white">
                      {shoppingSummary.expandedIngredients.length}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {shoppingSummary.expandedIngredients.map((ingredient) => {
                      const matchedItem = findItemByName(ingredient.name);

                      return (
                        <div
                          key={`modal-expanded-${ingredient.name}`}
                          className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                        >
                          <div className="aspect-square bg-white/5">
                            {matchedItem?.image ? (
                              <img
                                src={matchedItem.image}
                                alt={ingredient.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <div className="truncate font-black text-white">
                              {ingredient.name}
                            </div>
                            <div className="mt-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-2xl font-black text-white">
                              {ingredient.amount}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {shoppingSummary.expandedIngredients.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-gray-400 sm:col-span-2 lg:col-span-3">
                        Add recipes to see total raw materials.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-400/10 bg-amber-500/5 p-4 md:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-white">
                        Sub-crafts
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Items that are crafted along the way.
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-bold text-white">
                      {shoppingSummary.subCraftedIngredients.length}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {shoppingSummary.subCraftedIngredients.map((ingredient) => {
                      const matchedItem = findItemByName(ingredient.name);

                      return (
                        <div
                          key={`modal-sub-${ingredient.name}`}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                        >
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                            {matchedItem?.image ? (
                              <img
                                src={matchedItem.image}
                                alt={ingredient.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                No image
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-white">
                              {ingredient.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              Needed before final craft
                            </div>
                          </div>

                          <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xl font-black text-white">
                            {ingredient.amount}
                          </div>
                        </div>
                      );
                    })}

                    {shoppingSummary.subCraftedIngredients.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-gray-400">
                        No sub-crafts needed.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {shoppingSummary.errors.length > 0 && (
                <div className="mt-6 space-y-2">
                  {shoppingSummary.errors.map((error, index) => (
                    <div
                      key={`modal-error-${error}-${index}`}
                      className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                    >
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {isAdmin &&
        isRecipeModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              role="button"
              aria-label="Close recipe popup"
              tabIndex={0}
              onClick={closeRecipeModal}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  closeRecipeModal();
                }
              }}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            <div className="relative z-[10000] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#081527] p-5 md:p-7 shadow-2xl shadow-black/50">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-indigo-200/70">
                    Crafting admin
                  </p>
                  <h2 className="text-3xl font-bold text-white mt-2">
                    {editingId ? "Edit Item" : "Add Recipe"}
                  </h2>
                  <p className="text-sm text-gray-300 mt-2">
                    {editingId
                      ? "Update the selected recipe or item and save the changes."
                      : "Create final recipes, raw materials, or non-raw sub-craft items with images and ingredients."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeRecipeModal}
                  className="self-start rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Close
                </button>
              </div>

              {!editingId && (
                <div className="mb-6 grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 md:grid-cols-3">
                  {[
                    { key: "recipe", label: "Recipe", desc: "Final craft" },
                    {
                      key: "raw",
                      label: "Raw material",
                      desc: "Basic ingredient",
                    },
                    {
                      key: "nonRaw",
                      label: "Non-raw item",
                      desc: "Sub-craft item",
                    },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setAdminModalTab(tab.key as AdminModalTab)}
                      className={`rounded-xl px-4 py-3 text-left transition ${
                        adminModalTab === tab.key
                          ? "bg-indigo-500/30 text-white"
                          : "text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      <div className="font-bold">{tab.label}</div>
                      <div className="text-xs text-gray-400">{tab.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              {editingId && (
                <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Editing keeps the current item data. Items with ingredients are
                  craftable; raw materials stay ingredient-free.
                </div>
              )}

              <form onSubmit={handleSaveRecipe} className="space-y-4">
                <div
                  className={`grid grid-cols-1 gap-3 ${adminModalTab !== "raw" ? "md:grid-cols-[1fr_180px]" : ""}`}
                >
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      adminModalTab === "raw"
                        ? "Raw material name"
                        : adminModalTab === "nonRaw"
                          ? "Non-raw craft item name"
                          : "Final recipe name"
                    }
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                    required
                  />

                  {adminModalTab !== "raw" && (
                    <input
                      value={craftAmount}
                      onChange={(e) => setCraftAmount(e.target.value)}
                      type="number"
                      min="1"
                      placeholder="Output per craft"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                    />
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      Item image
                    </label>
                    <p className="text-sm text-gray-400 mb-3">
                      Upload an image to Supabase Storage so recipes, raw
                      materials, and non-raw items can all have pictures.
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadRecipeImage(file);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
                  />

                  {uploadingImage && (
                    <p className="text-sm text-indigo-200">
                      Uploading image...
                    </p>
                  )}

                  {image && (
                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3 items-center">
                      <img
                        src={image}
                        alt="Item preview"
                        className="h-32 w-full rounded-xl border border-white/10 object-cover bg-white/5"
                      />

                      <button
                        type="button"
                        onClick={() => setImage("")}
                        className="w-full rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 hover:bg-red-500/20"
                      >
                        Remove image
                      </button>
                    </div>
                  )}

                  <input
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="Or paste image URL manually"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                  />
                </div>

                {adminModalTab !== "raw" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          Ingredients
                        </h3>
                        <p className="text-sm text-gray-400">
                          Use the fast picker below, then adjust amounts in the selected list. Non-raw items can be built from raw materials or other craftable items.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addIngredientRow}
                        className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{
                          background: "linear-gradient(90deg,#10b981,#059669)",
                        }}
                      >
                        Manual row
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_260px]">
                        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                          {[
                            {
                              key: "raw",
                              label: "Raw materials",
                              count: rawMaterialItems.length,
                            },
                            {
                              key: "nonRaw",
                              label: "Non-raw items",
                              count: nonRawMaterialItems.length,
                            },
                          ].map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() =>
                                setIngredientPickerTab(
                                  tab.key as IngredientPickerTab,
                                )
                              }
                              className={`rounded-xl px-4 py-3 text-left transition ${
                                ingredientPickerTab === tab.key
                                  ? "bg-indigo-500/30 text-white"
                                  : "text-gray-300 hover:bg-white/10"
                              }`}
                            >
                              <div className="font-bold">{tab.label}</div>
                              <div className="text-xs text-gray-400">
                                {tab.count} saved
                              </div>
                            </button>
                          ))}
                        </div>

                        <input
                          value={ingredientPickerSearch}
                          onChange={(e) =>
                            setIngredientPickerSearch(e.target.value)
                          }
                          placeholder="Search items..."
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-gray-500"
                        />
                      </div>

                      <div className="max-h-72 overflow-y-auto pr-1">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {filteredIngredientPickerItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => addIngredientFromPicker(item)}
                              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:border-indigo-300/50 hover:bg-white/[0.08]"
                            >
                              <div className="aspect-square bg-black/20">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="h-full w-full object-cover transition group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                    No image
                                  </div>
                                )}
                              </div>

                              <div className="p-3">
                                <div className="truncate text-sm font-bold text-white">
                                  {item.name}
                                </div>
                                <div className="mt-1 text-xs text-gray-400">
                                  Click to add
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        {filteredIngredientPickerItems.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-gray-400">
                            No items found in this tab.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <h4 className="font-bold text-white">Selected ingredients</h4>
                      <span className="text-sm text-gray-400">
                        {ingredients.filter((ingredient) => ingredient.ingredient_name.trim()).length} selected
                      </span>
                    </div>

                    {ingredients.map((ingredient, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3"
                      >
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">
                              Browse existing material/item
                            </label>
                            <select
                              value={ingredient.ingredient_item_id}
                              onChange={(e) =>
                                handleLinkedItemChange(index, e.target.value)
                              }
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none appearance-none"
                              style={{ colorScheme: "dark" }}
                            >
                              <option
                                value=""
                                className="bg-[#0b0f1a] text-white"
                              >
                                Choose existing item / or type manually
                              </option>
                              {linkableItems.map((item) => (
                                <option
                                  key={item.id}
                                  value={item.id}
                                  className="bg-[#0b0f1a] text-white"
                                >
                                  {item.crafting_recipe_ingredients.length === 0
                                    ? "[Material] "
                                    : "[Recipe] "}
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {ingredient.ingredient_item_id ? (
                            (() => {
                              const linkedItem = items.find(
                                (item) => item.id === ingredient.ingredient_item_id,
                              );

                              return (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                                  {linkedItem?.image ? (
                                    <img
                                      src={linkedItem.image}
                                      alt={linkedItem.name}
                                      className="h-24 w-full rounded-lg object-cover bg-black/20"
                                    />
                                  ) : (
                                    <div className="flex h-24 items-center justify-center rounded-lg bg-black/20 text-xs text-gray-500">
                                      No image
                                    </div>
                                  )}
                                  <div className="mt-2 truncate text-sm font-semibold text-white">
                                    {linkedItem?.name || "Selected item"}
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-3 text-sm text-gray-400">
                              Pick an existing material to use its saved image,
                              or type a custom name below.
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            Ingredient name
                          </label>
                          <input
                            value={ingredient.ingredient_name}
                            onChange={(e) =>
                              updateIngredientRow(
                                index,
                                "ingredient_name",
                                e.target.value,
                              )
                            }
                            placeholder="Ingredient name"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">
                              Amount
                            </label>
                            <input
                              value={ingredient.ingredient_amount}
                              onChange={(e) =>
                                updateIngredientRow(
                                  index,
                                  "ingredient_amount",
                                  e.target.value,
                                )
                              }
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Amount"
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                            />
                          </div>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => removeIngredientRow(index)}
                              className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white"
                              style={{
                                background:
                                  "linear-gradient(90deg,#ef4444,#dc2626)",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {ingredient.ingredient_item_id && (
                          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                            This ingredient is linked to an existing item. Items
                            with no recipe are treated as raw materials in the
                            calculator; items with recipes are broken down.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    This will save as a true raw material with an image and no
                    recipe ingredients. The calculator will use it as the final
                    base material when breaking down crafting prices.
                  </div>
                )}

                <div className="sticky bottom-0 -mx-5 md:-mx-7 -mb-5 md:-mb-7 mt-6 border-t border-white/10 bg-[#081527]/95 p-5 md:p-7 backdrop-blur">
                  <div className="flex flex-col-reverse md:flex-row gap-3 md:justify-end">
                    <button
                      type="button"
                      onClick={closeRecipeModal}
                      className="px-5 py-3 rounded-xl text-white font-semibold bg-white/10 border border-white/10 hover:bg-white/15"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
                      style={{
                        background: "linear-gradient(90deg,#5865F2,#6772E5)",
                      }}
                    >
                      {saving
                        ? "Saving..."
                        : editingId
                          ? "Save item"
                          : adminModalTab === "raw"
                            ? "Add raw material"
                            : adminModalTab === "nonRaw"
                              ? "Add non-raw craft item"
                              : "Add recipe"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
