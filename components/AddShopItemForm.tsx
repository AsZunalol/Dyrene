"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-blue-300/60 focus:bg-white/[0.09]";

export default function AddShopItemForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("weapon");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return alert("Enter item name");
    if (!price) return alert("Enter price");
    if (stock === "") return alert("Enter stock amount");

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
        stock: Math.max(0, Math.floor(Number(stock))),
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
    setStock("1");
    setImage("");
    setOpen(false);

    window.dispatchEvent(new CustomEvent("shopItemAdded"));
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="group rounded-2xl border border-blue-300/30 bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-400"
        >
          + Add shop item
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#071b31] text-white shadow-2xl">
            <div className="border-b border-white/10 bg-white/[0.04] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-200/70">
                    Admin panel
                  </p>
                  <h2 className="mt-1 text-2xl font-black">Add Shop Item</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Create a clean shop card with price, category, stock and image.
                  </p>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 px-3 py-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">
                  Item name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Navy pistol"
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={inputClass}
                  >
                    <option className="bg-[#071b31]" value="weapon">
                      Weapon
                    </option>
                    <option className="bg-[#071b31]" value="item">
                      Item
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">
                    Price
                  </label>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="250000"
                    type="number"
                    min="0"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">
                    Stock
                  </label>
                  <input
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="5"
                    type="number"
                    min="0"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">
                  Image URL
                </label>
                <input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="Optional image URL"
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-2xl border border-white/10 px-4 py-3 font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  disabled={loading}
                  className="w-full rounded-2xl bg-blue-500 px-4 py-3 font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
