"use client";

import LoadingLink from "@/components/LoadingLink";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";

type NavItem = {
  name: string;
  path: string;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const hiddenRoutes = ["/login", "/denied"];
  const shouldHideNavbar = hiddenRoutes.includes(pathname);

  const mainItems: NavItem[] = [
    { name: "Home", path: "/" },
    { name: "Trojan", path: "/trojan" },
    { name: "Crafting", path: "/crafting" },
    { name: "Gangs", path: "/gangs" },
  ];

  const moreItems: NavItem[] = [
    { name: "Meth", path: "/meth" },
    { name: "Cars", path: "/cars" },
    { name: "Shop", path: "/shop" },
    { name: "Map", path: "/map" },
  ];

  const adminItems: NavItem[] = [{ name: "Admin", path: "/admin" }];
  const allItems = [...mainItems, ...moreItems, ...(isAdmin === true ? adminItems : [])];

  const prefetchRoute = useCallback(
    (path: string) => {
      router.prefetch(path);
    },
    [router],
  );

  useEffect(() => {
    if (shouldHideNavbar) return;

    let active = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setIsAdmin(false);
        return;
      }

      // Discord sync (ONLY ONCE)
      await fetch("/api/profile/sync-discord", {
        method: "POST",
      });

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!active) return;

      setIsAdmin(profile?.is_admin === true);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    allItems.forEach((item) => prefetchRoute(item.path));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, shouldHideNavbar, prefetchRoute]);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setMoreOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActiveRoute = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const navLinkClass = (path: string) =>
    `rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
      isActiveRoute(path)
        ? "bg-white text-black shadow-lg shadow-white/10"
        : "text-gray-300 hover:bg-white/10 hover:text-white"
    }`;

  if (shouldHideNavbar) return null;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto max-w-6xl">
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-3 shadow-2xl sm:px-5"
          style={{
            background:
              "linear-gradient(180deg, rgba(12,12,18,0.88), rgba(12,12,18,0.68))",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <LoadingLink
            href="/"
            prefetch
            className="group flex shrink-0 items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white text-sm font-black text-black shadow-lg shadow-white/10">
              D
            </span>
            <span className="leading-tight">
              <span className="block text-base font-black tracking-wide text-white">
                Dyrene
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400 sm:block">
                Control Panel
              </span>
            </span>
          </LoadingLink>

          <nav className="hidden items-center gap-1 lg:flex">
            {mainItems.map((item) => (
              <LoadingLink
                key={item.name}
                href={item.path}
                prefetch
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                className={navLinkClass(item.path)}
              >
                {item.name}
              </LoadingLink>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((value) => !value)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                  moreItems.some((item) => isActiveRoute(item.path))
                    ? "bg-white text-black shadow-lg shadow-white/10"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                More <span className="ml-1 text-xs">⌄</span>
              </button>

              {moreOpen && (
                <div className="absolute right-0 top-12 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#101018]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  {moreItems.map((item) => (
                    <LoadingLink
                      key={item.name}
                      href={item.path}
                      prefetch
                      onMouseEnter={() => prefetchRoute(item.path)}
                      onFocus={() => prefetchRoute(item.path)}
                      className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        isActiveRoute(item.path)
                          ? "bg-white text-black"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {item.name}
                    </LoadingLink>
                  ))}
                </div>
              )}
            </div>

            {isAdmin === true &&
              adminItems.map((item) => (
                <LoadingLink
                  key={item.name}
                  href={item.path}
                  prefetch
                  onMouseEnter={() => prefetchRoute(item.path)}
                  onFocus={() => prefetchRoute(item.path)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                    isActiveRoute(item.path)
                      ? "bg-amber-400 text-black shadow-lg shadow-amber-500/20"
                      : "text-amber-200 hover:bg-amber-400/10 hover:text-amber-100"
                  }`}
                >
                  Admin
                </LoadingLink>
              ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <span className="hidden text-xs text-gray-400 xl:block">
              made with love by <span className="font-semibold text-white">AsZuna</span>
            </span>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            <span className="relative h-5 w-5">
              <span
                className={`absolute left-0 top-1 h-0.5 w-5 rounded-full bg-current transition ${
                  mobileOpen ? "translate-y-1.5 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-2.5 h-0.5 w-5 rounded-full bg-current transition ${
                  mobileOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-4 h-0.5 w-5 rounded-full bg-current transition ${
                  mobileOpen ? "-translate-y-1.5 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>

        {mobileOpen && (
          <div
            className="mt-2 overflow-hidden rounded-2xl border border-white/10 p-3 shadow-2xl lg:hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(12,12,18,0.96), rgba(12,12,18,0.88))",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allItems.map((item) => (
                <LoadingLink
                  key={item.name}
                  href={item.path}
                  prefetch
                  onMouseEnter={() => prefetchRoute(item.path)}
                  onFocus={() => prefetchRoute(item.path)}
                  className={`rounded-xl px-3 py-3 text-center text-sm font-semibold transition active:scale-95 ${
                    item.path === "/admin"
                      ? isActiveRoute(item.path)
                        ? "bg-amber-400 text-black"
                        : "bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                      : isActiveRoute(item.path)
                        ? "bg-white text-black"
                        : "bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.name}
                </LoadingLink>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-center text-xs text-gray-400 sm:text-left">
                made with love by <span className="font-semibold text-white">AsZuna</span>
              </span>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
