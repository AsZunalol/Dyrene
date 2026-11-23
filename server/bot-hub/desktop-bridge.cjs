'use strict';
// Loaded by the desktop app's main process. All website requests use its existing
// controller and FeatureService, so previews, sends, event votes and data are shared.
const path = require('node:path');
const { createHubService } = require('./service.cjs');

function attachDesktopBridge({ controller, features, dataDir, app, getSettings, setSettings }) {
  const root = path.resolve(__dirname, '../..');
  require(path.join(root, 'node_modules/dotenv')).config({
    path: [path.join(root, '.env.local'), path.join(root, '.env')], quiet: true,
  });
  const selectSettings = () => {
    const value = getSettings();
    return { autoRecover: value.autoRecover, autoStartBot: value.autoStartBot };
  };
  const { server } = createHubService({
    secret: process.env.BOT_HUB_SECRET, controller, features, dataDir,
    desktopSettings: { get: selectSettings, set: patch => { setSettings(patch); return selectSettings(); } },
  });
  server.listen(Number(process.env.BOT_HUB_PORT || 4319), '127.0.0.1', () => controller.log('Website connected to this bot.'));
  server.on('error', error => controller.log(`Website connection could not start (${error.code}).`, 'error'));
  app.once('before-quit', () => server.close());
  // Use the desktop's existing encrypted credential store; nothing reaches the browser.
  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    features.local('twitch.credentials', { clientId: process.env.TWITCH_CLIENT_ID, clientSecret: process.env.TWITCH_CLIENT_SECRET })
      .catch(() => controller.log('Could not configure Twitch for the website. Check the server settings.', 'error'));
  }
  return server;
}
module.exports = { attachDesktopBridge };
