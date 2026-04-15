"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPageGlass() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleDiscordLogin = useCallback(async () => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "identify guilds",
        },
      });

      if (error) {
        console.error("Login error:", error);
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setLoading(false);
    }
  }, [supabase]);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter") {
      handleDiscordLogin();
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center"
      onKeyDown={onKeyDown}
      style={{ backgroundColor: "#07203a" }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.60), rgba(4,12,34,0.6))",
          WebkitBackdropFilter: "saturate(120%) blur(8px)",
          backdropFilter: "saturate(120%) blur(8px)",
        }}
      />

      <div className="relative z-10 w-full max-w-md mx-4 px-4">
        <div
          className="rounded-2xl p-8 border border-white/10 shadow-lg"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
            WebkitBackdropFilter: "blur(10px) saturate(120%)",
            backdropFilter: "blur(10px) saturate(120%)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 flex items-center justify-center rounded-lg flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="text-xl font-bold text-white">D</span>
            </div>

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Dyrene Access
              </h1>
              <p className="text-sm text-gray-300">
                Members only — Login with Discord
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDiscordLogin}
              disabled={loading}
              aria-label="Login with Discord"
              className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg text-white font-semibold transition-shadow disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400"
              style={{
                background: "linear-gradient(90deg,#5865F2,#6772E5)",
                boxShadow: "0 6px 18px rgba(103,114,229,0.18)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 245 240"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M104.4 104.4c-5.7 0-10.4 5-10.4 11.2s4.6 11.2 10.4 11.2c5.8 0 10.4-5 10.4-11.2 0-6.2-4.6-11.2-10.4-11.2zm36.2 0c-5.7 0-10.3 5-10.3 11.2s4.6 11.2 10.3 11.2c5.7 0 10.3-5 10.3-11.2s-4.6-11.2-10.3-11.2z"
                  fill="white"
                />
                <path
                  d="M189.5 20H55.5C34.9 20 19 35.4 19 56.2v121.6C19 204.6 35.6 220 57.4 220l18.1-24.7c-7.8 2.4-15.3 5.9-22.3 10.3 5.9 3.9 12.2 7.1 18.7 9.6l.9.3 31.6-37.8c15.9 5 32.8 5 48.6 0l31.6 37.8.9-.3c6.5-2.5 12.8-5.7 18.7-9.6-7 4.4-14.5 7.9-22.3 10.3L187.6 220C209.4 220 226 204.6 226 177.8V56.2C226 35.4 210.1 20 189.5 20z"
                  fill="#5865F2"
                />
              </svg>

              <span>{loading ? "Redirecting…" : "Login with Discord"}</span>
            </button>
          </div>

          <div className="mt-6 text-xs text-gray-400 text-center">
            By continuing you agree to the rules of Dyrene.
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Dyrene</span>
        </div>
      </div>
    </div>
  );
}