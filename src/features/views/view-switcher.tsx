import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
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
};

export function ViewSwitcher({
  view,
  tasks,
  projects,
  selectedTaskId,
  onSelectTask,
  currentUserId,
  currentUserName,
}: ViewSwitcherProps) {
  switch (view) {
    case "workspace":
      return <ListView tasks={tasks} projects={projects} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />;
    case "kanban":
      return <KanbanView tasks={tasks} projects={projects} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />;
    case "timeline":
      return <TimelineView tasks={tasks} projects={projects} />;
    case "my-tasks":
      return (
        <MyTasksView
          tasks={tasks.filter((task) => task.assignee?.id === currentUserId)}
          projects={projects}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          currentUserName={currentUserName}
        />
      );
    case "list":
    default:
      return <ListView tasks={tasks} projects={projects} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />;
  }
}
