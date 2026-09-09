import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("h-12 w-full rounded-xl border bg-white px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20", className)} {...props} />
));
Select.displayName = "Select";
