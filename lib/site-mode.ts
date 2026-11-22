// Keep the public site locked until we explicitly enable the unfinished features.
// Set SITE_PRELAUNCH=false and restart/rebuild for private development or launch.
// The countdown reaching zero does not unlock the site.
export const isComingSoon = process.env.SITE_PRELAUNCH !== "false";
