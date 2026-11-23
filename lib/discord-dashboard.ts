import "server-only";
import { createHash } from "node:crypto";
import { DASHBOARD_GUILDS, MAX_ATTACHMENT_BYTES, type DashboardMessage } from "./discord-dashboard-types";

type Json = Record<string, any>; // Discord responses are narrowed before returning to the browser.
export class DashboardError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function token() {
  const value = process.env.BOT_HUB_DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new DashboardError("The Discord bot token has not been configured on the website.", 503);
  return value;
}
function id(value: unknown) {
  if (typeof value !== "string" || !/^\d{15,20}$/.test(value)) throw new DashboardError("Choose a valid Discord destination.");
  return value;
}
export function allowedGuild(value: unknown) {
  const guildId = id(value);
  if (!DASHBOARD_GUILDS.some(guild => guild.id === guildId)) throw new DashboardError("This server is not enabled for the website.", 403);
  return guildId;
}
async function discord(endpoint: string, init: RequestInit = {}): Promise<any> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bot ${token()}`);
  let response: Response;
  try {
    response = await fetch(`https://discord.com/api/v10${endpoint}`, {
      ...init, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new DashboardError(init.method && init.method !== "GET"
      ? "Discord did not confirm the result. Check the channel before retrying; your draft is still here."
      : "Could not reach Discord. Try again shortly.", 502);
  }
  if (!response.ok) {
    if (response.status === 429) throw new DashboardError("Discord is receiving too many requests. Wait a moment before trying again.", 429);
    if (response.status === 403) throw new DashboardError("The bot needs permission to view this channel and perform this action.", 403);
    if (response.status === 404) throw new DashboardError("That channel or message is no longer available.", 404);
    if (response.status === 401) throw new DashboardError("The website's Discord bot token is invalid. Check the server configuration.", 503);
    if (response.status === 400) throw new DashboardError("Discord rejected the message. Check its length, links, attachments and channel permissions.");
    throw new DashboardError("Discord could not complete the request. Check the channel before retrying.", 502);
  }
  return response.status === 204 ? null : response.json();
}
function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
function permissions(guildId: string, botId: string, memberRoles: string[], roles: Json[], overwrites: Json[]) {
  let bits = BigInt(roles.find(role => role.id === guildId)?.permissions || "0");
  for (const role of roles) if (memberRoles.includes(role.id)) bits |= BigInt(role.permissions);
  if (bits & BigInt(8)) return { canSend: true, canRead: true, visible: true };
  const everyone = overwrites.find(row => row.type === 0 && row.id === guildId);
  if (everyone) bits = (bits & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
  let allow = BigInt(0), deny = BigInt(0);
  for (const row of overwrites) if (row.type === 0 && memberRoles.includes(row.id)) { allow |= BigInt(row.allow); deny |= BigInt(row.deny); }
  bits = (bits & ~deny) | allow;
  const member = overwrites.find(row => row.type === 1 && row.id === botId);
  if (member) bits = (bits & ~BigInt(member.deny)) | BigInt(member.allow);
  const has = (mask: number) => (bits & BigInt(mask)) === BigInt(mask);
  return { visible: has(1024), canSend: has(1024 | 2048), canRead: has(1024 | 65536) };
}
export async function dashboardSnapshot(value: unknown) {
  const guildId = allowedGuild(value);
  const [bot, guild, channels, roles] = await Promise.all([
    discord("/users/@me"), discord(`/guilds/${guildId}`), discord(`/guilds/${guildId}/channels`), discord(`/guilds/${guildId}/roles`),
  ]);
  const member = await discord(`/guilds/${guildId}/members/${id(bot.id)}`);
  return {
    bot: { id: bot.id, name: bot.global_name || bot.username, avatar: bot.avatar ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png?size=80` : null },
    guild: { id: guildId, name: guild.name },
    channels: channels.filter((channel: Json) => [0, 5].includes(channel.type))
      .sort((a: Json, b: Json) => (a.position || 0) - (b.position || 0))
      .map((channel: Json) => ({ id: channel.id, name: channel.name,
        category: channels.find((parent: Json) => parent.id === channel.parent_id)?.name || "",
        ...permissions(guildId, bot.id, member.roles, roles, channel.permission_overwrites || []),
      })).filter((channel: Json) => channel.visible),
    roles: roles.filter((role: Json) => role.id !== guildId).map((role: Json) => ({ id: role.id, name: role.name })),
  };
}
async function channelInGuild(guildId: string, value: unknown) {
  const channelId = id(value);
  const channel = await discord(`/channels/${channelId}`);
  if (channel.guild_id !== guildId || ![0, 5].includes(channel.type)) throw new DashboardError("Choose a text channel in the selected server.", 403);
  return channelId;
}
function manageable(message: Json, botId: string) {
  // Interactive desktop posts (such as event signups) must keep their own state.
  return message.author?.id === botId && !message.webhook_id && !message.poll && !(Number(message.flags || 0) & 32768)
    && [0, 19].includes(message.type ?? 0)
    && (message.components || []).every((row: Json) => row.type === 1 && (row.components || []).every((component: Json) => component.type === 2 && component.style === 5));
}
function messageView(message: Json, guildId: string, channelId: string, botId: string): DashboardMessage {
  return { id: message.id, channelId, content: message.content || "", timestamp: message.timestamp,
    url: `https://discord.com/channels/${guildId}/${channelId}/${message.id}`,
    embeds: (message.embeds || []).map((embed: Json) => ({ title: embed.title, description: embed.description })),
    attachments: (message.attachments || []).map((file: Json) => ({ id: file.id, name: file.filename, url: file.url })),
    manageable: manageable(message, botId),
  };
}
function text(value: unknown, limit: number, label: string) {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > limit) throw new DashboardError(`${label} must be at most ${limit.toLocaleString("en-US")} characters.`);
  return value;
}
function url(value: unknown) {
  const raw = text(value, 2048, "URL");
  if (!raw) return "";
  try { const parsed = new URL(raw); if (["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password) return parsed.href; } catch { /* Invalid URL. */ }
  throw new DashboardError("Links and images must use a valid http:// or https:// address.");
}
export function buildMessage(draft: Json, files: File[]) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) throw new DashboardError("Invalid message draft.");
  const content = text(draft.content, 2000, "Message");
  const source = draft.embed || {};
  const title = text(source.title, 256, "Embed title"), description = text(source.description, 4096, "Embed description"), footer = text(source.footer, 2048, "Embed footer");
  const image = url(source.image), thumbnail = url(source.thumbnail), link = url(source.url);
  if (title.length + description.length + footer.length > 6000) throw new DashboardError("The embed must contain at most 6,000 characters in total.");
  const embed: Json = {};
  if (title) embed.title = title;
  if (description) embed.description = description;
  if (footer) embed.footer = { text: footer };
  if (image) embed.image = { url: image };
  if (thumbnail) embed.thumbnail = { url: thumbnail };
  const hasEmbed = Object.keys(embed).length > 0;
  if (hasEmbed) {
    if (link) embed.url = link;
    if (typeof source.color === "string" && /^#[0-9a-f]{6}$/i.test(source.color)) embed.color = parseInt(source.color.slice(1), 16);
  }
  if (!Array.isArray(draft.links || []) || (draft.links || []).length > 5) throw new DashboardError("Use at most five link buttons.");
  const links = (draft.links || []).map((item: Json) => {
    const label = text(item.label, 80, "Button label"), href = url(item.url);
    if (!label.trim() || !href) throw new DashboardError("Each link button needs a label and URL.");
    return { type: 2, style: 5, label, url: href };
  });
  if (files.length > 10 || files.reduce((sum, file) => sum + file.size, 0) > MAX_ATTACHMENT_BYTES) throw new DashboardError("Attach up to ten files, with a combined size of 4 MB.", 413);
  for (const file of files) if (!file.size || file.name.length > 200 || /[\\/\x00-\x1f]/.test(file.name)) throw new DashboardError("Choose non-empty files with valid filenames.");
  if (!content.trim() && !hasEmbed && !files.length && !links.length) throw new DashboardError("Write a message or add an embed, link or attachment.");
  return { content, embeds: hasEmbed ? [embed] : [], components: links.length ? [{ type: 1, components: links }] : [],
    allowed_mentions: { parse: draft.allowEveryone === true ? ["users", "roles", "everyone"] : ["users", "roles"], replied_user: false },
  };
}
export async function dashboardAction(input: Json, files: File[], userId: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DashboardError("Invalid request.");
  if (!["send", "history", "message", "edit", "delete", "members"].includes(input.action)) throw new DashboardError("This feature is only available in the desktop app.");
  const guildId = allowedGuild(input.guildId);
  if (input.action === "members") {
    const query = text(input.query, 80, "Search").trim();
    if (query.length < 2) return { members: [] };
    const members = await discord(`/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=20`);
    return { members: members.map((member: Json) => ({ id: member.user.id, name: member.nick || member.user.global_name || member.user.username })) };
  }
  const channelId = await channelInGuild(guildId, input.channelId);
  if (input.action === "send") {
    const message = buildMessage(input.draft, files);
    if (typeof input.nonce !== "string" || !/^[a-zA-Z0-9_-]{16,64}$/.test(input.nonce)) throw new DashboardError("Missing send identifier. Refresh the page and try again.");
    const nonce = createHash("sha256").update(`${userId}:${guildId}:${channelId}:${input.nonce}`).digest("hex").slice(0, 24);
    const payload = { ...message, nonce, enforce_nonce: true };
    let request = json("POST", payload);
    if (files.length) {
      const body = new FormData();
      body.set("payload_json", JSON.stringify({ ...payload, attachments: files.map((file, index) => ({ id: index, filename: file.name })) }));
      files.forEach((file, index) => body.append(`files[${index}]`, file, file.name));
      request = { method: "POST", body };
    }
    const sent = await discord(`/channels/${channelId}/messages`, request);
    return { message: messageView(sent, guildId, channelId, sent.author.id) };
  }
  const bot = await discord("/users/@me");
  if (input.action === "history") {
    const before = input.before ? `&before=${id(input.before)}` : "";
    const messages = await discord(`/channels/${channelId}/messages?limit=50${before}`);
    return { messages: messages.filter((message: Json) => message.author?.id === bot.id).map((message: Json) => messageView(message, guildId, channelId, bot.id)),
      before: messages.length === 50 ? messages.at(-1).id : null };
  }
  const messageId = id(input.messageId);
  const existing = await discord(`/channels/${channelId}/messages/${messageId}`);
  if (existing.author?.id !== bot.id) throw new DashboardError("Only this bot's messages can be managed here.", 403);
  if (input.action === "message") return { message: messageView(existing, guildId, channelId, bot.id) };
  if (!manageable(existing, bot.id)) throw new DashboardError("Manage interactive posts and event signups from the desktop app.", 403);
  if (input.action === "delete") {
    await discord(`/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });
    return { deleted: messageId };
  }
  const content = text(input.content, 2000, "Message");
  if (!content.trim() && !existing.embeds?.length && !existing.attachments?.length && !existing.components?.length) throw new DashboardError("A message cannot be empty.");
  // Only edit the text. Preserve embeds, links and attachments created by either client.
  const edited = await discord(`/channels/${channelId}/messages/${messageId}`, json("PATCH", { content, allowed_mentions: { parse: [], replied_user: false } }));
  return { message: messageView(edited, guildId, channelId, bot.id) };
}
