import type { SVGProps } from "react";

const paths = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z",
  terminal: "m5 7 4 5-4 5m8 0h6M3 3h18v18H3z",
  crafting: "m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8m-9 5v9M7.5 5.5l9 5v5",
  gangs: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a7 7 0 0 1 14 0v3m1-17a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5v1",
  cars: "m5 10 2-5h10l2 5M4 10h16v8H4zM7 18v2m10-2v2M7 14h1m8 0h1",
  lab: "M9 3h6m-5 0v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 15h8",
  shop: "M5 8h14l1 13H4L5 8Zm4 0V6a3 3 0 0 1 6 0v2",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
  user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 21v-3a7 7 0 0 1 14 0v3",
  shield: "m12 2 8 3v6c0 5-3 8-8 11-5-3-8-6-8-11V5l8-3Zm-4 9 3 3 5-6",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5.5-2 5 5",
  lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 5v2",
} as const;

export type HubIconName = keyof typeof paths;

export default function HubIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: HubIconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
