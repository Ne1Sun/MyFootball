"use client";

import React from "react";

export type BadgeVariant = "live" | "scheduled" | "completed" | "warning" | "neutral";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  live: {
    container:
      "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    dot: "bg-rose-500",
  },
  scheduled: {
    container:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
  },
  completed: {
    container:
      "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
    dot: "bg-slate-400",
  },
  warning: {
    container:
      "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
    dot: "bg-amber-500",
  },
  neutral: {
    container:
      "bg-muted/80 text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[11px] px-2 py-0.5 rounded-full gap-1.5 font-bold tracking-wider uppercase",
  md: "text-xs px-2.5 py-1 rounded-full gap-2 font-bold uppercase",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  dot = true,
  children,
  className = "",
  ...props
}: BadgeProps) {
  const { container, dot: dotBg } = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center border select-none font-sans ${container} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotBg}`} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
