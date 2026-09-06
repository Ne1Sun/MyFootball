"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteTransitionBar() {
  const pathname = usePathname();
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!animating) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] h-[3px] bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500 animate-broadcast-progress shadow-md shadow-amber-500/20 pointer-events-none" />
  );
}
