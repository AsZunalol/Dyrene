"use client";
import { useTranslation } from "@/components/LanguageProvider";

import Image from "next/image";
import LoadingLink from "@/components/LoadingLink";
import HubIcon, { type HubIconName } from "@/components/HubIcon";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import dyreneLogo from "@/public/Dyrene_logo.png";
import styles from "./Navbar.module.css";

type NavItem = { name: string; path: string; icon: HubIconName };
const workspaceItems: NavItem[] = [
  { name: "Rules & etiquette", path: "/rules", icon: "shield" },
  { name: "Trojan guides", path: "/trojan", icon: "terminal" },
  { name: "Crafting", path: "/crafting", icon: "crafting" },
  { name: "Gang network", path: "/gangs", icon: "gangs" },
  { name: "Garage", path: "/cars", icon: "cars" },
  { name: "Meth recipes", path: "/meth", icon: "lab" },
  { name: "Shop", path: "/shop", icon: "shop" },
  { name: "City map", path: "/map", icon: "map" },
];
const homeItem: NavItem = { name: "Home", path: "/", icon: "home" };
const personalItem: NavItem = { name: "AsZuna", path: "/aszuna", icon: "user" };
const adminItem: NavItem = { name: "Administration", path: "/admin", icon: "shield" };
const botItem: NavItem = { name: "Discord bot", path: "/admin/bot", icon: "terminal" };

export default function Navbar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManageBot, setCanManageBot] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOpen = openPath === pathname;
  const shouldHideNavbar = pathname === "/login" || pathname === "/denied";
  const isActive = (path: string) => path === "/" || path === "/admin" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);

  useEffect(() => {
    if (shouldHideNavbar) return;
    let active = true;
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setSignedIn(Boolean(user));
      if (!user) { setIsAdmin(false); setCanManageBot(false); return; }
      try {
        const response = await fetch("/api/admin/bot/access", { cache: "no-store" });
        const access = await response.json();
        if (active) setCanManageBot(response.ok && access.allowed === true);
      } catch { if (active) setCanManageBot(false); }
      await fetch("/api/profile/sync-discord", { method: "POST" });
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      if (active) setIsAdmin(profile?.is_admin === true);
    };
    void loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queueMicrotask(() => { if (active) void loadUser(); });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase, shouldHideNavbar]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpenPath(null); menuButtonRef.current?.focus(); }
    };
    const closeOnResize = () => setOpenPath(null);
    const breakpoint = window.matchMedia("(min-width: 1024px)");
    document.addEventListener("keydown", closeOnEscape);
    breakpoint.addEventListener("change", closeOnResize);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      breakpoint.removeEventListener("change", closeOnResize);
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setOpenPath(null);
      router.push("/login");
      router.refresh();
    } catch (error) { console.error("Sign out failed:", error); }
    finally { setLoggingOut(false); }
  };

  const navLink = (item: NavItem) => (
    <LoadingLink key={item.path} href={item.path} className={`${styles.link} ${isActive(item.path) ? styles.active : ""}`} aria-current={isActive(item.path) ? "page" : undefined} onClick={() => setOpenPath(null)}>
      <span className={styles.linkIcon}><HubIcon name={item.icon} /></span>
      <span>{t(item.name)}</span>
    </LoadingLink>
  );

  if (shouldHideNavbar) return null;

  return (
    <div data-app-navigation>
      {mobileOpen && <button className={styles.scrim} aria-label={t("Close navigation")} onClick={() => setOpenPath(null)} />}
      <aside id="workspace-navigation" className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <LoadingLink href="/" aria-label={t("Dyrene home")} className={styles.brand} onClick={() => setOpenPath(null)}>
          <Image src={dyreneLogo} alt="Dyrene" loading="eager" fetchPriority="high" sizes="164px" className={styles.logo} />
        </LoadingLink>
        <nav aria-label={t("Main navigation")} className={styles.navigation}>
          <div className={styles.group}>
            <p className={styles.groupLabel}>{t("Overview")}</p>
            {navLink(homeItem)}
          </div>
          <div className={styles.group}>
            <p className={styles.groupLabel}>{t("Workspace")}</p>
            {workspaceItems.map(navLink)}
          </div>
          <div className={styles.group}>
            <p className={styles.groupLabel}>{t("Personal")}</p>
            {navLink(personalItem)}
            {isAdmin && navLink(adminItem)}
            {canManageBot && navLink(botItem)}
          </div>
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.memberLabel}><HubIcon name="shield" width="17" height="17" /><span>{t("Dyrene member space")}</span></div>
          {signedIn ? <button type="button" className="hub-secondary" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? t("Signing out…") : t("Sign out")}</button> : <LoadingLink href="/login" className="hub-primary" onClick={() => setOpenPath(null)}>{t("Sign in")}</LoadingLink>}
        </div>
      </aside>
      <button ref={menuButtonRef} type="button" className={styles.menuButton} aria-label={mobileOpen ? t("Close navigation") : t("Open navigation")} aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={() => setOpenPath(mobileOpen ? null : pathname)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={mobileOpen ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>
      </button>
    </div>
  );
}
