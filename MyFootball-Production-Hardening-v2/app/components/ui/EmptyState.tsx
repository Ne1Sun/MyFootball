"use client";

import React from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`p-10 sm:p-14 rounded-2xl bg-card border border-border text-center space-y-4 max-w-lg mx-auto my-6 ${className}`}
    >
      <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          {description}
        </p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
