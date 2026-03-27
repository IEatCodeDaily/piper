import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  rightRail?: ReactNode;
  className?: string;
  contentClassName?: string;
  viewClassName?: string;
  rightRailClassName?: string;
};

export function AppShell({
  sidebar,
  topbar,
  children,
  rightRail,
  className,
  contentClassName,
  viewClassName,
  rightRailClassName,
}: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-[var(--surface)] text-[var(--on-surface)] antialiased selection:bg-[var(--surface-bright)] selection:text-[var(--on-surface)]", className)}>
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)]">
        {sidebar}
        <main className={cn("bg-[var(--surface)] px-6 py-5", contentClassName)}>
          {topbar}
          <div
            className={cn(
              "mt-10 grid gap-4",
              rightRail ? "2xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.82fr)]" : "grid-cols-1",
              viewClassName,
            )}
          >
            <div className="min-w-0">{children}</div>
            {rightRail ? <aside className={cn("min-w-0 space-y-4", rightRailClassName)}>{rightRail}</aside> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
