"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Car = {
  id: string;
  name: string;
  brand?: string | null;
  price?: number | null;
  image?: string | null;
  status?: string | null;
  featured?: boolean | null;
  created_at?: string;
};

type Filter = "all" | "store" | "vin-scratch";

type CarsCacheEntry = {
  cars: Car[];
  page: number;
  hasMore: boolean;
  savedAt: number;
};

type CarsUiCache = {
  search: string;
  filter: Filter;
  scrollY: number;
};

const PAGE_SIZE = 6;
const CACHE_TTL_MS = 1000 * 60 * 10;
const CARS_CACHE_KEY = "dyrene-cars-pages-cache";
const CARS_UI_CACHE_KEY = "dyrene-cars-ui-cache";

function formatPrice(price?: number | null) {
  if (typeof price !== "number") return null;
  return `$${price.toLocaleString()}`;
}

function prettyStatus(status?: string | null) {
  if (status === "vin-scratch") return "VIN-Scratch";
  if (status === "store") return "Store";
  return "Unknown";
}

function buildCacheKey(filter: Filter, search: string) {
  return `${filter}::${search.trim().toLowerCase()}`;
}

function readPagesCache() {
  if (typeof window === "undefined") return {} as Record<string, CarsCacheEntry>;

  try {
    const raw = window.sessionStorage.getItem(CARS_CACHE_KEY);
    if (!raw) return {} as Record<string, CarsCacheEntry>;

    const parsed = JSON.parse(raw) as Record<string, CarsCacheEntry>;
    const now = Date.now();

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        return (
          value &&
          Array.isArray(value.cars) &&
          typeof value.page === "number" &&
          typeof value.hasMore === "boolean" &&
          typeof value.savedAt === "number" &&
          now - value.savedAt < CACHE_TTL_MS
        );
      })
    );
  } catch {
    return {} as Record<string, CarsCacheEntry>;
  }
}

function writePagesCache(cache: Record<string, CarsCacheEntry>) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(CARS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function clearCarsCache() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(CARS_CACHE_KEY);
    window.sessionStorage.removeItem(CARS_UI_CACHE_KEY);
  } catch {}
}

type EditModalProps = {
  car: Car;
  onClose: () => void;
  onSaved: () => void;
};

function CarCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 shadow-lg animate-pulse"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="relative h-56 overflow-hidden bg-white/[0.08]">
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <div className="h-7 w-20 rounded-full bg-white/10" />
          <div className="h-7 w-24 rounded-full bg-white/10" />
        </div>

        <div className="absolute top-3 right-3 h-7 w-24 rounded-full bg-white/10" />
        <div className="absolute bottom-3 left-3 h-7 w-24 rounded-full bg-white/10" />
      </div>

      <div className="p-5 flex items-center justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-6 w-40 max-w-full rounded-lg bg-white/10" />
          <div className="h-4 w-24 rounded-lg bg-white/10" />
        </div>

        <div className="h-10 w-20 rounded-xl bg-white/10 shrink-0" />
      </div>
    </div>
  );
}

function CarsGridSkeleton({ count = PAGE_SIZE }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <CarCardSkeleton key={index} />
      ))}
    </div>
  );
}

function CarImage({ src, alt }: { src?: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-white/5 flex items-center justify-center text-gray-300">
        No image
      </div>
    );
  }

  return (
    <>
      <div
        className={`absolute inset-0 bg-white/5 transition-opacity duration-500 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
          loaded ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"
        }`}
      />
    </>
  );
}

