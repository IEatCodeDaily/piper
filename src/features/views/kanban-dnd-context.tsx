import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { useUpdateTask } from "@/features/tasks/hooks/use-update-task";
import type { WorkspaceTask } from "@/features/tasks/types";

type KanbanDndContextProps = {
  children: ReactNode;
  tasks: WorkspaceTask[];
  onTaskStatusChange?: (taskId: string, newStatus: WorkspaceTask["status"]) => void;
};

export function KanbanDndContext({ children, onTaskStatusChange }: KanbanDndContextProps) {
  const updateTask = useUpdateTask();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as WorkspaceTask["status"];

    // Get the task data from the active node
    const taskData = active.data.current;
    const currentStatus = taskData?.status as WorkspaceTask["status"] | undefined;
    const workspaceId = taskData?.workspaceId as string | undefined;

    // Only update if status actually changed
    if (currentStatus && currentStatus !== newStatus && workspaceId) {
      onTaskStatusChange?.(taskId, newStatus);
      
      updateTask.mutate({
        workspaceId,
        taskId,
        patch: {
          status: newStatus,
        },
      });
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}
