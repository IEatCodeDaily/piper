import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn, KanbanEmptyState } from "./kanban-column";
import { KanbanDndContext } from "./kanban-dnd-context";

const columns = [
  { id: "backlog", label: "Backlog" },
  { id: "planned", label: "Planned" },
  { id: "in-progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
] as const;

type KanbanViewProps = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
};

export function KanbanView({ tasks, projects, selectedTaskId, onSelectTask }: KanbanViewProps) {
  const projectCodes = new Map(projects.map((project) => [project.id, project.projectCode]));

  return (
    <KanbanDndContext tasks={tasks}>
      <div data-testid="kanban-view" className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);

          return (
            <KanbanColumn
              key={column.id}
              id={column.id}
              label={column.label}
              taskCount={columnTasks.length}
            >
              {columnTasks.length > 0 ? (
                columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    projectCode={projectCodes.get(task.projectId ?? "") ?? "No project"}
                    isSelected={selectedTaskId === task.id}
                    onSelect={() => onSelectTask(task.id)}
                  />
                ))
              ) : (
                <KanbanEmptyState />
              )}
            </KanbanColumn>
          );
        })}
      </div>
    </KanbanDndContext>
  );
}
