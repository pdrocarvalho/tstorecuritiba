import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border border-glass-border bg-glass text-white shadow-sm backdrop-blur-md", className)} {...props} />
  )
);
Card.displayName = "Card";

export { Card };