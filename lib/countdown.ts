// December 1, 2026 at midnight in Copenhagen (CET).
export const DECEMBER_LAUNCH = "2026-12-01T00:00:00+01:00";

export function getDecemberCountdown(now: number) {
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(DECEMBER_LAUNCH) - now) / 1000),
  );

  return {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    finished: remaining === 0,
  };
}
