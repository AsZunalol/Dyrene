"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MethColor = "green" | "red" | "blue";
type SortOption =
  | "default"
  | "renhed-desc"
  | "renhed-asc"
  | "stabiliseringstid-desc"
  | "stabiliseringstid-asc";

type StatusFilter = "all" | "completed" | "missing";

type Recipe = {
  id: string;
  fosfor_color: MethColor;
  lithium: number;
  pseudoephedrin: number;
  fosfor_amount: number;
  renhed: number | null;
  stabiliseringstid: number | null;
  updated_at?: string | null;
};

type Props = {
  isAdmin: boolean;
};

function colorClasses(color: MethColor) {
  if (color === "green") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/20";
  if (color === "red") return "bg-red-500/20 text-red-300 border-red-400/20";
  return "bg-blue-500/20 text-blue-300 border-blue-400/20";
}

function colorTabClasses(active: boolean, color: MethColor) {
  if (!active) {
    return "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10";
  }

  if (color === "green") {
    return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
  }

  if (color === "red") {
    return "bg-red-500/20 text-red-300 border-red-400/30";
  }

  return "bg-blue-500/20 text-blue-300 border-blue-400/30";
}

function comboLabel(recipe: Recipe) {
  return `${recipe.lithium}-${recipe.pseudoephedrin}-${recipe.fosfor_amount}`;
}

