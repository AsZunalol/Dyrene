export const DASHBOARD_GUILDS = [
  { id: "1452753397362069507", name: "The Strays" },
  { id: "1239636392326467735", name: "AsZuna's gold making club", testing: true },
] as const;
export const MAX_ATTACHMENT_BYTES = 4_000_000;
export type MessageDraft = {
  content: string;
  allowEveryone: boolean;
  embed: { title: string; description: string; color: string; image: string; thumbnail: string; url: string; footer: string };
  links: { label: string; url: string }[];
};
export function emptyDraft(): MessageDraft {
  return { content: "", allowEveryone: false, embed: { title: "", description: "", color: "#05ca91", image: "", thumbnail: "", url: "", footer: "" }, links: [] };
}
export type DashboardSnapshot = {
  bot: { id: string; name: string; avatar: string | null };
  guild: { id: string; name: string };
  channels: { id: string; name: string; category: string; canSend: boolean; canRead: boolean }[];
  roles: { id: string; name: string }[];
};
export type DashboardMessage = {
  id: string; channelId: string; content: string; timestamp: string; url: string;
  embeds: { title?: string; description?: string }[];
  attachments: { id: string; name: string; url: string }[];
  manageable: boolean;
};
