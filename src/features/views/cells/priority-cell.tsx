import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { WorkspaceTask } from "@/features/tasks/types";

type PriorityCellProps = {
  priority: WorkspaceTask["priority"];
  workspaceId: string;
  taskId: string;
  onSave: (priority: WorkspaceTask["priority"]) => Promise<void>;
};

const PRIORITY_OPTIONS: Array<{ value: WorkspaceTask["priority"]; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const priorityColors: Record<WorkspaceTask["priority"], string> = {
  low: "text-[var(--on-surface-variant)]",
  medium: "text-[var(--status-warning)]",
  high: "text-[var(--status-info)]",
  urgent: "text-[var(--status-critical)]",
};

export function PriorityCell({ priority, onSave }: PriorityCellProps) {
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

  const handleSelect = async (newPriority: WorkspaceTask["priority"]) => {
    if (newPriority === priority) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(newPriority);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update priority:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          "rounded-md px-2 py-1 text-sm font-medium capitalize transition-colors",
          priorityColors[priority],
          "hover:bg-[var(--surface-container-low)]",
          isLoading && "pointer-events-none opacity-50"
        )}
      >
        {priority}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] py-1 shadow-lg">
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm font-medium capitalize transition-colors",
                priorityColors[option.value],
                "hover:bg-[var(--surface-container-high)]",
                option.value === priority && "bg-[var(--surface-container-high)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
