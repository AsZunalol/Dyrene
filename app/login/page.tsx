"use client";
import { useTranslation } from "@/components/LanguageProvider";


import Link from "next/link";
import HubIcon from "@/components/HubIcon";
import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPageGlass() {
  const { t } = useTranslation();
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

  return (
    <main className="hub-auth">
      <section className="hub-auth-card">
        <div className="hub-auth-mark"><HubIcon name="shield" width="27" height="27" /></div>
        <p className="hub-eyebrow">{t("Dyrene workspace")}</p>
        <h1>{t("Welcome back.")}</h1>
        <p>{t("Sign in with Discord to access your gang's tools, guides, and shared workspace.")}</p>
        <button type="button" onClick={handleDiscordLogin} disabled={loading} className="hub-primary">
          <HubIcon name="user" width="18" height="18" />
          {loading ? t("Connecting to Discord?") : t("Continue with Discord")}
        </button>
        <div className="hub-auth-note">{t("Access is available to members with the required Discord role. By continuing, you agree to the rules of Dyrene.")}</div>
        <Link href="/" className="mt-5 inline-block text-sm text-muted transition hover:text-accent">{t("Back to home")}</Link>
      </section>
    </main>
  );
}
