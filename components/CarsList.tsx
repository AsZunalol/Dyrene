"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatPrice(price?: number | null) {
  if (typeof price !== "number") return null;
  return `$${price.toLocaleString()}`;
}

function prettyStatus(status?: string | null) {
  if (status === "vin-scratch") return "VIN-Scratch";
  if (status === "store") return "Store";
  return "Unknown";
}

type EditModalProps = {
  car: Car;
  onClose: () => void;
  onSaved: () => void;
};

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
  const [cars, setCars] = useState<Car[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingCar, setEditingCar] = useState<Car | null>(null);

  async function fetchCars() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cars");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch cars");
      }
      setCars(json);
    } catch (err: any) {
      console.error("Failed to fetch cars", err);
      setCars(null);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCars();

    const refresh = () => fetchCars();
    window.addEventListener("carAdded", refresh as EventListener);
    window.addEventListener("carUpdated", refresh as EventListener);
    window.addEventListener("carDeleted", refresh as EventListener);

    return () => {
      window.removeEventListener("carAdded", refresh as EventListener);
      window.removeEventListener("carUpdated", refresh as EventListener);
      window.removeEventListener("carDeleted", refresh as EventListener);
    };
  }, []);

  const filteredCars = useMemo(() => {
    if (!cars) return [];

    const query = search.trim().toLowerCase();

    return cars.filter((car) => {
      const matchesSearch =
        !query ||
        car.name.toLowerCase().includes(query) ||
        (car.brand ?? "").toLowerCase().includes(query);

      const matchesFilter =
        filter === "all" ? true : (car.status ?? "").toLowerCase() === filter;

      return matchesSearch && matchesFilter;
    });
  }, [cars, search, filter]);

  if (loading) return <div className="p-4 text-gray-300">Loading cars…</div>;
  if (error) return <div className="p-4 text-red-400">Error: {error}</div>;

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

      {!filteredCars.length ? (
        <div className="p-6 rounded-xl border border-white/10 bg-white/5 text-gray-400">
          No cars found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCars.map((car) => (
            <div
              key={car.id}
              className="overflow-hidden rounded-2xl border border-white/10 shadow-lg transition duration-300 hover:scale-[1.01]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                backdropFilter: "blur(10px)",
              }}
            >
              <div className="relative h-56 overflow-hidden">
                {car.image ? (
                  <img
                    src={car.image}
                    alt={car.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center text-gray-300">
                    No image
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/20" />

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
                    <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
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
                <h3 className="text-xl font-bold text-white">{car.name}</h3>

                <button
                  onClick={() => setEditingCar(car)}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
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
      )}

      {editingCar ? (
        <EditCarModal
          car={editingCar}
          onClose={() => setEditingCar(null)}
          onSaved={fetchCars}
        />
      ) : null}
    </div>
  );
}