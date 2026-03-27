import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavigationItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  href?: string;
  badge?: string;
};

type NavigationProps = {
  items: NavigationItem[];
  className?: string;
};

export function Navigation({ items, className }: NavigationProps) {
  return (
    <nav className={cn("space-y-1", className)} aria-label="Primary navigation">
      {items.map(({ icon: Icon, label, active, href = "#", badge }) => (
        <a
          key={label}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
            active
              ? "bg-[var(--surface-bright)] text-[var(--on-surface)]"
              : "text-[var(--on-surface-variant)] hover:bg-white/70 hover:text-[var(--on-surface)]",
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span className="font-medium">{label}</span>
          {badge ? (
            <span className="ml-auto rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
              {badge}
            </span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}
