import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { WorkspaceTask } from "@/features/tasks/types";

type KanbanColumnProps = {
  id: WorkspaceTask["status"];
  label: string;
  taskCount: number;
  children: ReactNode;
};

export function KanbanColumn({ id, label, taskCount, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <section className={cn("rounded-[28px] bg-[var(--surface-container-high)] p-3", isOver && "ring-2 ring-[var(--primary)] ring-offset-2")}>
      <div className="surface-card rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Status lane</div>
            <h2 className="mt-2 font-display text-xl font-semibold tracking-[-0.03em]">{label}</h2>
          </div>
          <div className="rounded-full bg-[var(--surface-container-low)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
            {taskCount}
          </div>
        </div>

        <div ref={setNodeRef} className={cn("mt-4 space-y-3 min-h-[100px]", isOver && "bg-[var(--surface-container-low)] rounded-2xl p-2")}>
          {children}
        </div>
      </div>
    </section>
  );
}

export function KanbanEmptyState() {
  return (
    <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-5 text-sm text-[var(--on-surface-variant)]">
      No items in this lane.
    </div>
  );
}
