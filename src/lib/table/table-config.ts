import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import type { WorkspaceTask } from "@/features/tasks/types";

/**
 * Helper to create typed column definitions for WorkspaceTask
 */
export function createTaskColumn<TValue>(
  def: ColumnDef<WorkspaceTask, TValue>
): ColumnDef<WorkspaceTask, TValue> {
  return def;
}

/**
 * Custom sorting function for status that respects workflow order
 */
export const statusSort: SortingFn<WorkspaceTask> = (rowA, rowB) => {
  const order = ["backlog", "planned", "in-progress", "blocked", "in-review", "done"];
  const aIndex = order.indexOf(rowA.original.status);
  const bIndex = order.indexOf(rowB.original.status);
  return aIndex - bIndex;
};

/**
 * Custom sorting function for priority
 */
export const prioritySort: SortingFn<WorkspaceTask> = (rowA, rowB) => {
  const order = ["low", "medium", "high", "urgent"];
  const aIndex = order.indexOf(rowA.original.priority);
  const bIndex = order.indexOf(rowB.original.priority);
  return aIndex - bIndex;
};

/**
 * Date sorting function that handles undefined values
 */
export const dateSort: SortingFn<WorkspaceTask> = (rowA, rowB, columnId) => {
  const a = rowA.getValue(columnId) as string | undefined;
  const b = rowB.getValue(columnId) as string | undefined;
  
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  
  return new Date(a).getTime() - new Date(b).getTime();
};
