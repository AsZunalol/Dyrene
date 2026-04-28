"use client";

import { useState } from "react";

const weapons = [
  {
    name: "Pistol",
    price: 25000,
  },
  {
    name: "SMG",
    price: 75000,
  },
  {
    name: "AK-47",
    price: 150000,
  },
];

export default function WeaponsShop() {
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function buyWeapon(weapon: { name: string; price: number }) {
    const confirmed = confirm(
      `Confirm purchase?\n\nWeapon: ${weapon.name}\nPrice: $${weapon.price.toLocaleString()}`
    );

    if (!confirmed) return;

    setBuying(weapon.name);
    setMessage("");

    const res = await fetch("/api/weapon-purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        weaponName: weapon.name,
        price: weapon.price,
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
    <div className="relative min-h-screen bg-[#07203a] text-white px-6 pt-32 pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl border border-white/10 p-8 mb-8 bg-white/5">
          <p className="text-sm uppercase tracking-[0.3em] text-white/70">
  Dyrene Shop
</p>
          <h1 className="text-4xl font-bold mt-2">Shop</h1>
          <p className="text-gray-300 mt-2">
            Buy weapons with in-game money. Purchases are sent to Discord.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/10 p-4">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {weapons.map((weapon) => (
            <div
              key={weapon.name}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg"
            >
              <h2 className="text-2xl font-bold">{weapon.name}</h2>
              <p className="text-gray-300 mt-2">
                Price: ${weapon.price.toLocaleString()}
              </p>

              <button
                onClick={() => buyWeapon(weapon)}
                disabled={buying === weapon.name}
                className="mt-6 w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
              >
                {buying === weapon.name ? "Sending..." : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}