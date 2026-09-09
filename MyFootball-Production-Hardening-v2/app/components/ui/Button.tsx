"use client";

import React, { forwardRef } from "react";
import { LoaderCircle } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isBusy?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-95 shadow-sm hover:shadow-md border border-primary/40",
  secondary:
    "bg-card text-foreground hover:bg-muted/80 border border-border shadow-xs",
  outline:
    "bg-transparent text-foreground hover:bg-muted border border-border hover:border-border/80",
  ghost:
    "bg-transparent text-foreground hover:bg-muted/60 border border-transparent",
  danger:
    "bg-rose-600 text-white hover:bg-rose-500 border border-rose-700/50 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "min-h-[44px] px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "min-h-[50px] px-6 py-3.5 text-base rounded-2xl gap-2.5 font-bold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isBusy = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center font-bold select-none cursor-pointer " +
      "transition-[transform,box-shadow,background-color,border-color,opacity] duration-100 ease-out " +
      "active:scale-[0.975] active:translate-y-[0.5px] " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
      "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 touch-manipulation";

    return (
      <button
        ref={ref}
        disabled={disabled || isBusy}
        className={`${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${
          fullWidth ? "w-full" : ""
        } ${className}`}
        {...props}
      >
        {isBusy ? (
          <LoaderCircle className="animate-spin shrink-0" size={size === "sm" ? 14 : 17} />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span className="truncate">{children}</span>
        {!isBusy && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
