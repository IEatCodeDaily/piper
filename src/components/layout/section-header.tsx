import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
} & ComponentPropsWithoutRef<"div">;

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
  titleClassName,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)} {...props}>
      <div>
        {eyebrow ? (
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">{eyebrow}</div>
        ) : null}
        <h2 className={cn("mt-3 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--on-surface)]", titleClassName)}>
          {title}
        </h2>
        {description ? <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
