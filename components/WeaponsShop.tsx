"use client";

import { useEffect, useState } from "react";

type ShopItem = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image: string | null;
};

export default function WeaponsShop({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("weapon");
  const [editPrice, setEditPrice] = useState("");
  const [editImage, setEditImage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadItems() {
    const res = await fetch("/api/shop");
    const data = await res.json();
    setItems(data);
  }

  useEffect(() => {
    loadItems();

    function reloadItems() {
      loadItems();
    }

    window.addEventListener("shopItemAdded", reloadItems);
    return () => window.removeEventListener("shopItemAdded", reloadItems);
  }, []);

  function openEdit(item: ShopItem) {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category || "weapon");
    setEditPrice(String(item.price));
    setEditImage(item.image || "");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();

    if (!editingItem) return;
    if (!editName.trim()) return alert("Enter item name");
    if (!editPrice) return alert("Enter price");

    setSavingEdit(true);

    const res = await fetch("/api/shop", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: editingItem.id,
        name: editName.trim(),
        category: editCategory,
        price: Number(editPrice),
        image: editImage.trim() || null,
      }),
    });

    setSavingEdit(false);

    if (!res.ok) {
      const json = await res.json();
      alert(json?.error || "Failed to update item");
      return;
    }

    setEditingItem(null);
    await loadItems();
  }

  async function buyItem(item: ShopItem) {
    const confirmed = confirm(
      `Confirm purchase?\n\nItem: ${item.name}\nPrice: ${item.price.toLocaleString("da-DK")} DKK`
    );

    if (!confirmed) return;

    setBuying(item.id);
    setMessage("");

    const res = await fetch("/api/weapon-purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        weaponName: item.name,
        price: item.price,
      }),
    });

    setBuying(null);

    if (!res.ok) {
      setMessage("Something went wrong.");
      return;
    }

    setMessage("Purchase sent to Discord.");
  }

  return (
    <>
      <div className="rounded-2xl border border-white/10 p-8 mb-8 bg-white/5">
        <p className="text-sm uppercase tracking-[0.3em] text-white/70">
          Dyrene Shop
        </p>
        <h1 className="text-4xl font-bold mt-2">Shop</h1>
        <p className="text-gray-300 mt-2">
          Buy items with in-game money. Purchases are sent to Discord.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/10 p-4">
          {message}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-300">
          No shop items yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="mb-4 h-40 w-full rounded-xl object-cover"
                />
              )}

              <h2 className="text-2xl font-bold">{item.name}</h2>

              {item.category && (
                <p className="text-gray-400 mt-1 capitalize">
                  {item.category}
                </p>
              )}

              <p className="text-gray-300 mt-2">
                Price: {item.price.toLocaleString("da-DK")} DKK
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => buyItem(item)}
                  disabled={buying === item.id}
                  className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
                >
                  {buying === item.id ? "Sending..." : "Buy"}
                </button>

                {isAdmin && (
                  <button
                    onClick={() => openEdit(item)}
                    className="rounded-xl border border-white/10 px-4 py-3 font-semibold hover:bg-white/10"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#07203a] p-6 text-white shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Edit Shop Item</h2>

              <button
                onClick={() => setEditingItem(null)}
                className="rounded-lg px-3 py-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Item name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              />

              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              >
                <option value="weapon">Weapon</option>
                <option value="item">Item</option>
              </select>

              <input
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="Price"
                type="number"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              />

              <input
                value={editImage}
                onChange={(e) => setEditImage(e.target.value)}
                placeholder="Image URL optional"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="w-full rounded-xl border border-white/10 px-4 py-3 font-semibold hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  disabled={savingEdit}
                  className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}