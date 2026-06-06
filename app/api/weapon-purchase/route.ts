import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PurchaseItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type ShopItemRow = {
  id: string;
  name: string;
  price: number;
  stock: number | null;
};

function normalizeQuantity(value: unknown) {
  const quantity = Number(value || 1);
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.floor(quantity));
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();

    const items: PurchaseItem[] = Array.isArray(body.items)
      ? body.items.map((item: PurchaseItem) => ({
          id: String(item.id || "").trim(),
          name: String(item.name || "").trim(),
          price: Number(item.price || 0),
          quantity: normalizeQuantity(item.quantity),
        }))
      : [];

    const validItems = items.filter(
      (item) => item.id && item.name && item.price > 0 && item.quantity > 0
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "Missing purchase items" },
        { status: 400 }
      );
    }

    const ids = validItems.map((item) => item.id);

    const { data: shopItems, error: shopError } = await supabase
      .from("shop_items")
      .select("id, name, price, stock")
      .in("id", ids);

    if (shopError) {
      return NextResponse.json({ error: shopError.message }, { status: 500 });
    }

    const shopItemMap = new Map(
      ((shopItems ?? []) as ShopItemRow[]).map((item) => [item.id, item])
    );

    for (const item of validItems) {
      const shopItem = shopItemMap.get(item.id);

      if (!shopItem) {
        return NextResponse.json(
          { error: `${item.name} is no longer available.` },
          { status: 400 }
        );
      }

      const stock = Math.max(0, Number(shopItem.stock ?? 0));

      if (stock <= 0) {
        return NextResponse.json(
          { error: `${shopItem.name} is out of stock.` },
          { status: 400 }
        );
      }

      if (item.quantity > stock) {
        return NextResponse.json(
          { error: `Only ${stock}x ${shopItem.name} in stock.` },
          { status: 400 }
        );
      }
    }

    const totalPrice = validItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    const webhookUrl = process.env.DISCORD_WEAPON_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Missing Discord webhook" },
        { status: 500 }
      );
    }

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      user.id;

    const itemList = validItems
      .map(
        (item) =>
          `${item.quantity}x ${item.name} - ${(item.price * item.quantity).toLocaleString("da-DK")} DKK`
      )
      .join("\n");

    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [
          {
            title: "🛒 Shop Purchase",
            color: 3447003,
            fields: [
              {
                name: "Member",
                value: String(displayName),
                inline: false,
              },
              {
                name: "Items",
                value: itemList,
                inline: false,
              },
              {
                name: "Total",
                value: `${totalPrice.toLocaleString("da-DK")} DKK`,
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    for (const item of validItems) {
      const shopItem = shopItemMap.get(item.id);
      const currentStock = Math.max(0, Number(shopItem?.stock ?? 0));

      const { error: stockError } = await supabase
        .from("shop_items")
        .update({ stock: Math.max(0, currentStock - item.quantity) })
        .eq("id", item.id);

      if (stockError) {
        return NextResponse.json({ error: stockError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
