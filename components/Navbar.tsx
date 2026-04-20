"use client";

import LoadingLink from "@/components/LoadingLink"; // ✅ changed
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

      setIsAdmin(profile?.is_admin === true);
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { name: "Crafting", path: "/crafting" },
    { name: "Meth", path: "/meth" },
    { name: "Cars", path: "/cars" },
  ];

  const adminItems = [{ name: "Admin", path: "/admin" }];

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
        {/* LOGO */}
        <LoadingLink
          href="/"
          className="shrink-0 text-lg font-bold text-white transition hover:text-gray-200"
        >
          Dyrene
        </LoadingLink>

        {/* NAV ITEMS */}
        <nav className="flex flex-1 items-center justify-center gap-2 sm:gap-3">
          {navItems.map((item) => {
            const isActive = pathname === item.path;

            return (
              <LoadingLink
                key={item.name}
                href={item.path}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
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

          {/* ADMIN */}
          {isAdmin &&
            adminItems.map((item) => {
              const isActive = pathname === item.path;

              return (
                <LoadingLink
                  key={item.name}
                  href={item.path}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
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

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          style={{
            background: "linear-gradient(90deg,#ef4444,#dc2626)",
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}