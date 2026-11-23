import { botAdminAccess, botAccessError } from "@/lib/bot-admin";

export const runtime = "nodejs";
export async function GET() {
  const access = await botAdminAccess();
  if (access.status !== 200) return botAccessError(access.status);
  return new Response("This interface has moved. Open /admin/bot.", {
    status: 410, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}
