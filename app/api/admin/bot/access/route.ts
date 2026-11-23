import { botAdminAccess } from "@/lib/bot-admin";

export async function GET() {
  const access = await botAdminAccess();
  return Response.json({ allowed: access.status === 200 }, { status: access.status,
    headers: { "Cache-Control": "private, no-store" } });
}
