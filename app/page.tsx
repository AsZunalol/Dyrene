import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

type ActivityItem = {
  id: string;
  source: "Cars" | "Meth" | "Gangs" | "Trojan" | "Shop" | "Crafting";
  title: string;
  description: string;
  href: string;
  image?: string | null;
  emoji: string;
  badge: string;
  date: string;
  action: "Added" | "Updated";
};

function isValidDate(value?: string | null) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return formatDate(value);
}

function sourceStyles(source: ActivityItem["source"]) {
  switch (source) {
    case "Trojan":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
    case "Cars":
      return "border-blue-400/30 bg-blue-500/15 text-blue-200";
    case "Meth":
      return "border-purple-400/30 bg-purple-500/15 text-purple-200";
    case "Gangs":
      return "border-red-400/30 bg-red-500/15 text-red-200";
    case "Shop":
      return "border-yellow-400/30 bg-yellow-500/15 text-yellow-100";
    case "Crafting":
      return "border-cyan-400/30 bg-cyan-500/15 text-cyan-100";
    default:
      return "border-white/20 bg-white/10 text-white";
  }
}

async function getLatestActivity() {
  const supabase = await createServerClient();
  const activity: ActivityItem[] = [];

  const [carsResult, methResult, gangsResult, trojanResult, shopResult, craftingResult] =
    await Promise.allSettled([
      supabase
        .from("cars")
        .select("id, name, brand, image, status, created_at")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("meth_recipes")
        .select("id, fosfor_color, lithium, pseudoephedrin, fosfor_amount, renhed, stabiliseringstid, updated_at")
        .order("updated_at", { ascending: false })
        .limit(3),
      supabase
        .from("gangs")
        .select("id, name, image, description, status, created_at")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("trojan_guides")
        .select("id, title, short_description, cover_image, category, difficulty, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(3),
      supabase
        .from("shop_items")
        .select("id, name, category, price, image, created_at")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("crafting_items")
        .select("id, name, image, craft_amount, updated_at")
        .order("updated_at", { ascending: false })
        .limit(3),
    ]);

  if (carsResult.status === "fulfilled" && !carsResult.value.error) {
    for (const car of carsResult.value.data ?? []) {
      if (!isValidDate(car.created_at)) continue;

      activity.push({
        id: `car-${car.id}`,
        source: "Cars",
        title: car.name,
        description: [car.brand, car.status].filter(Boolean).join(" • ") || "New car added to the garage.",
        href: "/cars",
        image: car.image,
        emoji: "🚗",
        badge: car.status || "Car",
        date: car.created_at,
        action: "Added",
      });
    }
  }

  if (methResult.status === "fulfilled" && !methResult.value.error) {
    for (const recipe of methResult.value.data ?? []) {
      if (!isValidDate(recipe.updated_at)) continue;

      activity.push({
        id: `meth-${recipe.id}`,
        source: "Meth",
        title: `${recipe.fosfor_color} recipe ${recipe.lithium}-${recipe.pseudoephedrin}-${recipe.fosfor_amount}`,
        description: `Purity: ${recipe.renhed ?? "?"} • Stabiliseringstid: ${recipe.stabiliseringstid ?? "?"}`,
        href: "/meth",
        image: null,
        emoji: "🧪",
        badge: "Recipe",
        date: recipe.updated_at,
        action: "Updated",
      });
    }
  }

  if (gangsResult.status === "fulfilled" && !gangsResult.value.error) {
    for (const gang of gangsResult.value.data ?? []) {
      if (!isValidDate(gang.created_at)) continue;

      activity.push({
        id: `gang-${gang.id}`,
        source: "Gangs",
        title: gang.name,
        description: gang.description || `Status: ${gang.status || "unknown"}`,
        href: "/gangs",
        image: gang.image,
        emoji: "👥",
        badge: gang.status || "Gang",
        date: gang.created_at,
        action: "Added",
      });
    }
  }

  if (trojanResult.status === "fulfilled" && !trojanResult.value.error) {
    for (const guide of trojanResult.value.data ?? []) {
      const date = guide.updated_at || guide.created_at;
      if (!isValidDate(date)) continue;

      const wasUpdated =
        isValidDate(guide.updated_at) &&
        isValidDate(guide.created_at) &&
        new Date(guide.updated_at).getTime() !== new Date(guide.created_at).getTime();

      activity.push({
        id: `trojan-${guide.id}`,
        source: "Trojan",
        title: guide.title,
        description: guide.short_description || "Trojan hacking guide updated.",
        href: `/trojan/${guide.id}`,
        image: guide.cover_image,
        emoji: "💻",
        badge: [guide.category, guide.difficulty].filter(Boolean).join(" • ") || "Guide",
        date,
        action: wasUpdated ? "Updated" : "Added",
      });
    }
  }

  if (shopResult.status === "fulfilled" && !shopResult.value.error) {
    for (const item of shopResult.value.data ?? []) {
      if (!isValidDate(item.created_at)) continue;

      activity.push({
        id: `shop-${item.id}`,
        source: "Shop",
        title: item.name,
        description: `${Number(item.price || 0).toLocaleString("da-DK")} DKK${item.category ? ` • ${item.category}` : ""}`,
        href: "/shop",
        image: item.image,
        emoji: "🛒",
        badge: item.category || "Shop item",
        date: item.created_at,
        action: "Added",
      });
    }
  }

  if (craftingResult.status === "fulfilled" && !craftingResult.value.error) {
    for (const item of craftingResult.value.data ?? []) {
      if (!isValidDate(item.updated_at)) continue;

      activity.push({
        id: `crafting-${item.id}`,
        source: "Crafting",
        title: item.name,
        description: `Craft amount: ${item.craft_amount ?? "?"}`,
        href: "/crafting",
        image: item.image,
        emoji: "🛠️",
        badge: "Crafting recipe",
        date: item.updated_at,
        action: "Updated",
      });
    }
  }

  return activity
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
}

export default async function HomePage() {
  const latestActivity = await getLatestActivity();
  const featured = latestActivity[0];
  const otherItems = latestActivity.slice(1);

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_34%)]" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:38px_38px]" />

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-yellow-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 font-mono text-xs text-white/60">
                dyrene://latest-activity
              </span>
            </div>

            <div className="p-8">
              <p className="font-mono text-sm uppercase tracking-[0.35em] text-emerald-300/80">
                Live website feed
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Latest Updates
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-gray-300">
                The 3 newest or most recently updated things from Cars, Meth, Gangs, Trojan, Shop, and Crafting.
              </p>
            </div>
          </div>

          {featured ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <Link href={featured.href} className="group block">
                <article className="h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur transition duration-300 group-hover:scale-[1.01] group-hover:border-emerald-300/30">
                  <div className="relative h-72 overflow-hidden bg-black/40">
                    {featured.image ? (
                      <img
                        src={featured.image}
                        alt={featured.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-7xl">
                        {featured.emoji}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                    <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${sourceStyles(featured.source)}`}>
                        {featured.source}
                      </span>
                      <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                        {featured.action}
                      </span>
                    </div>
                    <div className="absolute bottom-5 left-5 right-5">
                      <p className="font-mono text-sm text-emerald-300">
                        {timeAgo(featured.date)} • {formatDate(featured.date)}
                      </p>
                      <h2 className="mt-2 text-3xl font-black text-white">
                        {featured.title}
                      </h2>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="mb-4 inline-flex rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-semibold text-white/70">
                      {featured.badge}
                    </div>
                    <p className="line-clamp-3 text-gray-300">{featured.description}</p>
                    <div className="mt-6 font-mono text-sm font-bold text-emerald-300">
                      Open update <span className="inline-block transition group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                </article>
              </Link>

              <div className="grid gap-6">
                {otherItems.map((item) => (
                  <Link key={item.id} href={item.href} className="group block">
                    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur transition duration-300 group-hover:scale-[1.02] group-hover:border-white/20">
                      <div className="flex gap-4">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                          {item.image ? (
                            <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl">
                              {item.emoji}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${sourceStyles(item.source)}`}>
                              {item.source}
                            </span>
                            <span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                              {item.action}
                            </span>
                          </div>

                          <h3 className="truncate text-xl font-black text-white">{item.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-gray-300">{item.description}</p>
                          <p className="mt-3 font-mono text-xs text-emerald-300/80">
                            {timeAgo(item.date)}
                          </p>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-xl backdrop-blur">
              <div className="text-5xl">📡</div>
              <h2 className="mt-4 text-2xl font-black text-white">No updates found yet</h2>
              <p className="mt-2 text-gray-300">
                Add something to Cars, Meth, Gangs, Trojan, Shop, or Crafting and it will show here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
