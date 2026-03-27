import { CheckSquare2, Clock3 } from "lucide-react";
import { StatusPillar } from "@/components/layout/status-pillar";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

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

type ListViewProps = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
};

export function ListView({ tasks, projects, selectedTaskId, onSelectTask }: ListViewProps) {
  const projectNames = new Map(projects.map((project) => [project.id, project.title]));

  return (
    <section className="rounded-[28px] bg-[var(--surface-container-high)] p-3">
      <div className="surface-card overflow-hidden rounded-[24px] px-4 py-3">
        <div className="grid grid-cols-[minmax(0,2fr)_92px_120px_130px_110px_92px] gap-3 px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
          <div>Task</div>
          <div>Status</div>
          <div>Assignee</div>
          <div>Project</div>
          <div>Due</div>
          <div>Scope</div>
        </div>

        <div className="space-y-1">
          {tasks.map((task) => {
            const completedChecklistCount = task.checklist.filter((item) => item.completed).length;
            const selected = task.id === selectedTaskId;

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask(task.id)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,2fr)_92px_120px_130px_110px_92px] items-center gap-3 rounded-2xl px-2 py-3 text-left transition",
                  selected ? "bg-white" : "hover:bg-[var(--surface-container-low)]",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StatusPillar tone={getTaskTone(task)} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--on-surface)]">{task.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                      <span>{task.externalId}</span>
                      <span className="inline-flex items-center gap-1">
                        <CheckSquare2 className="size-3.5" />
                        {completedChecklistCount}/{task.checklist.length}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5" />
                        {task.remainingPoints ?? task.estimatePoints ?? 0} pts
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-sm capitalize text-[var(--on-surface-variant)]">{task.status.replaceAll("-", " ")}</div>
                <div className="truncate text-sm text-[var(--on-surface-variant)]">{task.assignee?.displayName ?? "Unassigned"}</div>
                <div className="truncate text-sm text-[var(--on-surface-variant)]">{projectNames.get(task.projectId ?? "") ?? "—"}</div>
                <div className="text-sm text-[var(--on-surface-variant)]">{formatDate(task.dueDate)}</div>
                <div className="text-sm text-[var(--on-surface-variant)]">{task.priority}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
