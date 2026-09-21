import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("h-14 w-full rounded-2xl border border-border bg-slate-950/30 px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30", className)} {...props} />
));
Select.displayName = "Select";
