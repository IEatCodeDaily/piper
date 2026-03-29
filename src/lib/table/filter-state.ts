import { useState, useCallback, useMemo } from "react";
import type { WorkspaceTask } from "@/features/tasks/types";

export interface FilterState {
  status: WorkspaceTask["status"][];
  assigneeId: string[];
  projectId: string[];
}

const defaultFilterState: FilterState = {
  status: [],
  assigneeId: [],
  projectId: [],
};

export function useFilterState() {
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);

  const setStatusFilter = useCallback((status: WorkspaceTask["status"][]) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const setAssigneeFilter = useCallback((assigneeId: string[]) => {
    setFilters((prev) => ({ ...prev, assigneeId }));
  }, []);

  const setProjectFilter = useCallback((projectId: string[]) => {
    setFilters((prev) => ({ ...prev, projectId }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilterState);
  }, []);

  const filterFn = useMemo(() => {
    return (task: WorkspaceTask): boolean => {
      if (filters.status.length > 0 && !filters.status.includes(task.status)) {
        return false;
      }
      if (filters.assigneeId.length > 0) {
        const assigneeId = task.assignee?.id;
        if (!assigneeId || !filters.assigneeId.includes(assigneeId)) {
          return false;
        }
      }
      if (filters.projectId.length > 0) {
        if (!task.projectId || !filters.projectId.includes(task.projectId)) {
          return false;
        }
      }
      return true;
    };
  }, [filters]);

  return {
    filters,
    setStatusFilter,
    setAssigneeFilter,
    setProjectFilter,
    clearFilters,
    filterFn,
  };
}
