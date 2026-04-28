import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const weaponName = String(body.weaponName || "").trim();
    const price = Number(body.price || 0);

    if (!weaponName || !price) {
      return NextResponse.json(
        { error: "Missing weapon or price" },
        { status: 400 }
      );
    }

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
                inline: true,
              },
              {
                name: "Item",
                value: weaponName,
                inline: true,
              },
              {
                name: "Price",
                value: `${price.toLocaleString("da-DK")} DKK`,
                inline: true,
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