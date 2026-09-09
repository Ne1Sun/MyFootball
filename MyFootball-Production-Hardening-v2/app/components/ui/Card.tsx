"use client";

import React, { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  elevation?: "none" | "subtle" | "medium";
}

const paddingStyles = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const elevationStyles = {
  none: "shadow-none",
  subtle: "shadow-xs hover:shadow-sm",
  medium: "shadow-sm hover:shadow-md",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      interactive = false,
      padding = "md",
      elevation = "subtle",
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "rounded-2xl bg-card border border-border transition-[box-shadow,border-color,transform] duration-150 ease-out";
    const interactiveClasses = interactive
      ? "cursor-pointer hover:border-border/80 active:scale-[0.99] touch-manipulation"
      : "";

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${paddingStyles[padding]} ${elevationStyles[elevation]} ${interactiveClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export function CardHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col space-y-1.5 pb-3 border-b border-border/50 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`font-extrabold text-base tracking-tight text-foreground ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`pt-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center pt-3 border-t border-border/50 ${className}`} {...props}>
      {children}
    </div>
  );
}
