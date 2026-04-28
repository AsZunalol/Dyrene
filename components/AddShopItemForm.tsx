"use client";

import { useState } from "react";

export default function AddShopItemForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("weapon");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return alert("Enter item name");
    if (!price) return alert("Enter price");

    setLoading(true);

    const res = await fetch("/api/shop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        category,
        price: Number(price),
        image: image.trim() || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json();
      alert(json?.error || "Failed to add item");
      return;
    }

    setName("");
    setCategory("weapon");
    setPrice("");
    setImage("");

    window.dispatchEvent(new CustomEvent("shopItemAdded"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
      <h2 className="text-2xl font-bold">Add Shop Item</h2>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name"
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
      >
        <option value="weapon">Weapon</option>
        <option value="item">Item</option>
      </select>

      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Price"
        type="number"
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
      />

      <input
        value={image}
        onChange={(e) => setImage(e.target.value)}
        placeholder="Image URL"
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
      />

      <button
        disabled={loading}
        className="px-5 py-3 rounded-xl bg-blue-500 font-semibold disabled:opacity-50"
      >
        {loading ? "Adding..." : "Add Item"}
      </button>
    </form>
  );
}