"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type MethListResponse = {
  items: Recipe[];
  total: number;
  completedCount: number;
  missingCount: number;
};

type Props = {
  isAdmin: boolean;
};

const PAGE_SIZE = 50;
const CACHE_TTL_MS = 1000 * 60 * 10;
const METH_PAGES_CACHE_KEY = "dyrene-meth-pages-cache";
const METH_UI_CACHE_KEY = "dyrene-meth-ui-cache";

type MethCacheEntry = {
  recipes: Recipe[];
  page: number;
  hasMore: boolean;
  total: number;
  completedCount: number;
  missingCount: number;
  savedAt: number;
};

type MethUiCache = {
  color: MethColor;
  sortBy: SortOption;
  statusFilter: StatusFilter;
  search: string;
  scrollY: number;
};

function buildCacheKey(color: MethColor, sortBy: SortOption, statusFilter: StatusFilter, search: string) {
  return `${color}::${sortBy}::${statusFilter}::${search.trim().toLowerCase()}`;
}

function readPagesCache() {
  if (typeof window === "undefined") return {} as Record<string, MethCacheEntry>;

  try {
    const raw = window.sessionStorage.getItem(METH_PAGES_CACHE_KEY);
    if (!raw) return {} as Record<string, MethCacheEntry>;

    const parsed = JSON.parse(raw) as Record<string, MethCacheEntry>;
    const now = Date.now();

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        return (
          value &&
          Array.isArray(value.recipes) &&
          typeof value.page === "number" &&
          typeof value.hasMore === "boolean" &&
          typeof value.total === "number" &&
          typeof value.completedCount === "number" &&
          typeof value.missingCount === "number" &&
          typeof value.savedAt === "number" &&
          now - value.savedAt < CACHE_TTL_MS
        );
      })
    );
  } catch {
    return {} as Record<string, MethCacheEntry>;
  }
}

function writePagesCache(cache: Record<string, MethCacheEntry>) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(METH_PAGES_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function clearMethCache() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(METH_PAGES_CACHE_KEY);
    window.sessionStorage.removeItem(METH_UI_CACHE_KEY);
  } catch {}
}

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
  return `${recipe.fosfor_amount}-${recipe.pseudoephedrin}-${recipe.lithium}`;
}

