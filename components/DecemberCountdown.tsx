"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import straysLogo from "@/public/thestrays.png";
import { DECEMBER_LAUNCH, getDecemberCountdown } from "@/lib/countdown";

type Countdown = ReturnType<typeof getDecemberCountdown>;

const units = ["days", "hours", "minutes", "seconds"] as const;

export default function DecemberCountdown() {
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const update = () => {
      const next = getDecemberCountdown(Date.now());
      setCountdown(next);
      if (next.finished) clearInterval(interval);
      return next.finished;
    };

    // Start after hydration so the server and browser render the same first frame.
    const timeout = setTimeout(() => {
      if (!update()) interval = setInterval(update, 1000);
    }, 0);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const finished = countdown?.finished === true;

  return (
    <section aria-labelledby="coming-soon-title" className="mx-auto flex h-[calc(100svh-2rem)] w-full max-w-4xl flex-col text-center">
      <div className="relative min-h-0 flex-1">
        <Image
          src={straysLogo}
          alt="The Strays"
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 944px) calc(100vw - 48px), 896px"
          className="object-contain object-bottom drop-shadow-2xl"
        />
      </div>

      <h1 id="coming-soon-title" className="relative z-10 -mt-[min(3rem,6svh)] shrink-0 font-black tracking-tight drop-shadow-lg">
        <span className="block text-xl font-semibold tracking-normal text-white/85 sm:text-2xl">
          {finished ? "The wait is over." : "Coming in"}
        </span>
        <span className="mt-1 block bg-gradient-to-b from-white via-white to-pink-200 bg-clip-text text-[clamp(3rem,10svh,5rem)] leading-[1.08] text-transparent">
          {finished ? "December is here." : "December."}
        </span>
      </h1>

      <p className="mx-auto mt-3 max-w-lg shrink-0 text-base leading-relaxed text-white/75 sm:text-lg">
        {finished ? "Stay tuned for what's next." : "Something new is on the way. Stay tuned."}
      </p>

      <div className="mt-5 shrink-0 overflow-hidden rounded-3xl border border-white/15 bg-black/35 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-white/10 px-4 py-2 text-sm font-medium tracking-wide text-white/65">
          <time dateTime={DECEMBER_LAUNCH}>December 1, 2026</time>
          <span aria-hidden="true" className="mx-3 text-pink-200/60">/</span>
          00:00 CET
        </div>

        <dl
          role="timer"
          aria-label="Countdown to December 1, 2026 at midnight Copenhagen time"
          aria-live="off"
          className="grid grid-cols-4 divide-x divide-white/10 py-4"
        >
          {units.map((unit) => (
            <div key={unit} className="flex min-w-0 flex-col-reverse gap-2 px-1 sm:px-4">
              <dt className="text-xs font-medium capitalize tracking-wide text-white/60 sm:text-sm sm:uppercase sm:tracking-[0.2em]">
                {unit}
              </dt>
              <dd className="font-mono text-[clamp(2rem,6svh,3.5rem)] font-semibold leading-none tracking-tight text-white tabular-nums">
                {countdown ? String(countdown[unit]).padStart(2, "0") : "--"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <p role="status" className="mt-4 shrink-0 text-sm tracking-wide text-pink-100/70">
        {finished ? "December has arrived." : "The countdown is on."}
      </p>
    </section>
  );
}
