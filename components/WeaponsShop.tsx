"use client";
import { useTranslation } from "@/components/LanguageProvider";

import PageHeader from "@/components/PageHeader";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type ShopItem = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number | null;
  image: string | null;
};

type CartItem = ShopItem & {
  quantity: number;
};

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-accent/60 focus:bg-white/[0.09]";



function getCategory(item: ShopItem) {
  return item.category?.trim() || "uncategorized";
}

function getStock(item: ShopItem) {
  return Math.max(0, Number(item.stock ?? 0));
}

export default function WeaponsShop({ isAdmin }: { isAdmin: boolean }) {
  const { t, locale } = useTranslation();

function formatPrice(price: number) {
  return `${price.toLocaleString(locale)} DKK`;
}

  const [items, setItems] = useState<ShopItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("weapon");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("0");
  const [editImage, setEditImage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const totalPrice = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const totalStock = items.reduce((total, item) => total + getStock(item), 0);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(items.map(getCategory))).sort();
    return ["all", ...uniqueCategories];
  }, [items]);

  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return items.filter((item) => {
      const category = getCategory(item);
      const matchesCategory =
        activeCategory === "all" || category === activeCategory;
      const matchesSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm) ||
        category.toLowerCase().includes(searchTerm);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, items, search]);

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

    const stock = getStock(item);
    if (stock <= 0) {
      setMessage(t("{name} is out of stock.", { name: item.name }));
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find((cartItem) => cartItem.id === item.id);

      if (existingItem) {
        if (existingItem.quantity >= stock) {
          setMessage(t("Only {count}x {name} in stock.", { count: stock, name: item.name }));
          return currentCart;
        }

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
    setEditStock(String(getStock(item)));
    setEditImage(item.image || "");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();

    if (!editingItem) return;
    if (!editName.trim()) return alert(t("Enter item name"));
    if (!editPrice) return alert(t("Enter price"));
    if (editStock === "") return alert(t("Enter stock amount"));

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
        stock: Math.max(0, Math.floor(Number(editStock))),
        image: editImage.trim() || null,
      }),
    });

    setSavingEdit(false);

    if (!res.ok) {
      const json = await res.json();
      alert(t(json?.error || "Failed to update item"));
      return;
    }

    setEditingItem(null);
    await loadItems();
  }

  async function confirmPurchase() {
    if (cart.length === 0) return;

    const cartText = cart
      .map((item) => `${item.quantity}x ${item.name} - ${formatPrice(item.price * item.quantity)}`)
      .join("\n");

    const confirmed = confirm(
      `${t("Confirm purchase?")}\n\n${cartText}\n\n${t("Total")}: ${formatPrice(totalPrice)}`
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
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        totalPrice,
      }),
    });

    setBuying(false);

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error || "Something went wrong.");
      return;
    }

    setCart([]);
    setMessage("Purchase sent to Discord and stock updated.");
    await loadItems();
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-lg shadow-black/20 backdrop-blur">
        <div className="border-b border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <PageHeader icon="shop" eyebrow={t("Marketplace")} title={t("Shop")} description="Browse supplies, check stock, and send an order to Discord." />

            <div className="grid grid-cols-3 gap-3 sm:min-w-[28rem]">
              <div className="rounded-xl border border-line bg-inset p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">{t("Items")}</p>
                <p className="mt-1 text-2xl font-semibold">{items.length}</p>
              </div>
              <div className="rounded-xl border border-accent/20 bg-accent-strong/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">{t("Stock")}</p>
                <p className="mt-1 text-2xl font-semibold">{totalStock}</p>
              </div>
              <div className="rounded-xl border border-accent/20 bg-accent-strong/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">{t("Cart")}</p>
                <p className="mt-1 text-2xl font-semibold">{cart.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
          <div>
            <div className="mb-6 rounded-xl border border-line bg-inset p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("Search the shop...")}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-accent/60"
                />

                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={t(category)}
                      onClick={() => setActiveCategory(category)}
                      className={`rounded-xl px-4 py-3 text-sm font-bold capitalize transition ${
                        activeCategory === category
                          ? "bg-accent-strong text-white shadow-lg shadow-accent/20"
                          : "border border-line bg-surface text-white/65 hover:bg-elevated hover:text-white"
                      }`}
                    >
                      {t(category)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {message && (
              <div className="mb-6 rounded-xl border border-accent/20 bg-accent-strong/10 p-4 text-sm font-semibold text-accent">
                {t(message)}
              </div>
            )}

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center text-white/55">{t("No shop items yet.")}</div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center text-white/55">{t("No items match your search.")}</div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const stock = getStock(item);
                  const outOfStock = stock <= 0;
                  const cartQuantity = cart.find((cartItem) => cartItem.id === item.id)?.quantity || 0;
                  const reachedCartLimit = cartQuantity >= stock;

                  return (
                    <article
                      key={item.id}
                      className={`group overflow-hidden rounded-xl border shadow-xl shadow-black/10 transition ${
                        outOfStock
                          ? "border-line bg-surface opacity-50 grayscale"
                          : "border-line bg-surface hover:-translate-y-1 hover:border-accent/35 hover:bg-surface"
                      }`}
                    >
                      <div className="relative h-48 overflow-hidden bg-inset">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent/20 to-accent/10 text-5xl">
                            🛒
                          </div>
                        )}

                        <div className="absolute left-4 top-4 rounded-full border border-line bg-black/45 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur capitalize">
                          {t(getCategory(item))}
                        </div>

                        <div
                          className={`absolute right-4 top-4 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] backdrop-blur ${
                            outOfStock
                              ? "border-red-300/20 bg-red-500/20 text-red-100"
                              : "border-accent/20 bg-accent-strong/20 text-accent"
                          }`}
                        >
                          {outOfStock ? t("Out of stock") : t("{count} in stock", { count: stock })}
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-semibold tracking-tight text-white">
                              {item.name}
                            </h2>
                            <p className="mt-1 text-sm text-white/45">
                              {outOfStock ? t("Currently unavailable") : t("Ready for order")}
                            </p>
                          </div>

                          <p className="rounded-xl border border-accent/20 bg-accent-strong/10 px-3 py-2 text-right text-sm font-semibold text-accent">
                            {formatPrice(item.price)}
                          </p>
                        </div>

                        <div className="mt-5 flex gap-3">
                          <button
                            onClick={() => addToCart(item)}
                            disabled={outOfStock || reachedCartLimit}
                            className="w-full rounded-xl bg-accent-strong px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-elevated disabled:text-white/35 disabled:shadow-none"
                          >
                            {outOfStock
                              ? t("Out of stock")
                              : reachedCartLimit
                                ? t("Max in cart")
                                : t("Add to list")}
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => openEdit(item)}
                              className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-elevated hover:text-white"
                            >{t("Edit")}</button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="h-fit rounded-xl border border-line bg-inset p-5 shadow-lg shadow-black/20 lg:sticky lg:top-28">
            <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent/60">{t("Order list")}</p>
                <h2 className="mt-1 text-2xl font-semibold">{t("Cart")}</h2>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-white/60 transition hover:bg-elevated hover:text-white"
                >{t("Clear")}</button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-white/45">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-surface text-2xl">
                  🛍️
                </div>{t("Add items to create a purchase request.")}</div>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-white">
                          {item.quantity}x {item.name}
                        </p>
                        <p className="text-sm text-white/45">
                          {formatPrice(item.price * item.quantity)} · {Math.max(0, getStock(item) - item.quantity)} {t("left after order")}</p>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm font-bold text-white/65 transition hover:bg-elevated hover:text-white"
                      >
                        -
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-line pt-5">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <span className="text-white/55">{t("Total")}</span>
                    <span className="text-2xl font-semibold text-white">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>

                  <button
                    onClick={confirmPurchase}
                    disabled={buying}
                    className="w-full rounded-xl bg-accent-strong px-5 py-4 font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {buying ? t("Sending...") : t("Confirm purchase")}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      </section>

      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-[var(--surface)] text-white shadow-lg">
            <div className="border-b border-line bg-surface px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent/70">{t("Admin panel")}</p>
                  <h2 className="mt-1 text-2xl font-semibold">{t("Edit Shop Item")}</h2>
                </div>

                <button
                  onClick={() => setEditingItem(null)}
                  className="rounded-xl border border-line px-3 py-2 text-white/70 transition hover:bg-elevated hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={saveEdit} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">{t("Item name")}</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("Item name")}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">{t("Category")}</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className={inputClass}
                  >
                    <option className="bg-[var(--surface)]" value="weapon">{t("Weapon")}</option>
                    <option className="bg-[var(--surface)]" value="item">{t("Item")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">{t("Price")}</label>
                  <input
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder={t("Price")}
                    type="number"
                    min="0"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/70">{t("Stock")}</label>
                  <input
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    placeholder={t("Stock")}
                    type="number"
                    min="0"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">{t("Image URL")}</label>
                <input
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  placeholder={t("Image URL optional")}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="w-full rounded-xl border border-line px-4 py-3 font-bold text-white/80 transition hover:bg-elevated hover:text-white"
                >{t("Cancel")}</button>

                <button
                  disabled={savingEdit}
                  className="w-full rounded-xl bg-accent-strong px-4 py-3 font-bold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEdit ? t("Saving...") : t("Save changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
