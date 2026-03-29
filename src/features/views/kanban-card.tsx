import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StatusPillar } from "@/components/layout/status-pillar";
import type { WorkspaceTask } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

type KanbanCardProps = {
  task: WorkspaceTask;
  projectCode: string;
  isSelected: boolean;
  onSelect: () => void;
};

function getTaskTone(task: WorkspaceTask) {
  switch (task.status) {
    case "blocked":
      return "critical" as const;
    case "in-progress":
    case "in-review":
      return "info" as const;
    case "planned":
      return "neutral" as const;
    default:
      return "warning" as const;
  }
}

export function KanbanCard({ task, projectCode, isSelected, onSelect }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      status: task.status,
      workspaceId: task.workspaceId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        isDragging && "z-50 opacity-50 scale-[0.98]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        {...listeners}
        className={cn(
          "w-full rounded-2xl bg-[var(--surface-container-low)] px-4 py-4 text-left transition hover:bg-white cursor-grab active:cursor-grabbing",
          isSelected && "bg-white",
        )}
      >
        <div className="flex items-start gap-3">
          <StatusPillar tone={getTaskTone(task)} className="mt-1 h-10" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--on-surface)]">{task.title}</div>
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              {projectCode} · {task.externalId}
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--on-surface-variant)]">{task.description}</p>
            <div className="mt-3 text-xs text-[var(--on-surface-variant)]">
              {task.assignee?.displayName ?? "Unassigned"} · {task.priority}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
