import { useState, useMemo } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { CheckSquare2, Clock3, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { StatusPillar } from "@/components/layout/status-pillar";
import { useUpdateTask } from "@/features/tasks/hooks/use-update-task";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { cn } from "@/lib/utils";
import { createTaskColumn, statusSort, prioritySort, dateSort } from "@/lib/table/table-config";
import { StatusCell } from "./cells/status-cell";
import { PriorityCell } from "./cells/priority-cell";
import { DateCell } from "./cells/date-cell";
import { TextCell } from "./cells/text-cell";

function getTaskTone(task: WorkspaceTask) {
  switch (task.status) {
    case "blocked":
      return "critical" as const;
    case "in-progress":
    case "in-review":
      return "info" as const;
    case "planned":
      return "neutral" as const;
    default:
      return "warning" as const;
  }
}

type ListViewProps = {
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
};

export function ListView({ tasks, projects, selectedTaskId, onSelectTask }: ListViewProps) {
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.title])), [projects]);
  const updateTask = useUpdateTask();

  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([]);

  const columns = useMemo(
    () => [
      createTaskColumn({
        id: "title",
        accessorKey: "title",
        header: "Task",
        sortingFn: "alphanumeric",
        cell: ({ row }) => {
          const task = row.original;
          const completedChecklistCount = task.checklist.filter((item) => item.completed).length;

          const handleSaveTitle = async (title: string) => {
            await updateTask.mutateAsync({
              workspaceId: task.workspaceId,
              taskId: task.id,
              patch: { title },
            });
          };

          return (
            <div className="flex min-w-0 items-center gap-3">
              <StatusPillar tone={getTaskTone(task)} />
              <div className="min-w-0">
                <TextCell
                  value={task.title}
                  workspaceId={task.workspaceId}
                  taskId={task.id}
                  onSave={handleSaveTitle}
                  className="truncate text-sm font-medium text-[var(--on-surface)]"
                />
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                  <span>{task.externalId}</span>
                  <span className="inline-flex items-center gap-1">
                    <CheckSquare2 className="size-3.5" />
                    {completedChecklistCount}/{task.checklist.length}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" />
                    {task.remainingPoints ?? task.estimatePoints ?? 0} pts
                  </span>
                </div>
              </div>
            </div>
          );
        },
      }),
      createTaskColumn({
        id: "status",
        accessorKey: "status",
        header: "Status",
        sortingFn: statusSort,
        cell: ({ row }) => {
          const task = row.original;

          const handleSaveStatus = async (status: WorkspaceTask["status"]) => {
            await updateTask.mutateAsync({
              workspaceId: task.workspaceId,
              taskId: task.id,
              patch: { status },
            });
          };

          return (
            <StatusCell
              status={task.status}
              workspaceId={task.workspaceId}
              taskId={task.id}
              onSave={handleSaveStatus}
            />
          );
        },
      }),
      createTaskColumn({
        id: "assignee",
        accessorFn: (row) => row.assignee?.displayName ?? "Unassigned",
        header: "Assignee",
        sortingFn: "alphanumeric",
        cell: ({ row }) => (
          <div className="truncate text-sm text-[var(--on-surface-variant)]">
            {row.original.assignee?.displayName ?? "Unassigned"}
          </div>
        ),
      }),
      createTaskColumn({
        id: "project",
        accessorFn: (row) => projectNames.get(row.projectId ?? "") ?? "—",
        header: "Project",
        sortingFn: "alphanumeric",
        cell: ({ row }) => (
          <div className="truncate text-sm text-[var(--on-surface-variant)]">
            {projectNames.get(row.original.projectId ?? "") ?? "—"}
          </div>
        ),
      }),
      createTaskColumn({
        id: "dueDate",
        accessorKey: "dueDate",
        header: "Due",
        sortingFn: dateSort,
        cell: ({ row }) => {
          const task = row.original;

          const handleSaveDate = async (dueDate: string | undefined) => {
            await updateTask.mutateAsync({
              workspaceId: task.workspaceId,
              taskId: task.id,
              patch: { dueDate },
            });
          };

          return (
            <DateCell
              value={task.dueDate}
              workspaceId={task.workspaceId}
              taskId={task.id}
              onSave={handleSaveDate}
            />
          );
        },
      }),
      createTaskColumn({
        id: "priority",
        accessorKey: "priority",
        header: "Scope",
        sortingFn: prioritySort,
        cell: ({ row }) => {
          const task = row.original;

          const handleSavePriority = async (priority: WorkspaceTask["priority"]) => {
            await updateTask.mutateAsync({
              workspaceId: task.workspaceId,
              taskId: task.id,
              patch: { priority },
            });
          };

          return (
            <PriorityCell
              priority={task.priority}
              workspaceId={task.workspaceId}
              taskId={task.id}
              onSave={handleSavePriority}
            />
          );
        },
      }),
    ],
    [projectNames, updateTask]
  );

      const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleRowClick = (taskId: string, event: React.MouseEvent) => {
    // Prevent row selection when clicking on editable cells
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) {
      return;
    }
    onSelectTask(taskId);
  };

  return (
    <section className="rounded-[28px] bg-[var(--surface-container-high)] p-3">
      <div className="surface-card overflow-hidden rounded-[24px] px-4 py-3">
        {/* Header row */}
        <div className="grid grid-cols-[minmax(0,2fr)_92px_120px_130px_110px_92px] gap-3 px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
          {table.getFlatHeaders().map((header) => {
            const canSort = header.column.getCanSort();
            const sorted = header.column.getIsSorted();

            return (
              <button
                key={header.id}
                type="button"
                onClick={header.column.getToggleSortingHandler()}
                disabled={!canSort}
                className={cn("flex items-center gap-1 text-left", canSort && "cursor-pointer hover:text-[var(--on-surface)]")}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {canSort && (
                  <span className="inline-flex">
                    {sorted === "asc" ? (
                      <ArrowUp className="size-3" />
                    ) : sorted === "desc" ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40" />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body rows */}
        <div className="space-y-1">
          {table.getRowModel().rows.map((row) => {
            const task = row.original;
            const selected = task.id === selectedTaskId;

            return (
              <div
                key={task.id}
                onClick={(e) => handleRowClick(task.id, e)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,2fr)_92px_120px_130px_110px_92px] items-center gap-3 rounded-2xl px-2 py-3 text-left transition cursor-pointer",
                  selected ? "bg-white" : "hover:bg-[var(--surface-container-low)]"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
