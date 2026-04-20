"use client";

import LoadingLink from "@/components/LoadingLink";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const hiddenRoutes = ["/login", "/denied"];
  const shouldHideNavbar = hiddenRoutes.includes(pathname);

  const navItems = [
    { name: "Crafting", path: "/crafting" },
    { name: "Meth", path: "/meth" },
    { name: "Cars", path: "/cars" },
  ];

  const adminItems = [{ name: "Admin", path: "/admin" }];

  const prefetchRoute = useCallback(
    (path: string) => {
      router.prefetch(path);
    },
    [router]
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

    prefetchRoute("/crafting");
    prefetchRoute("/meth");
    prefetchRoute("/cars");
    prefetchRoute("/admin");

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, shouldHideNavbar, prefetchRoute]);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (shouldHideNavbar) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 sm:px-6">
      <div
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3 shadow-xl sm:px-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <LoadingLink
          href="/"
          prefetch
          className="shrink-0 text-lg font-bold text-white transition hover:text-gray-200"
        >
          Dyrene
        </LoadingLink>

        <nav className="flex flex-1 items-center justify-center gap-2 sm:gap-3">
          {navItems.map((item) => {
            const isActive = pathname === item.path;

            return (
              <LoadingLink
                key={item.name}
                href={item.path}
                prefetch
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                  isActive
                    ? "text-white"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
                style={{
                  background: isActive
                    ? "linear-gradient(90deg,#5865F2,#6772E5)"
                    : "transparent",
                }}
              >
                {item.name}
              </LoadingLink>
            );
          })}

          {isAdmin === true &&
            adminItems.map((item) => {
              const isActive = pathname === item.path;

              return (
                <LoadingLink
                  key={item.name}
                  href={item.path}
                  prefetch
                  onMouseEnter={() => prefetchRoute(item.path)}
                  onFocus={() => prefetchRoute(item.path)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                    isActive
                      ? "text-white"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                  style={{
                    background: isActive
                      ? "linear-gradient(90deg,#f59e0b,#d97706)"
                      : "transparent",
                  }}
                >
                  {item.name}
                </LoadingLink>
              );
            })}
        </nav>

        <button
          onMouseEnter={() => {
            prefetchRoute("/crafting");
            prefetchRoute("/meth");
            prefetchRoute("/cars");
            if (isAdmin) prefetchRoute("/admin");
          }}
          onClick={handleLogout}
          disabled={loggingOut}
          className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          style={{
            background: "linear-gradient(90deg,#ef4444,#dc2626)",
          }}
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}