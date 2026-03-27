import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

type NavigationProps = {
  items: NavigationItem[];
  activeItemId: string;
  onSelect: (itemId: string) => void;
  className?: string;
};

export function Navigation({ items, activeItemId, onSelect, className }: NavigationProps) {
  return (
    <nav className={cn("space-y-1", className)} aria-label="Primary navigation">
      {items.map(({ icon: Icon, id, label, badge }) => {
        const active = id === activeItemId;

        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(id)}
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
          </button>
        );
      })}
    </nav>
  );
}
