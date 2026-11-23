import { botAdminAccess, botAccessError } from "@/lib/bot-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return botAccessError(403);
  const access = await botAdminAccess();
  if (access.status !== 200) return botAccessError(access.status);
  return Response.json({ error: "Reload the dashboard to attach files directly to your message." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } });
}
