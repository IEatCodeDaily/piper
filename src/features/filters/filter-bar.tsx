import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { FilterChip } from "./filter-chip";
import { STATUS_OPTIONS, type TaskFilters } from "./types";

type FilterBarProps = {
  filters: TaskFilters;
  onToggleStatus: (status: TaskFilters["status"][number]) => void;
  onToggleAssignee: (assigneeId: string) => void;
  onToggleProject: (projectId: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
};

export function FilterBar({
  filters,
  onToggleStatus,
  onToggleAssignee,
  onToggleProject,
  onClearFilters,
  hasActiveFilters,
  tasks,
  projects,
}: FilterBarProps) {
  // Extract unique assignees from tasks
  const assigneeOptions = Array.from(
    new Map(
      tasks
        .filter((task) => task.assignee)
        .map((task) => [task.assignee!.id, { id: task.assignee!.id, label: task.assignee!.displayName }])
    ).values()
  );

  // Build project options
  const projectOptions = projects.map((project) => ({
    id: project.id,
    label: project.title,
  }));

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--surface-container-low)] px-4 py-3">
      <div className="flex items-center gap-2 text-[var(--on-surface-variant)]">
        <Filter className="size-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="Status"
          options={STATUS_OPTIONS}
          selectedIds={filters.status}
          onToggle={(id) => onToggleStatus(id as TaskFilters["status"][number])}
        />

        <FilterChip
          label="Assignee"
          options={assigneeOptions}
          selectedIds={filters.assigneeId}
          onToggle={onToggleAssignee}
        />

        <FilterChip
          label="Project"
          options={projectOptions}
          selectedIds={filters.projectId}
          onToggle={onToggleProject}
        />
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="ml-auto gap-1.5 text-xs"
        >
          <X className="size-3.5" />
          Clear all
        </Button>
      )}
    </div>
  );
}
