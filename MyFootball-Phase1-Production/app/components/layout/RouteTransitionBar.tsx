"use client";

import { usePathname } from "next/navigation";

export function RouteTransitionBar() {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      aria-hidden="true"
      className="fixed top-0 inset-x-0 z-[100] h-[3px] bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500 animate-broadcast-progress shadow-md shadow-amber-500/20 pointer-events-none"
    />
  );
}
