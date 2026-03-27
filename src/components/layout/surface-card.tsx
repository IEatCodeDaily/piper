import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfaceCardProps<T extends ElementType = "section"> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function SurfaceCard<T extends ElementType = "section">({
  as,
  children,
  className,
  ...props
}: SurfaceCardProps<T>) {
  const Component = as ?? "section";

  return (
    <Component className={cn("surface-card rounded-3xl p-5", className)} {...props}>
      {children}
    </Component>
  );
}
