import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { WorkspaceTask } from "@/features/tasks/types";

type StatusCellProps = {
  status: WorkspaceTask["status"];
  workspaceId: string;
  taskId: string;
  onSave: (status: WorkspaceTask["status"]) => Promise<void>;
};

const STATUS_OPTIONS: Array<{ value: WorkspaceTask["status"]; label: string }> = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in-review", label: "In Review" },
  { value: "done", label: "Done" },
];

const statusColors: Record<WorkspaceTask["status"], string> = {
  backlog: "bg-[var(--status-neutral)]",
  planned: "bg-[var(--status-neutral)]",
  "in-progress": "bg-[var(--status-info)]",
  "in-review": "bg-[var(--status-info)]",
  blocked: "bg-[var(--status-critical)]",
  done: "bg-[var(--status-success,theme(colors.green.500))]",
};

export function StatusCell({ status, onSave }: StatusCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (newStatus: WorkspaceTask["status"]) => {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayLabel = status.replaceAll("-", " ");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1 text-sm text-[var(--on-surface-variant)] transition-colors",
          "hover:bg-[var(--surface-container-low)]",
          isLoading && "pointer-events-none opacity-50"
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", statusColors[status])} />
        <span className="capitalize">{displayLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] py-1 shadow-lg">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                "hover:bg-[var(--surface-container-high)]",
                option.value === status && "bg-[var(--surface-container-high)]"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", statusColors[option.value])} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