export default function MethRecipesTable({ isAdmin }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rouletteKey, setRouletteKey] = useState(0);

  const [color, setColor] = useState<MethColor>("green");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [renhedInput, setRenhedInput] = useState("");
  const [stabiliseringstidInput, setStabiliseringstidInput] = useState("");

  const [rouletteItems, setRouletteItems] = useState<Recipe[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [rouletteOffset, setRouletteOffset] = useState(0);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  async function fetchRecipes(selectedColor: MethColor) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/meth?color=${selectedColor}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch recipes");
      }

      setRecipes(json);
      setSelectedRecipeId(null);
      setRouletteItems([]);
      setRouletteOffset(0);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch recipes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecipes(color);
  }, [color]);

  const filteredRecipes = useMemo(() => {
    let list = [...recipes];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((recipe) =>
        comboLabel(recipe).toLowerCase().includes(term)
      );
    }

    if (statusFilter === "completed") {
      list = list.filter(
        (recipe) =>
          recipe.renhed !== null && recipe.stabiliseringstid !== null
      );
    }

    if (statusFilter === "missing") {
      list = list.filter(
        (recipe) =>
          recipe.renhed === null || recipe.stabiliseringstid === null
      );
    }

    switch (sortBy) {
      case "renhed-desc":
        list.sort((a, b) => (b.renhed ?? -Infinity) - (a.renhed ?? -Infinity));
        break;
      case "renhed-asc":
        list.sort((a, b) => (a.renhed ?? Infinity) - (b.renhed ?? Infinity));
        break;
      case "stabiliseringstid-desc":
        list.sort(
          (a, b) =>
            (b.stabiliseringstid ?? -Infinity) - (a.stabiliseringstid ?? -Infinity)
        );
        break;
      case "stabiliseringstid-asc":
        list.sort(
          (a, b) =>
            (a.stabiliseringstid ?? Infinity) - (b.stabiliseringstid ?? Infinity)
        );
        break;
      default:
        list.sort((a, b) => {
          if (a.lithium !== b.lithium) return a.lithium - b.lithium;
          if (a.pseudoephedrin !== b.pseudoephedrin) {
            return a.pseudoephedrin - b.pseudoephedrin;
          }
          return a.fosfor_amount - b.fosfor_amount;
        });
        break;
    }

    return list;
  }, [recipes, search, sortBy, statusFilter]);

  const missingRecipes = useMemo(() => {
    return recipes.filter(
      (recipe) =>
        recipe.renhed === null || recipe.stabiliseringstid === null
    );
  }, [recipes]);

  const completedCount = useMemo(() => {
    return recipes.filter(
      (recipe) =>
        recipe.renhed !== null && recipe.stabiliseringstid !== null
    ).length;
  }, [recipes]);

  const missingCount = useMemo(() => {
    return recipes.filter(
      (recipe) =>
        recipe.renhed === null || recipe.stabiliseringstid === null
    ).length;
  }, [recipes]);

  function startEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setRenhedInput(recipe.renhed?.toString() ?? "");
    setStabiliseringstidInput(recipe.stabiliseringstid?.toString() ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setRenhedInput("");
    setStabiliseringstidInput("");
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch("/api/meth", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          renhed: renhedInput === "" ? null : Number(renhedInput),
          stabiliseringstid:
            stabiliseringstidInput === "" ? null : Number(stabiliseringstidInput),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save recipe");
      }

      setRecipes((prev) =>
        prev.map((recipe) => (recipe.id === id ? json : recipe))
      );

      if (
        json.renhed !== null &&
        json.stabiliseringstid !== null &&
        selectedRecipeId === id &&
        statusFilter === "missing"
      ) {
        setSelectedRecipeId(null);
      }

      cancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save recipe");
    }
  }

  function buildRouletteList(pool: Recipe[], winner: Recipe) {
    const totalItems = 45;
    const winnerIndex = 36;
    const built: Recipe[] = [];

    for (let i = 0; i < totalItems; i++) {
      if (i === winnerIndex) {
        built.push(winner);
      } else {
        built.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }

    return { built, winnerIndex };
  }

  function pickRandomMissingRecipe() {
  if (isRolling) return;

  if (missingRecipes.length === 0) {
    alert("No missing recipes left for this color.");
    return;
  }

  const winner =
    missingRecipes[Math.floor(Math.random() * missingRecipes.length)];

  const { built, winnerIndex } = buildRouletteList(missingRecipes, winner);

  const itemWidth = 220;
  const centerIndex = 1;
  const finalOffset = winnerIndex * itemWidth - centerIndex * itemWidth;

  setSelectedRecipeId(null);
  setIsRolling(false);
  setRouletteItems([]);
  setRouletteOffset(0);

  // force a fresh render before starting the next roll
  window.setTimeout(() => {
    setRouletteItems(built);
    setRouletteOffset(0);

    window.setTimeout(() => {
      setIsRolling(true);
      setRouletteOffset(finalOffset);
    }, 50);
  }, 50);

  window.setTimeout(() => {
    setIsRolling(false);
    setSelectedRecipeId(winner.id);

    const row = rowRefs.current[winner.id];
    if (row) {
      row.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, 4300);
}

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Recipes</h2>
        <p className="text-gray-300 mt-2">
          Browse all 1000 combinations for the selected fosfor color.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        {(["green", "red", "blue"] as MethColor[]).map((tabColor) => (
          <button
            key={tabColor}
            onClick={() => setColor(tabColor)}
            className={`px-5 py-3 rounded-xl border text-sm font-semibold transition ${colorTabClasses(
              color === tabColor,
              tabColor
            )}`}
          >
            {tabColor.charAt(0).toUpperCase() + tabColor.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div>
          <label className="block text-sm text-gray-300 mb-2">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none"
          >
            <option value="default">Default</option>
            <option value="renhed-desc">Highest renhed</option>
            <option value="renhed-asc">Lowest renhed</option>
            <option value="stabiliseringstid-desc">Highest stabiliseringstid</option>
            <option value="stabiliseringstid-asc">Lowest stabiliseringstid</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Recipe status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none"
          >
            <option value="all">All recipes</option>
            <option value="completed">Only completed recipes</option>
            <option value="missing">Only missing renhed/stabiliseringstid</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Search combo</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Example: 50-20-100"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
          Color recipes: <span className="font-bold text-white">{recipes.length}</span>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
          Completed: <span className="font-bold text-white">{completedCount}</span>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
          Missing: <span className="font-bold text-white">{missingCount}</span>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
          Visible after filters:{" "}
          <span className="font-bold text-white">{filteredRecipes.length}</span>
        </div>

        {isAdmin && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-400/20 px-4 py-3 text-sm text-amber-200">
            Admin mode: you can edit renhed and stabiliseringstid
          </div>
        )}
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Random Missing Picker</h3>
            <p className="text-sm text-gray-300 mt-1">
              Picks a random recipe that still needs renhed or stabiliseringstid.
            </p>
          </div>

          <button
            onClick={pickRandomMissingRecipe}
            disabled={isRolling || missingRecipes.length === 0}
            className="px-5 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(90deg,#8b5cf6,#ec4899,#f59e0b)",
            }}
          >
            {isRolling ? "Rolling..." : "Pick random missing recipe"}
          </button>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#06111f] h-[118px]">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[4px] bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)] z-20" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#06111f] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#06111f] to-transparent z-10" />

          <div
  key={rouletteKey}
  className="flex h-full items-center gap-3 px-3"
  style={{
    transform: `translateX(-${rouletteOffset}px)`,
    transition: isRolling
      ? "transform 4.2s cubic-bezier(0.08, 0.7, 0.15, 1)"
      : "none",
    width: "max-content",
  }}
>
            {(rouletteItems.length > 0 ? rouletteItems : missingRecipes.slice(0, 12)).map(
              (recipe, index) => {
                const isWinner = selectedRecipeId === recipe.id;

                return (
                  <div
                    key={`${recipe.id}-${index}`}
                    className={`w-[208px] min-w-[208px] rounded-xl border p-4 ${
                      isWinner
                        ? "border-yellow-400 bg-yellow-500/20 shadow-[0_0_25px_rgba(250,204,21,0.25)]"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold border ${colorClasses(
                          recipe.fosfor_color
                        )}`}
                      >
                        {recipe.fosfor_color}
                      </span>

                      <span className="text-xs text-gray-400">
                        {recipe.renhed === null || recipe.stabiliseringstid === null
                          ? "Missing"
                          : "Done"}
                      </span>
                    </div>

                    <div className="text-lg font-bold text-white">
                      {comboLabel(recipe)}
                    </div>

                    <div className="mt-2 text-xs text-gray-300">
                      Renhed: {recipe.renhed ?? "—"} · Stabiliseringstid:{" "}
                      {recipe.stabiliseringstid ?? "—"}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {selectedRecipeId && (
          <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            Winner selected. The table will highlight the picked missing recipe.
          </div>
        )}
      </div>

      {loading && <div className="text-gray-300">Loading recipes...</div>}
      {error && <div className="text-red-300">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm text-white">
            <thead className="border-b border-white/10 text-gray-300 bg-white/5">
              <tr>
                <th className="px-4 py-4">Color</th>
                <th className="px-4 py-4">Lithium</th>
                <th className="px-4 py-4">Pseudoephedrin</th>
                <th className="px-4 py-4">Fosfor</th>
                <th className="px-4 py-4">Renhed</th>
                <th className="px-4 py-4">Stabiliseringstid</th>
                <th className="px-4 py-4">Status</th>
                {isAdmin && <th className="px-4 py-4">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {filteredRecipes.map((recipe) => {
                const isEditing = editingId === recipe.id;
                const isCompleted =
                  recipe.renhed !== null && recipe.stabiliseringstid !== null;
                const isSelected = selectedRecipeId === recipe.id;

                return (
                  <tr
                    key={recipe.id}
                    ref={(el) => {
                      rowRefs.current[recipe.id] = el;
                    }}
                    className={`border-b border-white/5 hover:bg-white/5 ${
                      isSelected ? "bg-yellow-500/10 ring-1 ring-yellow-400/30" : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold border ${colorClasses(
                          recipe.fosfor_color
                        )}`}
                      >
                        {recipe.fosfor_color}
                      </span>
                    </td>

                    <td className="px-4 py-4 font-semibold">{recipe.lithium}</td>
                    <td className="px-4 py-4 font-semibold">
                      {recipe.pseudoephedrin}
                    </td>
                    <td className="px-4 py-4 font-semibold">{recipe.fosfor_amount}</td>

                    <td className="px-4 py-4">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={renhedInput}
                          onChange={(e) => setRenhedInput(e.target.value)}
                          className="w-28 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none"
                        />
                      ) : (
                        recipe.renhed ?? "—"
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {isEditing ? (
                        <input
                          type="number"
                          value={stabiliseringstidInput}
                          onChange={(e) => setStabiliseringstidInput(e.target.value)}
                          className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none"
                        />
                      ) : (
                        recipe.stabiliseringstid ?? "—"
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {isCompleted ? (
                        <span className="rounded-full px-3 py-1 text-xs font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-400/20">
                          Completed
                        </span>
                      ) : (
                        <span className="rounded-full px-3 py-1 text-xs font-semibold border bg-yellow-500/20 text-yellow-300 border-yellow-400/20">
                          Missing data
                        </span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-4">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(recipe.id)}
                              className="px-3 py-2 rounded-lg text-sm font-semibold text-white"
                              style={{
                                background: "linear-gradient(90deg,#10b981,#059669)",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-white/10 border border-white/10"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(recipe)}
                            className="px-3 py-2 rounded-lg text-sm font-semibold text-white"
                            style={{
                              background: "linear-gradient(90deg,#5865F2,#6772E5)",
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredRecipes.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No recipes match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}