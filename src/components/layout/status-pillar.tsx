import { cn } from "@/lib/utils";

type StatusPillarProps = {
  tone?: "info" | "warning" | "neutral" | "critical";
  className?: string;
};

const pillarToneClassName: Record<NonNullable<StatusPillarProps["tone"]>, string> = {
  info: "bg-[var(--status-info)]",
  warning: "bg-[var(--status-warning)]",
  neutral: "bg-[var(--status-neutral)]",
  critical: "bg-[var(--status-critical)]",
};

export function StatusPillar({ tone = "neutral", className }: StatusPillarProps) {
  return <span aria-hidden="true" className={cn("h-8 w-1 rounded-full", pillarToneClassName[tone], className)} />;
}
