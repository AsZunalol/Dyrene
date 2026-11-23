This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Admin Discord messaging

Open `/admin/bot` or **Discord bot** in the sidebar. The page and API require a verified Discord identity with `DISCORD_ADMIN_ROLE_ID` in `DISCORD_GUILD_ID` (The Strays). User-editable metadata cannot grant access. Authorization fails closed when Discord cannot verify the role.

The website calls Discord's HTTPS API directly using a server-only bot token. It does not contact the desktop app, open a Discord Gateway connection, or require `BOT_HUB_URL`, `BOT_HUB_SECRET`, Cloudflare, port forwarding, or a separate domain. The desktop bot can remain running independently; website sends also work when it is closed.

The server allowlist in `lib/discord-dashboard-types.ts` includes **The Strays** (`1452753397362069507`) and **AsZuna's gold making club** (`1239636392326467735`) for testing. All message reads, sends, edits and deletes verify that the channel belongs to the selected allowed server. The admin role requirement stays tied to The Strays even when posting to the test server. Desktop server access is unchanged.

Website features:

- Manual messages with formatting, member/role mentions, an embed, up to five link buttons and up to ten attachments (4 MB combined per message, below Vercel's default request limit).
- Grouped formatting tools for bold, italic, underline, strikethrough, spoilers, inline code, code blocks, headings, small text, lists, quotes, text links and emoji. Selection survives formatting, with undo/redo and Ctrl/Cmd shortcuts. Spoiler hides selected text or the whole draft when there is no selection; the preview supports click-to-reveal. Discord applies the final formatting.
- Server and channel selection, a live preview, disabled send controls while a request is pending, and clear success/error messages. Discord's nonce protection guards immediate retries against duplicate sends; uncertain sends should still be checked in Discord before retrying.
- Browser-local drafts and templates, separated by signed-in account. Files are kept only in the current tab until sent; they are not saved in templates. Desktop templates are separate.
- Recent bot messages read from Discord in batches of 50 channel messages, with older batches and direct message-link lookup. Only this bot's messages can be managed. Text edits preserve existing embeds, link buttons and attachments. Edits suppress new mention notifications. Deletion requires confirmation.

Schedules, Twitch alerts, event signups, rotating presence, desktop logs/settings, and bot start/stop controls are **desktop-only**. Those actions are rejected by the website API, and the old embedded UI/upload routes are retired. Interactive desktop posts (including signup buttons and polls) cannot be edited or deleted from the website. The dashboard loads data on demand without a recurring polling loop.

Configure these server-only variables locally and in Vercel:

```env
DISCORD_GUILD_ID=1452753397362069507
DISCORD_ADMIN_ROLE_ID=<The Strays admin role ID>
DISCORD_BOT_TOKEN=<token used to verify members and admin roles>
BOT_HUB_DISCORD_TOKEN=<token of the desktop bot that should send messages>
```

`BOT_HUB_DISCORD_TOKEN` falls back to `DISCORD_BOT_TOKEN` if omitted; set it explicitly when the role-verification bot differs from the messaging bot. Never prefix either token with `NEXT_PUBLIC_`. The bot needs View Channel, Send Messages, Read Message History, Embed Links and Attach Files for the features used. Member-name search needs the Server Members Intent. Existing Supabase website configuration is still required. Redeploy Vercel after changing environment variables.

Run `npm run dev` and open `http://localhost:3000/admin/bot`. `dev:all` and `start:all` now run only the website. `npm run build` builds the Vercel-compatible site. No Python process or desktop worker is started by these commands.

The retained `server/bot-hub` files support the previously installed desktop connector and its regression tests; they are not imported by the website routes or exposed as UI assets. Existing desktop data, credentials, schedules and alerts are untouched. `npm run bot:hub` is a legacy optional worker command, not a requirement for this dashboard.

Run `npm run test:bot` for admin access, server/channel restrictions, direct Discord requests, rich message validation, multipart attachments, message ownership, interactive-post protection, duplicate-send identifiers, error handling and the desktop backend regression tests. Sends in automated tests are mocked.
