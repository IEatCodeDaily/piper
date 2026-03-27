import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";

function formatDate(value?: string) {
  if (!value) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

type TimelineViewProps = {
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
};

export function TimelineView({ projects, tasks }: TimelineViewProps) {
  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id);

        return (
          <section key={project.id} className="rounded-[28px] bg-[var(--surface-container-high)] p-3">
            <div className="surface-card rounded-[24px] p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Timeline placeholder</div>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--on-surface)]">{project.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)]">{project.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Owner</div>
                    <div className="mt-2 text-sm font-medium text-[var(--on-surface)]">{project.owner.displayName}</div>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Window</div>
                    <div className="mt-2 text-sm font-medium text-[var(--on-surface)]">{formatDate(project.startDate)} → {formatDate(project.targetDate)}</div>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Progress</div>
                    <div className="mt-2 text-sm font-medium text-[var(--on-surface)]">{project.progressPercent}%</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
                <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Milestones</div>
                  <div className="mt-3 space-y-3">
                    {project.milestones.map((milestone) => (
                      <div key={milestone.id} className="rounded-2xl bg-white/80 px-4 py-3">
                        <div className="text-sm font-medium text-[var(--on-surface)]">{milestone.title}</div>
                        <div className="mt-1 text-xs text-[var(--on-surface-variant)]">Due {formatDate(milestone.dueDate)} · {milestone.completed ? "Complete" : "Pending"}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Mapped tasks</div>
                    <div className="text-xs text-[var(--on-surface-variant)]">Real task data, structured placeholder rendering</div>
                  </div>
                  <div className="mt-3 space-y-3">
                    {projectTasks.map((task) => (
                      <div key={task.id} className="rounded-2xl bg-white/80 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-[var(--on-surface)]">{task.title}</div>
                          <div className="text-xs capitalize text-[var(--on-surface-variant)]">{task.status.replaceAll("-", " ")}</div>
                        </div>
                        <div className="mt-1 text-xs text-[var(--on-surface-variant)]">{formatDate(task.startDate)} → {formatDate(task.dueDate)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
