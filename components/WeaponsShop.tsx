"use client";

import { useEffect, useState } from "react";

type ShopItem = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image: string | null;
};

type CartItem = ShopItem & {
  quantity: number;
};

export default function WeaponsShop({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState("");

  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("weapon");
  const [editPrice, setEditPrice] = useState("");
  const [editImage, setEditImage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const totalPrice = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

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

  function addToCart(item: ShopItem) {
    setMessage("");

    setCart((currentCart) => {
      const existingItem = currentCart.find((cartItem) => cartItem.id === item.id);

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }

      return [...currentCart, { ...item, quantity: 1 }];
    });
  }

  function removeFromCart(itemId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
  }

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

  async function confirmPurchase() {
    if (cart.length === 0) return;

    const cartText = cart
      .map(
        (item) =>
          `${item.quantity}x ${item.name} - ${(item.price * item.quantity).toLocaleString("da-DK")} DKK`
      )
      .join("\n");

    const confirmed = confirm(
      `Confirm purchase?\n\n${cartText}\n\nTotal: ${totalPrice.toLocaleString("da-DK")} DKK`
    );

    if (!confirmed) return;

    setBuying(true);
    setMessage("");

    const res = await fetch("/api/weapon-purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: cart.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        totalPrice,
      }),
    });

    setBuying(false);

    if (!res.ok) {
      setMessage("Something went wrong.");
      return;
    }

    setCart([]);
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
          Add items to your shopping list, then confirm once.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/10 p-4">
          {message}
        </div>
      )}

      {cart.length > 0 && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-bold mb-4">Shopping List</h2>

          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-xl bg-white/5 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {item.quantity}x {item.name}
                  </p>
                  <p className="text-sm text-gray-300">
                    {(item.price * item.quantity).toLocaleString("da-DK")} DKK
                  </p>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 md:flex-row md:items-center md:justify-between">
            <p className="text-xl font-bold">
              Total: {totalPrice.toLocaleString("da-DK")} DKK
            </p>

            <div className="flex gap-3">
              <button
                onClick={clearCart}
                className="rounded-xl border border-white/10 px-4 py-3 font-semibold hover:bg-white/10"
              >
                Clear
              </button>

              <button
                onClick={confirmPurchase}
                disabled={buying}
                className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
              >
                {buying ? "Sending..." : "Confirm Purchase"}
              </button>
            </div>
          </div>
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
                  onClick={() => addToCart(item)}
                  className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-400"
                >
                  Add to List
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