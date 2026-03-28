import { useMemo, useCallback } from "react";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { WorkspaceProject } from "@/features/projects/types";
import { SurfaceCard } from "@/components/layout/surface-card";
import { SectionHeader } from "@/components/layout/section-header";
import { cn } from "@/lib/utils";

type StreamViewProps = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
};

const STATUS_DOT_COLORS: Record<WorkspaceTask["status"], string> = {
  backlog: "bg-[var(--status-neutral)]",
  planned: "bg-[var(--status-neutral)]",
  "in-progress": "bg-[var(--status-info)]",
  "in-review": "bg-[var(--status-info)]",
  blocked: "bg-[var(--status-critical)]",
  done: "bg-[var(--status-success,theme(colors.green.500))]",
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

type SummaryStat = {
  label: string;
  count: number;
  dotClass: string;
};

export function WorkspaceStreamView({
  tasks,
  projects,
  selectedTaskId,
  onSelectTask,
}: StreamViewProps) {
  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const summaryStats = useMemo((): SummaryStat[] => {
    const open = tasks.filter(
      (t) => t.status === "backlog" || t.status === "planned",
    ).length;
    const inProgress = tasks.filter(
      (t) => t.status === "in-progress" || t.status === "in-review",
    ).length;
    const done = tasks.filter((t) => t.status === "done").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const overdue = tasks.filter(
      (t) =>
        t.dueDate &&
        t.status !== "done" &&
        new Date(t.dueDate) < new Date(),
    ).length;

    const stats: SummaryStat[] = [
      { label: "Open", count: open, dotClass: "bg-[var(--status-neutral)]" },
      {
        label: "In Progress",
        count: inProgress,
        dotClass: "bg-[var(--status-info)]",
      },
      { label: "Done", count: done, dotClass: "bg-[var(--status-success,theme(colors.green.500))]" },
    ];

    if (blocked > 0) {
      stats.push({
        label: "Blocked",
        count: blocked,
        dotClass: "bg-[var(--status-critical)]",
      });
    }
    if (overdue > 0) {
      stats.push({
        label: "Overdue",
        count: overdue,
        dotClass: "bg-[var(--status-critical)]",
      });
    }

    return stats;
  }, [tasks]);

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [tasks],
  );

  const handleClick = useCallback(
    (taskId: string) => {
      onSelectTask(taskId);
    },
    [onSelectTask],
  );

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {summaryStats.map((stat) => (
          <SurfaceCard key={stat.label} as="div" className="flex items-center gap-3 px-4 py-3">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", stat.dotClass)} />
            <div className="min-w-0">
              <div className="text-lg font-semibold tabular-nums text-[var(--on-surface)]">
                {stat.count}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                {stat.label}
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>

      {/* Activity stream */}
      <SurfaceCard as="div">
        <SectionHeader
          eyebrow="Activity"
          title="Stream"
          description="Tasks sorted by most recent activity"
        />

        <div className="mt-4 space-y-1">
          {sortedTasks.map((task) => {
            const isSelected = task.id === selectedTaskId;
            const project = task.projectId
              ? projectMap.get(task.projectId)
              : undefined;

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => handleClick(task.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                  isSelected
                    ? "border-2 border-[var(--primary)] bg-[var(--surface-container-high)]"
                    : "border-2 border-transparent hover:bg-[var(--surface-container-low)]",
                )}
              >
                {/* Status dot */}
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    STATUS_DOT_COLORS[task.status],
                  )}
                />

                {/* Title */}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--on-surface)]">
                  {task.title}
                </span>

                {/* Project code badge */}
                {project ? (
                  <span className="shrink-0 rounded-md bg-[var(--surface-container-low)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
                    {project.projectCode}
                  </span>
                ) : null}

                {/* Assignee */}
                <span className="hidden shrink-0 text-sm text-[var(--on-surface-variant)] sm:block">
                  {task.assignee?.displayName ?? "Unassigned"}
                </span>

                {/* Relative time */}
                <span className="shrink-0 text-xs text-[var(--on-surface-variant)]">
                  {formatRelativeTime(task.updatedAt)}
                </span>
              </button>
            );
          })}

          {sortedTasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--on-surface-variant)]">
              No tasks to display.
            </div>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
