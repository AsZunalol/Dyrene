import { Client, GatewayIntentBits, ActivityType } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const WEBSITE_URL = process.env.WEBSITE_URL || "http://localhost:3000";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("Missing DISCORD_BOT_TOKEN in .env.local or environment");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function checkWebsite() {
  try {
    const res = await fetch(`${WEBSITE_URL}/api/health`, {
      method: "GET",
      cache: "no-store",
    });

    return res.ok;
  } catch {
    return false;
  }
}

async function updatePresence() {
  const isWebsiteUp = await checkWebsite();

  if (!client.user) return;

  if (isWebsiteUp) {
    client.user.setPresence({
      status: "online",
      activities: [
        {
          name: "Watching Dyrene",
          type: ActivityType.Watching,
        },
      ],
    });
  } else {
    client.user.setPresence({
      status: "idle",
      activities: [
        {
          name: "website offline",
          type: ActivityType.Watching,
        },
      ],
    });
  }
}

client.once("ready", async () => {
  console.log(`Bot logged in as ${client.user?.tag}`);

  await updatePresence();

  setInterval(async () => {
    await updatePresence();
  }, 60_000);
});

client.on("error", (err) => {
  console.error("Discord bot error:", err);
});

client.login(BOT_TOKEN);