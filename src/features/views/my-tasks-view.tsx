import { CircleUserRound } from "lucide-react";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

function formatDate(value?: string) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

type MyTasksViewProps = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  currentUserName: string;
};

export function MyTasksView({ tasks, projects, selectedTaskId, onSelectTask, currentUserName }: MyTasksViewProps) {
  const projectNames = new Map(projects.map((project) => [project.id, project.title]));

  return (
    <section className="rounded-[28px] bg-[var(--surface-container-high)] p-3">
      <div className="surface-card rounded-[24px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Personal queue</div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--on-surface)]">My Tasks</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
              Showing tasks assigned to {currentUserName} from the shared mock workspace.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
            {tasks.length} assigned item{tasks.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task.id)}
              className={cn(
                "flex w-full items-start gap-4 rounded-2xl bg-[var(--surface-container-low)] px-4 py-4 text-left transition hover:bg-white",
                selectedTaskId === task.id && "bg-white",
              )}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-[var(--on-surface-variant)]">
                <CircleUserRound className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[var(--on-surface)]">{task.title}</div>
                    <div className="mt-1 text-xs text-[var(--on-surface-variant)]">{projectNames.get(task.projectId ?? "") ?? "No project"} · {task.externalId}</div>
                  </div>
                  <div className="text-xs text-[var(--on-surface-variant)]">Due {formatDate(task.dueDate)}</div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--on-surface-variant)]">{task.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {task.labels.map((label) => (
                    <span key={label} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
