"use client";

import { useState } from "react";

type AddCarFormProps = {
  onSuccess?: () => void;
};

export default function AddCarForm({ onSuccess }: AddCarFormProps) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [status, setStatus] = useState("store");
  const [featured, setFeatured] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return alert("Enter a car name");

    setLoading(true);
    try {
      const res = await fetch("/api/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        console.error("Add car failed", json);
        alert("Failed to add car: " + (json?.error || "unknown"));
        return;
      }

      window.dispatchEvent(new CustomEvent("carAdded", { detail: { car: json } }));

      setName("");
      setBrand("");
      setPrice("");
      setImage("");
      setStatus("store");
      setFeatured(false);

      onSuccess?.();
    } catch (err) {
      console.error("Network error adding car", err);
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={loading}
          className="md:ml-auto px-5 py-3 rounded-xl text-white font-semibold disabled:opacity-60 transition hover:scale-[1.02]"
          style={{
            background: "linear-gradient(90deg,#5865F2,#6772E5)",
          }}
        >
          {loading ? "Adding…" : "Add car"}
        </button>
      </div>
    </form>
  );
}