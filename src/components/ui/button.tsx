import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "default", size = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" | "destructive"; size?: "default" | "lg" | "sm" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        variant === "outline" && "border bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "hover:bg-slate-100",
        variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        size === "default" && "h-11 px-4 text-sm",
        size === "lg" && "h-14 px-5 text-base",
        size === "sm" && "h-9 px-3 text-xs",
        className,
      )}
      {...props}
    />
  );
}
