import { botAdminAccess, botAccessError } from "@/lib/bot-admin";
import { DashboardError, dashboardAction, dashboardSnapshot } from "@/lib/discord-dashboard";
import { DASHBOARD_GUILDS } from "@/lib/discord-dashboard-types";

export const runtime = "nodejs";
export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function failure(error: unknown) {
  return Response.json({ error: error instanceof DashboardError ? error.message : error instanceof SyntaxError
    ? "The request could not be read." : "The request could not be completed. Try again shortly." },
  { status: error instanceof DashboardError ? error.status : error instanceof SyntaxError ? 400 : 500, headers: privateHeaders });
}

export async function GET(request: Request) {
  const access = await botAdminAccess();
  if (access.status !== 200) return botAccessError(access.status);
  try {
    const guildId = new URL(request.url).searchParams.get("guildId") || DASHBOARD_GUILDS[0].id;
    return Response.json(await dashboardSnapshot(guildId), { headers: privateHeaders });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return botAccessError(403);
  const access = await botAdminAccess();
  if (access.status !== 200) return botAccessError(access.status);
  try {
    const contentType = request.headers.get("content-type") || "";
    const multipart = contentType.startsWith("multipart/form-data;");
    if (!multipart && !contentType.startsWith("application/json")) throw new DashboardError("Expected a message request.", 415);
    const reader = request.body?.getReader();
    if (!reader) throw new DashboardError("Missing request.");
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > (multipart ? 4_200_000 : 65536)) { await reader.cancel(); throw new DashboardError("The request is too large. Attachments must total at most 4 MB.", 413); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    let input; let files: File[] = [];
    if (multipart) {
      let form: FormData;
      try { form = await new Response(body, { headers: { "Content-Type": contentType } }).formData(); }
      catch { throw new DashboardError("The attachments could not be read."); }
      const payload = form.get("payload");
      if (typeof payload !== "string" || payload.length > 65536) throw new DashboardError("Invalid message.");
      input = JSON.parse(payload);
      const entries = form.getAll("files");
      if (entries.some(file => typeof file === "string")) throw new DashboardError("Invalid attachment.");
      files = entries as File[];
      if (input?.action !== "send") throw new DashboardError("Attachments can only be added to new messages.");
    } else input = JSON.parse(body.toString("utf8"));
    return Response.json(await dashboardAction(input, files, access.userId!), { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
