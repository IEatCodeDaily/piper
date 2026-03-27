import { useCallback, useMemo, useState } from "react";
import { DEFAULT_FILTERS, type TaskFilters, type TaskStatus } from "./types";

export function useFilterState() {
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);

  const toggleStatusFilter = useCallback((status: TaskStatus) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  }, []);

  const toggleAssigneeFilter = useCallback((assigneeId: string) => {
    setFilters((prev) => ({
      ...prev,
      assigneeId: prev.assigneeId.includes(assigneeId)
        ? prev.assigneeId.filter((id) => id !== assigneeId)
        : [...prev.assigneeId, assigneeId],
    }));
  }, []);

  const toggleProjectFilter = useCallback((projectId: string) => {
    setFilters((prev) => ({
      ...prev,
      projectId: prev.projectId.includes(projectId)
        ? prev.projectId.filter((id) => id !== projectId)
        : [...prev.projectId, projectId],
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilters = useMemo(
    () => filters.status.length > 0 || filters.assigneeId.length > 0 || filters.projectId.length > 0,
    [filters]
  );

  return {
    filters,
    toggleStatusFilter,
    toggleAssigneeFilter,
    toggleProjectFilter,
    clearFilters,
    hasActiveFilters,
  };
}
