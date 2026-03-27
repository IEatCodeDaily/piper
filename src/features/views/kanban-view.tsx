import { StatusPillar } from "@/components/layout/status-pillar";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

const columns = [
  { id: "backlog", label: "Backlog" },
  { id: "planned", label: "Planned" },
  { id: "in-progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
] as const;

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

type KanbanViewProps = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
};

export function KanbanView({ tasks, projects, selectedTaskId, onSelectTask }: KanbanViewProps) {
  const projectCodes = new Map(projects.map((project) => [project.id, project.projectCode]));

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);

        return (
          <section key={column.id} className="rounded-[28px] bg-[var(--surface-container-high)] p-3">
            <div className="surface-card rounded-[24px] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Status lane</div>
                  <h2 className="mt-2 font-display text-xl font-semibold tracking-[-0.03em]">{column.label}</h2>
                </div>
                <div className="rounded-full bg-[var(--surface-container-low)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                  {columnTasks.length}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {columnTasks.length > 0 ? (
                  columnTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      className={cn(
                        "w-full rounded-2xl bg-[var(--surface-container-low)] px-4 py-4 text-left transition hover:bg-white",
                        selectedTaskId === task.id && "bg-white",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <StatusPillar tone={getTaskTone(task)} className="mt-1 h-10" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--on-surface)]">{task.title}</div>
                          <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                            {projectCodes.get(task.projectId ?? "") ?? "No project"} · {task.externalId}
                          </div>
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--on-surface-variant)]">{task.description}</p>
                          <div className="mt-3 text-xs text-[var(--on-surface-variant)]">
                            {task.assignee?.displayName ?? "Unassigned"} · {task.priority}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-5 text-sm text-[var(--on-surface-variant)]">
                    No items in this lane.
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
