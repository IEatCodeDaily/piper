import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";

type WorkspaceStreamViewProps = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
};

export function WorkspaceStreamView({ tasks, onSelectTask }: WorkspaceStreamViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-[28px] bg-[var(--surface-container-high)] p-6">
        <div className="text-sm text-[var(--on-surface-variant)]">No tasks in this workspace.</div>
      </div>
    );
  }

  return (
    <div data-testid="view-workspace" className="space-y-3">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          data-testid="task-row"
          onClick={() => onSelectTask(task.id)}
          className="w-full rounded-2xl bg-[var(--surface-container-high)] px-4 py-3 text-left transition hover:bg-white/70"
        >
          <div className="text-sm font-semibold text-[var(--on-surface)]">{task.title}</div>
          <div className="mt-1 text-xs text-[var(--on-surface-variant)]">
            {task.status} · {task.priority} · {task.assignee?.displayName ?? "Unassigned"}
          </div>
        </button>
      ))}
    </div>
  );
}
