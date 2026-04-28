import type { HTMLAttributes } from "react";
import { cn } from "../../lib";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
};

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        variant === "destructive" ? "border-destructive text-destructive" : "border-border",
        className,
      )}
      {...props}
    />
  );
}
