import { useMemo } from "react";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { TaskFilters } from "@/features/filters/types";
import { KanbanView } from "@/features/views/kanban-view";
import { ListView } from "@/features/views/list-view";
import { MyTasksView } from "@/features/views/my-tasks-view";
import { TimelineView } from "@/features/views/timeline-view";
import type { WorkspaceViewId } from "@/features/views/types";

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

    return true;
  });
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

  switch (view) {
    case "workspace":
      return <ListView tasks={filteredTasks} projects={projects} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />;
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
}
