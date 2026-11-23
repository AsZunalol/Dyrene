"use client";
import { useTranslation } from "@/components/LanguageProvider";

import { useEffect, useState } from "react";
import Image from "next/image";
import dyreneLogo from "@/public/Dyrene_logo.png";
import { DECEMBER_LAUNCH, getDecemberCountdown } from "@/lib/countdown";

type Countdown = ReturnType<typeof getDecemberCountdown>;

const units = ["days", "hours", "minutes", "seconds"] as const;

export default function DecemberCountdown() {
  const { t } = useTranslation();
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
    <section aria-labelledby="coming-soon-title" className="mx-auto w-full max-w-4xl text-center">
      <Image
        src={dyreneLogo}
        alt="Dyrene"
        loading="eager"
        fetchPriority="high"
        sizes="(max-width: 640px) calc(100vw - 32px), 576px"
        className="mx-auto mb-6 h-auto w-full max-w-xl drop-shadow-2xl sm:mb-8"
      />

      <h1 id="coming-soon-title" className="font-black tracking-tight drop-shadow-lg">
        <span className="block text-2xl font-semibold tracking-normal text-white/85 sm:text-4xl">
          {finished ? t("The wait is over.") : t("Coming in")}
        </span>
        <span className="mt-2 block bg-gradient-to-b from-white via-white to-pink-200 bg-clip-text text-[clamp(3.5rem,12vw,8rem)] leading-[1.08] text-transparent">
          {finished ? t("December is here.") : t("December.")}
        </span>
      </h1>

      <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-white/75 sm:text-xl">
        {finished ? t("Stay tuned for what's next.") : t("Something new is on the way. Stay tuned.")}
      </p>

      <div className="mt-10 overflow-hidden rounded-3xl border border-white/15 bg-black/35 shadow-2xl shadow-black/20 backdrop-blur-xl sm:mt-14">
        <div className="border-b border-white/10 px-4 py-4 text-sm font-medium tracking-wide text-white/65">
          <time dateTime={DECEMBER_LAUNCH}>{t("December 1, 2026")}</time>
          <span aria-hidden="true" className="mx-3 text-pink-200/60">/</span>
          00:00 CET
        </div>

        <dl
          role="timer"
          aria-label={t("Countdown to December 1, 2026 at midnight Copenhagen time")}
          aria-live="off"
          className="grid grid-cols-4 divide-x divide-white/10 py-7 sm:py-10"
        >
          {units.map((unit) => (
            <div key={unit} className="flex min-w-0 flex-col-reverse gap-3 px-1 sm:px-4">
              <dt className="text-xs font-medium capitalize tracking-wide text-white/60 sm:text-sm sm:uppercase sm:tracking-[0.2em]">
                {t(unit)}
              </dt>
              <dd className="font-mono text-[clamp(2rem,7vw,4.5rem)] font-semibold leading-none tracking-tight text-white tabular-nums">
                {countdown ? String(countdown[unit]).padStart(2, "0") : "--"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <p role="status" className="mt-7 text-sm tracking-wide text-pink-100/70">
        {finished ? t("December has arrived.") : t("The countdown is on.")}
      </p>
    </section>
  );
}
