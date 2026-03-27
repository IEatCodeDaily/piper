import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TopbarMetric = {
  label: string;
  value: string;
};

export type TopbarProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  metrics?: TopbarMetric[];
  searchPlaceholder?: string;
  commandHint?: string;
  className?: string;
};

export function Topbar({
  eyebrow,
  title,
  description,
  actions,
  metrics = [],
  searchPlaceholder = "Search tasks, projects, commands…",
  commandHint = "⌘K",
  className,
}: TopbarProps) {
  return (
    <header className={cn("flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between", className)}>
      <div className="max-w-3xl">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">{eyebrow}</div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-[var(--on-surface)]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">{description}</p>
        {metrics.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">{metric.label}</div>
                <div className="mt-2 text-sm font-medium text-[var(--on-surface)]">{metric.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-stretch gap-3 xl:min-w-[320px] xl:items-end">
        <div className="glass-panel flex items-center gap-2 rounded-2xl px-3 py-2">
          <Search className="size-4 shrink-0 text-[var(--on-surface-variant)]" />
          <span className="truncate text-sm text-[var(--on-surface-variant)]">{searchPlaceholder}</span>
          <kbd className="ml-auto rounded-md bg-white/70 px-2 py-1 text-[11px] font-semibold text-[var(--on-surface-variant)]">{commandHint}</kbd>
        </div>
        {actions ? <div className="flex justify-end">{actions}</div> : null}
      </div>
    </header>
  );
}
