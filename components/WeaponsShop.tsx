"use client";

import { useEffect, useState } from "react";

type ShopItem = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image: string | null;
};

export default function WeaponsShop() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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

  async function buyItem(item: ShopItem) {
    const confirmed = confirm(
      `Confirm purchase?\n\nItem: ${item.name}\nPrice: $${item.price.toLocaleString()}`
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
                Price: ${item.price.toLocaleString()}
              </p>

              <button
                onClick={() => buyItem(item)}
                disabled={buying === item.id}
                className="mt-6 w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
              >
                {buying === item.id ? "Sending..." : "Buy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}