function EditCarModal({ car, onClose, onSaved }: EditModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(car.name || "");
  const [brand, setBrand] = useState(car.brand || "");
  const [price, setPrice] = useState(
    typeof car.price === "number" ? String(car.price) : ""
  );
  const [image, setImage] = useState(car.image || "");
  const [status, setStatus] = useState(car.status || "store");
  const [featured, setFeatured] = useState(Boolean(car.featured));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/cars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: car.id,
          name: name.trim(),
          brand: brand.trim() || null,
          price: price ? Number(price) : null,
          image: image.trim() || null,
          status,
          featured,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert("Failed to update car: " + (json?.error || "unknown"));
        return;
      }

      window.dispatchEvent(new CustomEvent("carUpdated", { detail: { car: json } }));
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Network error updating car");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(`Delete ${car.name}?`);
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/cars", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: car.id }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert("Failed to delete car: " + (json?.error || "unknown"));
        return;
      }

      window.dispatchEvent(new CustomEvent("carDeleted", { detail: { id: car.id } }));
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Network error deleting car");
    } finally {
      setDeleting(false);
    }
  }

  const modal = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,20,25,0.96), rgba(15,15,20,0.94))",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Car</h2>
            <p className="text-sm text-gray-400">Update or delete this listing</p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Car name"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none focus:border-white/20"
              required
            />
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none focus:border-white/20"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              type="number"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none focus:border-white/20"
            />
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="Image URL"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none focus:border-white/20 md:col-span-2"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-white/20"
            >
              <option value="store">store</option>
              <option value="vin-scratch">vin-scratch</option>
            </select>

            <label className="inline-flex items-center gap-2 text-sm text-gray-200">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4"
              />
              Featured
            </label>

            <div className="md:ml-auto flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
                style={{
                  background: "linear-gradient(90deg,#dc2626,#ef4444)",
                }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>

              <button
                type="submit"
                disabled={saving || deleting}
                className="px-5 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
                style={{
                  background: "linear-gradient(90deg,#5865F2,#6772E5)",
                }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

export default function CarsList() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const carsLengthRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawUi = window.sessionStorage.getItem(CARS_UI_CACHE_KEY);
      const ui = rawUi ? (JSON.parse(rawUi) as CarsUiCache) : null;

      if (ui?.search) {
        setSearch(ui.search);
        setDebouncedSearch(ui.search.trim());
      }

      if (ui?.filter === "all" || ui?.filter === "store" || ui?.filter === "vin-scratch") {
        setFilter(ui.filter);
      }

      const cacheKey = buildCacheKey(ui?.filter ?? "all", ui?.search ?? "");
      const pagesCache = readPagesCache();
      const entry = pagesCache[cacheKey];

      if (entry) {
        setCars(entry.cars);
        setPage(entry.page);
        setHasMore(entry.hasMore);
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

  useEffect(() => {
    carsLengthRef.current = cars.length;
  }, [cars.length]);

  const buildCarsUrl = useCallback(
    (pageNumber: number) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageNumber * PAGE_SIZE),
      });

      if (filter !== "all") {
        params.set("status", filter);
      }

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      return `/api/cars?${params.toString()}`;
    },
    [debouncedSearch, filter]
  );

const fetchCarsPage = useCallback(
  async (pageNumber: number, replace = false) => {
    const isInitialLoad = replace && pageNumber === 0 && carsLengthRef.current === 0;

    if (replace) {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
    } else {
      setLoadingMore(true);
    }

    setError(null);

    try {
      const res = await fetch(buildCarsUrl(pageNumber));
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch cars");
      }

      const nextCars = Array.isArray(json) ? json : [];

      setCars((current) => (replace ? nextCars : [...current, ...nextCars]));
      setPage(pageNumber);
      setHasMore(nextCars.length === PAGE_SIZE);
    } catch (err: any) {
      console.error("Failed to fetch cars", err);
      if (replace) {
        setCars([]);
      }
      setError(String(err?.message ?? err));
    } finally {
      if (replace) {
        setLoading(false);
        setIsRefreshing(false);
      } else {
        setLoadingMore(false);
      }
    }
  },
  [buildCarsUrl]
);

  const resetAndFetch = useCallback(() => {
    clearCarsCache();
    setCars([]);
    setPage(0);
    setHasMore(true);
    setShouldRestoreScroll(false);
    fetchCarsPage(0, true);
  }, [fetchCarsPage]);

