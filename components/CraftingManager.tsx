"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
      })
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
  amount: number
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
  isRoot = true
) {
  const item = itemsMap.get(itemId);
  if (!item) return;

  if (visited.has(itemId)) {
    throw new Error(`Recipe loop detected for "${item.name}"`);
  }

  if (!isRoot) {
    addToTotals(subCraftedTotals, item.name, quantityWanted);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(itemId);

  const multiplier = quantityWanted / item.craft_amount;

  for (const ingredient of item.crafting_recipe_ingredients) {
    const neededAmount = ingredient.ingredient_amount * multiplier;

    if (ingredient.ingredient_item_id) {
      expandCraftingCost(
        ingredient.ingredient_item_id,
        neededAmount,
        itemsMap,
        rawTotals,
        subCraftedTotals,
        nextVisited,
        false
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
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
  const hasFetchedRef = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);
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
      setError(err instanceof Error ? err.message : "Failed to fetch crafting items");
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
              entry.quantity > 0
          )
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

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) => {
      const haystack = [
        item.name,
        ...item.crafting_recipe_ingredients.map((ingredient) => ingredient.ingredient_name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [items, search]);

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
            selectedItemId,
            cart,
            scrollY: window.scrollY,
          })
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
  }, [cart, hydratedFromCache, search, selectedItemId]);

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
          subCraftedTotals
        );
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : `Failed to expand "${item.name}"`
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
    return items.filter((item) => item.id !== editingId);
  }, [items, editingId]);

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

  function startEdit(item: CraftingItem) {
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
        : [emptyIngredient()]
    );
  }

  function addIngredientRow() {
    setIngredients((prev) => [...prev, emptyIngredient()]);
  }

  function updateIngredientRow(
    index: number,
    key: "ingredient_name" | "ingredient_amount" | "ingredient_item_id",
    value: string
  ) {
    setIngredients((prev) =>
      prev.map((ingredient, i) =>
        i === index ? { ...ingredient, [key]: value } : ingredient
      )
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
      })
    );
  }

  function removeIngredientRow(index: number) {
    setIngredients((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  async function handleSaveRecipe(e: React.FormEvent) {
    e.preventDefault();

    const cleanIngredients = ingredients
      .map((ingredient) => ({
        ingredient_name: ingredient.ingredient_name.trim(),
        ingredient_amount: Number(ingredient.ingredient_amount),
        ingredient_item_id: ingredient.ingredient_item_id.trim() || null,
      }))
      .filter(
        (ingredient) =>
          ingredient.ingredient_name &&
          Number.isFinite(ingredient.ingredient_amount) &&
          ingredient.ingredient_amount > 0
      );

    if (!name.trim()) {
      return alert("Enter an item name");
    }

    if (!cleanIngredients.length) {
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
          craft_amount: Number(craftAmount) || 1,
          ingredients: cleanIngredients,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error || "Failed to save recipe");
        return;
      }

      clearCraftingCache();
      await fetchItems(true);
      resetForm();
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
            : entry
        );
      }

      return [...prev, { itemId, quantity: 1 }];
    });
  }

  function updateCartQuantity(itemId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.itemId === itemId ? { ...entry, quantity } : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => prev.filter((entry) => entry.itemId !== itemId));
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm text-gray-300 mb-2">
                  Search recipes or ingredients
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pistol, plastic, spring..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                />
              </div>

              <div className="w-full md:w-[280px]">
                <label className="block text-sm text-gray-300 mb-2">
                  Add recipe to shopping list
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none appearance-none"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="" className="bg-[#0b0f1a] text-white">Select item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id} className="bg-[#0b0f1a] text-white">
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => addToCart(selectedItemId)}
                    className="px-4 py-3 rounded-xl font-semibold text-white"
                    style={{
                      background: "linear-gradient(90deg,#5865F2,#6772E5)",
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Recipes</h2>
                <p className="text-sm text-gray-300 mt-1">
                  Click into recipes and add them to your crafting calculator.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200">
                Total recipes: <span className="font-bold text-white">{filteredItems.length}</span>
              </div>
            </div>

            {loading && <div className="text-gray-300">Loading recipes...</div>}
            {error && <div className="text-red-300">{error}</div>}

            {!loading && !error && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white">{item.name}</h3>
                        <p className="text-sm text-gray-300 mt-1">
                          Craft output: {item.craft_amount}
                        </p>

                        <div className="mt-3 space-y-1">
                          {item.crafting_recipe_ingredients.map((ingredient) => (
                            <div
                              key={ingredient.id || `${item.id}-${ingredient.ingredient_name}`}
                              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                            >
                              <div className="flex flex-col">
                                <span className="text-gray-200">{ingredient.ingredient_name}</span>
                                {ingredient.ingredient_item_id && (
                                  <span className="text-xs text-amber-300">Craftable ingredient</span>
                                )}
                              </div>

                              <span className="font-semibold text-white">
                                {ingredient.ingredient_amount}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                          <button
                            onClick={() => addToCart(item.id)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                            style={{
                              background: "linear-gradient(90deg,#5865F2,#6772E5)",
                            }}
                          >
                            Add to list
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                onClick={() => startEdit(item)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                style={{
                                  background: "linear-gradient(90deg,#f59e0b,#d97706)",
                                }}
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => handleDeleteRecipe(item.id)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                style={{
                                  background: "linear-gradient(90deg,#ef4444,#dc2626)",
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredItems.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-gray-400">
                    No crafting recipes found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-2xl font-bold text-white mb-2">Shopping List</h2>
            <p className="text-sm text-gray-300 mb-4">
              Add one or more items and set how many you want to craft.
            </p>

            <div className="space-y-3">
              {cart.map((entry) => {
                const item = items.find((recipe) => recipe.id === entry.itemId);
                if (!item) return null;

                return (
                  <div
                    key={entry.itemId}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="text-sm text-gray-400">
                          Output per craft: {item.craft_amount}
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(entry.itemId)}
                        className="text-sm px-3 py-2 rounded-lg text-white"
                        style={{
                          background: "linear-gradient(90deg,#ef4444,#dc2626)",
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm text-gray-300 mb-2">
                        How many do you want?
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={entry.quantity}
                        onChange={(e) =>
                          updateCartQuantity(
                            entry.itemId,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none appearance-none"
                            style={{ colorScheme: "dark" }}
                      />
                    </div>
                  </div>
                );
              })}

              {cart.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-gray-400">
                  No items in the shopping list yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-2xl font-bold text-white mb-2">Direct Materials</h2>
            <p className="text-sm text-gray-300 mb-4">
              The first recipe layer for the items you selected.
            </p>

            <div className="space-y-2">
              {shoppingSummary.directIngredients.map((ingredient) => (
                <div
                  key={`direct-${ingredient.name}`}
                  className="flex items-center justify-between rounded-xl border border-blue-400/10 bg-blue-500/5 px-4 py-3"
                >
                  <span className="text-gray-200">{ingredient.name}</span>
                  <span className="font-bold text-white">{ingredient.amount}</span>
                </div>
              ))}

              {shoppingSummary.directIngredients.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-gray-400">
                  Add items to see the direct recipe totals.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-2xl font-bold text-white mb-2">Crafted Sub-Ingredients</h2>
            <p className="text-sm text-gray-300 mb-4">
              Craftable ingredients found inside the recipe chain before reaching raw materials.
            </p>

            <div className="space-y-2">
              {shoppingSummary.subCraftedIngredients.map((ingredient) => (
                <div
                  key={`sub-${ingredient.name}`}
                  className="flex items-center justify-between rounded-xl border border-amber-400/10 bg-amber-500/5 px-4 py-3"
                >
                  <span className="text-gray-200">{ingredient.name}</span>
                  <span className="font-bold text-white">{ingredient.amount}</span>
                </div>
              ))}

              {shoppingSummary.subCraftedIngredients.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-gray-400">
                  No crafted sub-ingredients were found in this crafting chain.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-2xl font-bold text-white mb-2">Expanded Raw Materials</h2>
            <p className="text-sm text-gray-300 mb-4">
              Final base materials after breaking all linked craftable ingredients down.
            </p>

            <div className="space-y-2">
              {shoppingSummary.expandedIngredients.map((ingredient) => (
                <div
                  key={`expanded-${ingredient.name}`}
                  className="flex items-center justify-between rounded-xl border border-emerald-400/10 bg-emerald-500/5 px-4 py-3"
                >
                  <span className="text-gray-200">{ingredient.name}</span>
                  <span className="font-bold text-white">{ingredient.amount}</span>
                </div>
              ))}

              {shoppingSummary.expandedIngredients.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-gray-400">
                  Add items to see the expanded raw material totals.
                </div>
              )}
            </div>

            {shoppingSummary.errors.length > 0 && (
              <div className="mt-4 space-y-2">
                {shoppingSummary.errors.map((error, index) => (
                  <div
                    key={`${error}-${index}`}
                    className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                  >
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {editingId ? "Edit Recipe" : "Add Recipe"}
                  </h2>
                  <p className="text-sm text-gray-300 mt-1">
                    Admins can create and update crafting recipes here.
                  </p>
                </div>

                {editingId && (
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-white/10 border border-white/10"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveRecipe} className="space-y-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Crafted item name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                  required
                />

                <input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="Image URL"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                />

                <input
                  value={craftAmount}
                  onChange={(e) => setCraftAmount(e.target.value)}
                  type="number"
                  min="1"
                  placeholder="Output per craft"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Ingredients</h3>
                    <button
                      type="button"
                      onClick={addIngredientRow}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                      style={{
                        background: "linear-gradient(90deg,#10b981,#059669)",
                      }}
                    >
                      Add ingredient
                    </button>
                  </div>

                  {ingredients.map((ingredient, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            Raw ingredient name
                          </label>
                          <input
                            value={ingredient.ingredient_name}
                            onChange={(e) =>
                              updateIngredientRow(index, "ingredient_name", e.target.value)
                            }
                            placeholder="Ingredient name"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            Link craftable item (optional)
                          </label>
                          <select
                            value={ingredient.ingredient_item_id}
                            onChange={(e) => handleLinkedItemChange(index, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none appearance-none"
                            style={{ colorScheme: "dark" }}
                          >
                            <option value="" className="bg-[#0b0f1a] text-white">None / raw material</option>
                            {linkableItems.map((item) => (
                              <option key={item.id} value={item.id} className="bg-[#0b0f1a] text-white">
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            Amount
                          </label>
                          <input
                            value={ingredient.ingredient_amount}
                            onChange={(e) =>
                              updateIngredientRow(index, "ingredient_amount", e.target.value)
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
                              background: "linear-gradient(90deg,#ef4444,#dc2626)",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {ingredient.ingredient_item_id && (
                        <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                          This ingredient is linked to a craftable item, so the calculator will show it in sub-ingredients and break it down into raw materials.
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full px-5 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
                  style={{
                    background: "linear-gradient(90deg,#5865F2,#6772E5)",
                  }}
                >
                  {saving ? "Saving..." : editingId ? "Save recipe" : "Add recipe"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}