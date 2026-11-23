import "server-only";

export async function forwardBotRequest(path: string, init: RequestInit = {}) {
  const secret = process.env.BOT_HUB_SECRET;
  if (!secret) return Response.json({ error: "The bot backend has not been configured." }, { status: 503 });
  try {
    const base = new URL(process.env.BOT_HUB_URL || "http://127.0.0.1:4319");
    if (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))) {
      throw new Error("Remote bot backends require HTTPS.");
    }
    const response = await fetch(new URL(path, base), {
      ...init, headers: { ...init.headers, Authorization: `Bearer ${secret}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(100000),
    });
    return new Response(response.body, { status: response.status, headers: {
      "Content-Type": "application/json", "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "The bot backend is unavailable. Start it with npm run bot:hub. If a send was in progress, check Discord before trying again." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
