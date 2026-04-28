import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PurchaseItem = {
  name: string;
  price: number;
  quantity: number;
};

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
          name: String(item.name || "").trim(),
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
        }))
      : [];

    const validItems = items.filter(
      (item) => item.name && item.price > 0 && item.quantity > 0
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "Missing purchase items" },
        { status: 400 }
      );
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

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}