function RecipesTableSkeleton({ isAdmin, rows = 12 }: { isAdmin: boolean; rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 animate-pulse">
      <table className="w-full text-left text-sm text-white">
        <thead className="border-b border-white/10 text-gray-300 bg-white/5">
          <tr>
            <th className="px-4 py-4">Color</th>
            <th className="px-4 py-4">Fosfor</th>
            <th className="px-4 py-4">Pseudoephedrin</th>
            <th className="px-4 py-4">Lithium</th>
            <th className="px-4 py-4">Renhed</th>
            <th className="px-4 py-4">Stabiliseringstid</th>
            <th className="px-4 py-4">Status</th>
            {isAdmin && <th className="px-4 py-4">Actions</th>}
          </tr>
        </thead>

        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index} className="border-b border-white/5">
              <td className="px-4 py-4"><div className="h-7 w-16 rounded-full bg-white/10" /></td>
              <td className="px-4 py-4"><div className="h-5 w-12 rounded bg-white/10" /></td>
              <td className="px-4 py-4"><div className="h-5 w-16 rounded bg-white/10" /></td>
              <td className="px-4 py-4"><div className="h-5 w-10 rounded bg-white/10" /></td>
              <td className="px-4 py-4"><div className="h-5 w-14 rounded bg-white/10" /></td>
              <td className="px-4 py-4"><div className="h-5 w-20 rounded bg-white/10" /></td>
              <td className="px-4 py-4"><div className="h-7 w-24 rounded-full bg-white/10" /></td>
              {isAdmin && <td className="px-4 py-4"><div className="h-9 w-16 rounded-lg bg-white/10" /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MethRecipesTable({ isAdmin }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rouletteKey, setRouletteKey] = useState(0);

  const [color, setColor] = useState<MethColor>("green");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);

  const [total, setTotal] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [missingCount, setMissingCount] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [renhedInput, setRenhedInput] = useState("");
  const [stabiliseringstidInput, setStabiliseringstidInput] = useState("");

  const [rouletteItems, setRouletteItems] = useState<Recipe[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [rouletteOffset, setRouletteOffset] = useState(0);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const rouletteViewportRef = useRef<HTMLDivElement | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawUi = window.sessionStorage.getItem(METH_UI_CACHE_KEY);
      const ui = rawUi ? (JSON.parse(rawUi) as MethUiCache) : null;

      const cachedColor =
        ui?.color === "green" || ui?.color === "red" || ui?.color === "blue"
          ? ui.color
          : "green";
      const cachedSortBy =
        ui?.sortBy === "default" ||
        ui?.sortBy === "renhed-desc" ||
        ui?.sortBy === "renhed-asc" ||
        ui?.sortBy === "stabiliseringstid-desc" ||
        ui?.sortBy === "stabiliseringstid-asc"
          ? ui.sortBy
          : "default";
      const cachedStatus =
        ui?.statusFilter === "all" ||
        ui?.statusFilter === "completed" ||
        ui?.statusFilter === "missing"
          ? ui.statusFilter
          : "all";
      const cachedSearch = typeof ui?.search === "string" ? ui.search : "";

      setColor(cachedColor);
      setSortBy(cachedSortBy);
      setStatusFilter(cachedStatus);
      setSearch(cachedSearch);
      setDebouncedSearch(cachedSearch.trim());

      const cacheKey = buildCacheKey(
        cachedColor,
        cachedSortBy,
        cachedStatus,
        cachedSearch
      );
      const pagesCache = readPagesCache();
      const entry = pagesCache[cacheKey];

      if (entry) {
        setRecipes(entry.recipes);
        setPage(entry.page);
        setHasMore(entry.hasMore);
        setTotal(entry.total);
        setCompletedCount(entry.completedCount);
        setMissingCount(entry.missingCount);
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
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const buildMethUrl = useCallback(
    (pageNumber: number) => {
      const params = new URLSearchParams({
        color,
        limit: String(PAGE_SIZE),
        offset: String(pageNumber * PAGE_SIZE),
        sort: sortBy,
        status: statusFilter,
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      return `/api/meth?${params.toString()}`;
    },
    [color, debouncedSearch, sortBy, statusFilter]
  );

  const fetchRecipesPage = useCallback(
    async (pageNumber: number, replace = false, silent = false) => {
      if (!silent) {
        if (replace) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
      }

      setError(null);

      try {
        const res = await fetch(buildMethUrl(pageNumber), { cache: "no-store" });
        const json: MethListResponse = await res.json();

        if (!res.ok) {
          throw new Error((json as any)?.error || "Failed to fetch recipes");
        }

        const nextItems = Array.isArray(json?.items) ? json.items : [];

        setRecipes((current) => (replace ? nextItems : [...current, ...nextItems]));
        setPage(pageNumber);
        setHasMore(nextItems.length === PAGE_SIZE);
        setTotal(json?.total ?? 0);
        setCompletedCount(json?.completedCount ?? 0);
        setMissingCount(json?.missingCount ?? 0);

        if (replace) {
          setSelectedRecipeId(null);
          setRouletteItems([]);
          setRouletteOffset(0);
        }
      } catch (err) {
        console.error(err);
        if (replace) {
          setRecipes([]);
          setTotal(0);
          setCompletedCount(0);
          setMissingCount(0);
        }
        setError(err instanceof Error ? err.message : "Failed to fetch recipes");
      } finally {
        if (!silent) {
          if (replace) {
            setLoading(false);
          } else {
            setLoadingMore(false);
          }
        }
      }
    },
    [buildMethUrl]
  );


  const refreshCurrentView = useCallback(async () => {
    const loadedCount = Math.max(PAGE_SIZE, (page + 1) * PAGE_SIZE);

    setIsSyncing(true);

    try {
      const params = new URLSearchParams({
        color,
        limit: String(loadedCount),
        offset: "0",
        sort: sortBy,
        status: statusFilter,
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(`/api/meth?${params.toString()}`, { cache: "no-store" });
      const json: MethListResponse = await res.json();

      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to refresh recipes");
      }

      const nextItems = Array.isArray(json?.items) ? json.items : [];

      setRecipes(nextItems);
      setPage(Math.max(0, Math.ceil(nextItems.length / PAGE_SIZE) - 1));
      setHasMore(nextItems.length < (json?.total ?? 0));
      setTotal(json?.total ?? 0);
      setCompletedCount(json?.completedCount ?? 0);
      setMissingCount(json?.missingCount ?? 0);
    } catch (err) {
      console.error("Failed to refresh meth recipes in realtime", err);
    } finally {
      setIsSyncing(false);
    }
  }, [color, debouncedSearch, page, sortBy, statusFilter]);

  const resetAndFetch = useCallback(() => {
    clearMethCache();
    setRecipes([]);
    setPage(0);
    setHasMore(true);
    setSelectedRecipeId(null);
    setRouletteItems([]);
    setRouletteOffset(0);
    setShouldRestoreScroll(false);
    fetchRecipesPage(0, true);
  }, [fetchRecipesPage]);

  useEffect(() => {
    if (!hydratedFromCache) return;

    const cacheKey = buildCacheKey(color, sortBy, statusFilter, debouncedSearch);
    const pagesCache = readPagesCache();
    const cachedEntry = pagesCache[cacheKey];

    if (cachedEntry) {
      setRecipes(cachedEntry.recipes);
      setPage(cachedEntry.page);
      setHasMore(cachedEntry.hasMore);
      setTotal(cachedEntry.total);
      setCompletedCount(cachedEntry.completedCount);
      setMissingCount(cachedEntry.missingCount);
      setLoading(false);

      fetchRecipesPage(0, true, true);
      return;
    }

    setRecipes([]);
    setPage(0);
    setHasMore(true);
    setSelectedRecipeId(null);
    setRouletteItems([]);
    setRouletteOffset(0);
    setShouldRestoreScroll(false);
    fetchRecipesPage(0, true);
  }, [color, debouncedSearch, fetchRecipesPage, hydratedFromCache, sortBy, statusFilter]);

  useEffect(() => {
    if (!hydratedFromCache || typeof window === "undefined") return;

    try {
      window.sessionStorage.setItem(
        METH_UI_CACHE_KEY,
        JSON.stringify({
          color,
          sortBy,
          statusFilter,
          search,
          scrollY: window.scrollY,
        } satisfies MethUiCache)
      );
    } catch {}
  }, [color, hydratedFromCache, search, sortBy, statusFilter]);

  useEffect(() => {
    if (!hydratedFromCache || typeof window === "undefined") return;

    const cacheKey = buildCacheKey(color, sortBy, statusFilter, debouncedSearch);
    const pagesCache = readPagesCache();

    pagesCache[cacheKey] = {
      recipes,
      page,
      hasMore,
      total,
      completedCount,
      missingCount,
      savedAt: Date.now(),
    };

    writePagesCache(pagesCache);
  }, [
    color,
    completedCount,
    debouncedSearch,
    hasMore,
    hydratedFromCache,
    missingCount,
    page,
    recipes,
    sortBy,
    statusFilter,
    total,
  ]);

  useEffect(() => {
    if (!hydratedFromCache || typeof window === "undefined") return;

    const saveUiState = () => {
      try {
        window.sessionStorage.setItem(
          METH_UI_CACHE_KEY,
          JSON.stringify({
            color,
            sortBy,
            statusFilter,
            search,
            scrollY: window.scrollY,
          } satisfies MethUiCache)
        );
      } catch {}
    };

    window.addEventListener("scroll", saveUiState, { passive: true });
    window.addEventListener("beforeunload", saveUiState);

    return () => {
      saveUiState();
      window.removeEventListener("scroll", saveUiState);
      window.removeEventListener("beforeunload", saveUiState);
    };
  }, [color, hydratedFromCache, search, sortBy, statusFilter]);

  useEffect(() => {
    if (!shouldRestoreScroll || typeof window === "undefined") return;

    try {
      const rawUi = window.sessionStorage.getItem(METH_UI_CACHE_KEY);
      const ui = rawUi ? (JSON.parse(rawUi) as MethUiCache) : null;
      const scrollY = typeof ui?.scrollY === "number" ? ui.scrollY : 0;

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "auto" });
        setShouldRestoreScroll(false);
      });
    } catch {
      setShouldRestoreScroll(false);
    }
  }, [recipes.length, shouldRestoreScroll]);


  useEffect(() => {
    if (!hydratedFromCache) return;

    const channel = supabaseRef.current
      .channel(`meth-recipes-realtime:${color}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meth_recipes",
        },
        (payload) => {
          const newRow = payload.new as Partial<Recipe> | null;
          const oldRow = payload.old as Partial<Recipe> | null;
          const touchesCurrentColor =
            newRow?.fosfor_color === color || oldRow?.fosfor_color === color;

          if (!touchesCurrentColor) {
            return;
          }

          refreshCurrentView();
        }
      )
      .subscribe();

    return () => {
      supabaseRef.current.removeChannel(channel);
    };
  }, [color, hydratedFromCache, refreshCurrentView]);

  useEffect(() => {
    const markInteracted = () => setHasUserInteracted(true);

    window.addEventListener("wheel", markInteracted, { passive: true });
    window.addEventListener("touchmove", markInteracted, { passive: true });
    window.addEventListener("keydown", markInteracted);
    window.addEventListener("scroll", markInteracted, { passive: true });

    return () => {
      window.removeEventListener("wheel", markInteracted);
      window.removeEventListener("touchmove", markInteracted);
      window.removeEventListener("keydown", markInteracted);
      window.removeEventListener("scroll", markInteracted);
    };
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || !hasMore || loading || loadingMore || !hasUserInteracted) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];

        if (
          firstEntry?.isIntersecting &&
          hasMore &&
          !loadingMore &&
          !loading &&
          hasUserInteracted
        ) {
          fetchRecipesPage(page + 1);
        }
      },
      {
        rootMargin: "600px 0px",
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [fetchRecipesPage, hasMore, hasUserInteracted, loading, loadingMore, page]);

  const missingRecipesOnPage = useMemo(() => {
    return recipes.filter(
      (recipe) => recipe.renhed === null || recipe.stabiliseringstid === null
    );
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

      setCompletedCount((prev) => {
        const oldRecipe = recipes.find((recipe) => recipe.id === id);
        const wasCompleted =
          oldRecipe?.renhed !== null && oldRecipe?.stabiliseringstid !== null;
        const isCompletedNow =
          json.renhed !== null && json.stabiliseringstid !== null;

        if (wasCompleted === isCompletedNow) return prev;
        return isCompletedNow ? prev + 1 : Math.max(0, prev - 1);
      });

      setMissingCount((prev) => {
        const oldRecipe = recipes.find((recipe) => recipe.id === id);
        const wasMissing =
          oldRecipe?.renhed === null || oldRecipe?.stabiliseringstid === null;
        const isMissingNow =
          json.renhed === null || json.stabiliseringstid === null;

        if (wasMissing === isMissingNow) return prev;
        return isMissingNow ? prev + 1 : Math.max(0, prev - 1);
      });

      if (
        json.renhed !== null &&
        json.stabiliseringstid !== null &&
        selectedRecipeId === id &&
        statusFilter === "missing"
      ) {
        setSelectedRecipeId(null);
      }

      clearMethCache();
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

  async function pickRandomMissingRecipe() {
    if (isRolling) return;

    try {
      const params = new URLSearchParams({
        color,
        randomMissing: "true",
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(`/api/meth?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to pick a missing recipe");
      }

      const winner = json?.item as Recipe | null;

      if (!winner) {
        alert("No missing recipes left for this color.");
        return;
      }

      const pool = missingRecipesOnPage.length > 0 ? missingRecipesOnPage : [winner];
      const { built, winnerIndex } = buildRouletteList(pool, winner);

      const cardWidth = 208;
      const gapWidth = 12;
      const containerPadding = 12;
      const itemSpan = cardWidth + gapWidth;
      const viewportWidth = rouletteViewportRef.current?.clientWidth ?? 0;
      const centerOffset = viewportWidth > 0 ? viewportWidth / 2 - cardWidth / 2 : cardWidth;
      const finalOffset = Math.max(
        0,
        winnerIndex * itemSpan - centerOffset + containerPadding
      );

      setSelectedRecipeId(null);
      setIsRolling(false);
      setRouletteItems([]);
      setRouletteOffset(0);
      setRouletteKey((prev) => prev + 1);

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

        setRecipes((current) => {
          const alreadyLoaded = current.some((recipe) => recipe.id === winner.id);
          if (alreadyLoaded) {
            return current;
          }

          return [winner, ...current];
        });

        window.requestAnimationFrame(() => {
          setSelectedRecipeId(winner.id);

          window.requestAnimationFrame(() => {
            const row = rowRefs.current[winner.id];
            if (row) {
              row.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          });
        });
      }, 4300);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to pick a missing recipe");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Recipes</h2>
        <p className="text-gray-300 mt-2">
          Browse recipes 50 at a time for the selected fosfor color.
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
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none appearance-none"
            style={{ colorScheme: "dark" }}
          >
            <option value="default" className="bg-[#0b0f1a] text-white">Default</option>
            <option value="renhed-desc" className="bg-[#0b0f1a] text-white">Highest renhed</option>
            <option value="renhed-asc" className="bg-[#0b0f1a] text-white">Lowest renhed</option>
            <option value="stabiliseringstid-desc" className="bg-[#0b0f1a] text-white">Highest stabiliseringstid</option>
            <option value="stabiliseringstid-asc" className="bg-[#0b0f1a] text-white">Lowest stabiliseringstid</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Recipe status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none appearance-none"
            style={{ colorScheme: "dark" }}
          >
            <option value="all" className="bg-[#0b0f1a] text-white">All recipes</option>
            <option value="completed" className="bg-[#0b0f1a] text-white">Only completed recipes</option>
            <option value="missing" className="bg-[#0b0f1a] text-white">Only missing renhed/stabiliseringstid</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Search combo</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Example: 100-20-50"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
          Loaded: <span className="font-bold text-white">{recipes.length}</span>
          <span className="text-gray-400"> / {total}</span>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
          Completed: <span className="font-bold text-white">{completedCount}</span>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
          Missing: <span className="font-bold text-white">{missingCount}</span>
        </div>

        {isAdmin && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-400/20 px-4 py-3 text-sm text-amber-200">
            Admin mode: you can edit renhed and stabiliseringstid
          </div>
        )}

        {isSyncing && (
          <div className="rounded-xl bg-sky-500/10 border border-sky-400/20 px-4 py-3 text-sm text-sky-200">
            Live update received. Refreshing visible recipes…
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
            disabled={isRolling || missingCount === 0}
            className="px-5 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(90deg,#8b5cf6,#ec4899,#f59e0b)",
            }}
          >
            {isRolling ? "Rolling..." : "Pick random missing recipe"}
          </button>
        </div>

        <div
          ref={rouletteViewportRef}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#06111f] h-[118px]"
        >
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
            {(rouletteItems.length > 0 ? rouletteItems : missingRecipesOnPage.slice(0, 12)).map(
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

      {loading ? <RecipesTableSkeleton isAdmin={isAdmin} /> : null}
      {error ? <div className="text-red-300 mb-4">{error}</div> : null}

      {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm text-white">
              <thead className="border-b border-white/10 text-gray-300 bg-white/5">
                <tr>
                  <th className="px-4 py-4">Color</th>
                  <th className="px-4 py-4">Fosfor</th>
                  <th className="px-4 py-4">Pseudoephedrin</th>
                  <th className="px-4 py-4">Lithium</th>
                  <th className="px-4 py-4">Renhed</th>
                  <th className="px-4 py-4">Stabiliseringstid</th>
                  <th className="px-4 py-4">Status</th>
                  {isAdmin && <th className="px-4 py-4">Actions</th>}
                </tr>
              </thead>

              <tbody>
                {recipes.map((recipe) => {
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

                      <td className="px-4 py-4 font-semibold">{recipe.fosfor_amount}</td>
                      <td className="px-4 py-4 font-semibold">
                        {recipe.pseudoephedrin}
                      </td>
                      <td className="px-4 py-4 font-semibold">{recipe.lithium}</td>

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
                            step="0.1"
                            inputMode="decimal"
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

                {recipes.length === 0 && (
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

          {loadingMore ? (
            <div className="mt-4">
              <RecipesTableSkeleton isAdmin={isAdmin} rows={6} />
            </div>
          ) : null}

          <div ref={loadMoreRef} className="h-1" />

          {!hasMore && recipes.length > 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-gray-400">
              You’ve reached the end of the recipes for this filter.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
