import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "default", size = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" | "destructive"; size?: "default" | "lg" | "sm" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
        variant === "default" && "bg-primary text-primary-foreground shadow-[0_8px_0_hsl(77_72%_38%)] hover:-translate-y-0.5 hover:shadow-[0_10px_0_hsl(77_72%_38%)] active:translate-y-1 active:shadow-[0_2px_0_hsl(77_72%_38%)]",
        variant === "outline" && "border-border bg-transparent text-foreground hover:border-primary hover:bg-primary/10",
        variant === "ghost" && "text-foreground hover:bg-white/10",
        variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        size === "default" && "h-12 px-5 text-sm",
        size === "lg" && "h-16 px-6 text-base",
        size === "sm" && "h-9 px-3 text-xs",
        className,
      )}
      {...props}
    />
  );
}
