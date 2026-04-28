"use client";

import { useState } from "react";

export default function AddShopItemForm() {
  const [open, setOpen] = useState(false);
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
    setOpen(false);

    window.dispatchEvent(new CustomEvent("shopItemAdded"));
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-400"
        >
          Add Item
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#07203a] p-6 text-white shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Add Shop Item</h2>

              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              />

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              >
                <option value="weapon">Weapon</option>
                <option value="item">Item</option>
              </select>

              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price"
                type="number"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              />

              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="Image URL optional"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-xl border border-white/10 px-4 py-3 font-semibold hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}