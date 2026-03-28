import { lazy, useMemo, Suspense } from "react";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { TaskFilters } from "@/features/filters/types";
import type { WorkspaceViewId } from "@/features/views/types";

// Lazy-load views to enable code-splitting of heavy dependencies:
// - KanbanView: @dnd-kit/* packages (~30KB gzipped)
// - ListView: @tanstack/react-table (~15KB gzipped)
const KanbanView = lazy(() => import("./kanban-view").then((m) => ({ default: m.KanbanView })));
const ListView = lazy(() => import("./list-view").then((m) => ({ default: m.ListView })));
const MyTasksView = lazy(() => import("./my-tasks-view").then((m) => ({ default: m.MyTasksView })));
const TimelineView = lazy(() => import("./timeline-view").then((m) => ({ default: m.TimelineView })));
const WorkspaceStreamView = lazy(() => import("./workspace-stream-view").then((m) => ({ default: m.WorkspaceStreamView })));

type ViewSwitcherProps = {
  view: WorkspaceViewId;
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  currentUserId: string;
  currentUserName: string;
  filters?: TaskFilters;
};

function applyFilters(tasks: WorkspaceTask[], filters: TaskFilters | undefined): WorkspaceTask[] {
  if (!filters) return tasks;

  return tasks.filter((task) => {
    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(task.status)) {
      return false;
    }

    // Assignee filter
    if (filters.assigneeId.length > 0 && (!task.assignee || !filters.assigneeId.includes(task.assignee.id))) {
      return false;
    }

    // Project filter
    if (filters.projectId.length > 0 && (!task.projectId || !filters.projectId.includes(task.projectId))) {
      return false;
    }

    // Search filter (matches title and description)
    if (filters.searchQuery.length > 0) {
      const query = filters.searchQuery.toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(query);
      const descriptionMatch = task.description?.toLowerCase().includes(query) ?? false;
      if (!titleMatch && !descriptionMatch) {
        return false;
      }
    }

    return true;
  });
}

function ViewLoadingFallback() {
  return (
    <div className="rounded-[28px] bg-[var(--surface-container-high)] p-6">
      <div className="text-sm text-[var(--on-surface-variant)]">Loading view…</div>
    </div>
  );
}

export function ViewSwitcher({
  view,
  tasks,
  projects,
  selectedTaskId,
  onSelectTask,
  currentUserId,
  currentUserName,
  filters,
}: ViewSwitcherProps) {
  const filteredTasks = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  const viewContent = (() => {
    switch (view) {
      case "workspace":
        return <WorkspaceStreamView tasks={filteredTasks} projects={projects} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />;
      case "kanban":
        return <KanbanView tasks={filteredTasks} projects={projects} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />;
      case "timeline":
        return <TimelineView tasks={filteredTasks} projects={projects} />;
      case "my-tasks":
        return (
          <MyTasksView
            tasks={filteredTasks.filter((task) => task.assignee?.id === currentUserId)}
            projects={projects}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            currentUserName={currentUserName}
          />
        );
      case "list":
      default:
        return <ListView tasks={filteredTasks} projects={projects} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />;
    }
  })();

  return <Suspense fallback={<ViewLoadingFallback />}>{viewContent}</Suspense>;
}