useEffect(() => {
  if (!hydratedFromCache) return;

  const cacheKey = buildCacheKey(filter, debouncedSearch);
  const pagesCache = readPagesCache();
  const cachedEntry = pagesCache[cacheKey];

  if (cachedEntry) {
    setCars(cachedEntry.cars);
    setPage(cachedEntry.page);
    setHasMore(cachedEntry.hasMore);
    setLoading(false);
    return;
  }

  setPage(0);
  setHasMore(true);
  setShouldRestoreScroll(false);
  fetchCarsPage(0, true);
}, [debouncedSearch, fetchCarsPage, filter, hydratedFromCache]);

  useEffect(() => {
    if (!hydratedFromCache || typeof window === "undefined") return;

    try {
      window.sessionStorage.setItem(
        CARS_UI_CACHE_KEY,
        JSON.stringify({
          search,
          filter,
          scrollY: window.scrollY,
        } satisfies CarsUiCache)
      );
    } catch {}
  }, [filter, hydratedFromCache, search]);

  useEffect(() => {
    if (!hydratedFromCache || typeof window === "undefined") return;

    const cacheKey = buildCacheKey(filter, debouncedSearch);
    const pagesCache = readPagesCache();

    pagesCache[cacheKey] = {
      cars,
      page,
      hasMore,
      savedAt: Date.now(),
    };

    writePagesCache(pagesCache);
  }, [cars, debouncedSearch, filter, hasMore, hydratedFromCache, page]);

  useEffect(() => {
    if (!hydratedFromCache || typeof window === "undefined") return;

    const saveUiState = () => {
      try {
        window.sessionStorage.setItem(
          CARS_UI_CACHE_KEY,
          JSON.stringify({
            search,
            filter,
            scrollY: window.scrollY,
          } satisfies CarsUiCache)
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
  }, [filter, hydratedFromCache, search]);

  useEffect(() => {
    if (!shouldRestoreScroll || typeof window === "undefined") return;

    try {
      const rawUi = window.sessionStorage.getItem(CARS_UI_CACHE_KEY);
      const ui = rawUi ? (JSON.parse(rawUi) as CarsUiCache) : null;
      const scrollY = typeof ui?.scrollY === "number" ? ui.scrollY : 0;

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "auto" });
        setShouldRestoreScroll(false);
      });
    } catch {
      setShouldRestoreScroll(false);
    }
  }, [cars.length, shouldRestoreScroll]);

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
    const refresh = () => resetAndFetch();
    window.addEventListener("carAdded", refresh as EventListener);
    window.addEventListener("carUpdated", refresh as EventListener);
    window.addEventListener("carDeleted", refresh as EventListener);

    return () => {
      window.removeEventListener("carAdded", refresh as EventListener);
      window.removeEventListener("carUpdated", refresh as EventListener);
      window.removeEventListener("carDeleted", refresh as EventListener);
    };
  }, [resetAndFetch]);

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
          fetchCarsPage(page + 1);
        }
      },
      {
        rootMargin: "300px 0px",
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [fetchCarsPage, hasMore, hasUserInteracted, loading, loadingMore, page]);

  const resultText = useMemo(() => {
    if (!cars.length) return "No cars loaded yet";
    return `${cars.length} car${cars.length === 1 ? "" : "s"} loaded`;
  }, [cars]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between">
          <p>Loading cars…</p>
          <p>Showing highest price first</p>
        </div>
        <CarsGridSkeleton />
      </div>
    );
  }

  if (error && !cars.length) return <div className="p-4 text-red-400">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or brand..."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400 outline-none focus:border-white/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === "all"
                ? "text-white"
                : "text-gray-300 bg-white/5 border border-white/10"
            }`}
            style={
              filter === "all"
                ? { background: "linear-gradient(90deg,#5865F2,#6772E5)" }
                : undefined
            }
          >
            All
          </button>

          <button
            onClick={() => setFilter("store")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === "store"
                ? "text-white"
                : "text-gray-300 bg-white/5 border border-white/10"
            }`}
            style={
              filter === "store"
                ? { background: "linear-gradient(90deg,#5865F2,#6772E5)" }
                : undefined
            }
          >
            Store
          </button>

          <button
            onClick={() => setFilter("vin-scratch")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === "vin-scratch"
                ? "text-white"
                : "text-gray-300 bg-white/5 border border-white/10"
            }`}
            style={
              filter === "vin-scratch"
                ? { background: "linear-gradient(90deg,#5865F2,#6772E5)" }
                : undefined
            }
          >
            VIN-Scratch
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between">
        <p>{isRefreshing ? "Updating results…" : resultText}</p>
        <p>Showing highest price first</p>
      </div>

      {!cars.length ? (
        <div className="p-6 rounded-xl border border-white/10 bg-white/5 text-gray-400">
          No cars found.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cars.map((car) => (
              <div
                key={car.id}
                className="group overflow-hidden rounded-2xl border border-white/10 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-white/20"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div className="relative h-56 overflow-hidden bg-black/20">
                  <CarImage src={car.image} alt={car.name} />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 transition-opacity duration-300 group-hover:from-black/85" />
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_45%)]" />

                  <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                    {car.brand ? (
                      <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                        {car.brand}
                      </span>
                    ) : null}

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold text-white backdrop-blur-md ${
                        car.status === "vin-scratch"
                          ? "border-red-400/30 bg-red-500/20"
                          : "border-sky-400/30 bg-sky-500/20"
                      }`}
                    >
                      {prettyStatus(car.status)}
                    </span>
                  </div>

                  {typeof car.price === "number" ? (
                    <div className="absolute top-3 right-3">
                      <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md shadow-lg shadow-black/20">
                        {formatPrice(car.price)}
                      </span>
                    </div>
                  ) : null}

                  {car.featured ? (
                    <div className="absolute bottom-3 left-3">
                      <span className="rounded-full border border-yellow-400/30 bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                        Featured
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="p-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-bold text-white">{car.name}</h3>
                    <p className="mt-1 text-sm text-gray-400">{prettyStatus(car.status)}</p>
                  </div>

                  <button
                    onClick={() => setEditingCar(car)}
                    className="shrink-0 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-transform duration-200 hover:scale-105"
                    style={{
                      background: "linear-gradient(90deg,#5865F2,#6772E5)",
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>

          {loadingMore ? <CarsGridSkeleton /> : null}
        </>
      )}

      {error ? <div className="text-sm text-red-400">Error: {error}</div> : null}

      <div ref={loadMoreRef} className="h-1" />

      {!hasMore && cars.length ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-gray-400">
          You’ve reached the end of the garage.
        </div>
      ) : null}

      {editingCar ? (
        <EditCarModal
          car={editingCar}
          onClose={() => setEditingCar(null)}
          onSaved={resetAndFetch}
        />
      ) : null}
    </div>
  );
}
