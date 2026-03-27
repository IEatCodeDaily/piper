import { cn } from "@/lib/utils";

type FieldItem = {
  label: string;
  value: string;
  tone?: "default" | "muted";
};

type FieldListProps = {
  items: FieldItem[];
  className?: string;
};

export function FieldList({ items, className }: FieldListProps) {
  return (
    <dl className={cn("space-y-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 rounded-2xl bg-[var(--surface-container-low)] px-3 py-3">
          <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">{item.label}</dt>
          <dd className={cn("text-sm font-medium text-[var(--on-surface)]", item.tone === "muted" && "font-normal text-[var(--on-surface-variant)]")}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
