"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function PageTransitionLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);

    const id = requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div
      className={`transition-opacity duration-300 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
