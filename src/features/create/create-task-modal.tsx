import { useState, useCallback, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import type { WorkspaceProject } from "@/features/projects/types";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/layout/surface-card";
import { useCreateTask } from "./use-create-task";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: WorkspaceTask["status"]; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in-review", label: "In Review" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: WorkspaceTask["priority"]; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

type CreateTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  projects: WorkspaceProject[];
  people: PersonRef[];
};

export function CreateTaskModal({
  isOpen,
  onClose,
  workspaceId,
  projects,
  people,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<WorkspaceTask["status"]>("backlog");
  const [priority, setPriority] = useState<WorkspaceTask["priority"]>("medium");
  const [assigneeId, setAssigneeId] = useState("");

  const createTask = useCreateTask();

  const resetForm = useCallback(() => {
    setTitle("");
    setProjectId("");
    setStatus("backlog");
    setPriority("medium");
    setAssigneeId("");
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;

    try {
      await createTask.mutateAsync({
        workspaceId,
        title: title.trim(),
        projectId: projectId || undefined,
        status,
        priority,
        assigneeId: assigneeId || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  }, [title, workspaceId, projectId, status, priority, assigneeId, createTask, onClose]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!isOpen) return null;

  const isSubmitDisabled = !title.trim() || createTask.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!isOpen}
    >
      <SurfaceCard
        className="w-full max-w-md rounded-[28px] bg-[var(--surface-container-high)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--outline-variant)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">Create Task</h2>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={onClose}
            aria-label="Close modal"
            disabled={createTask.isPending}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label
              htmlFor="task-title"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]"
            >
              Title <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter task title"
              className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              autoFocus
              disabled={createTask.isPending}
              aria-required
            />
          </div>

          <div>
            <label
              htmlFor="task-project"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]"
            >
              Project
            </label>
            <select
              id="task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              disabled={createTask.isPending}
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="task-status"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]"
              >
                Status
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkspaceTask["status"])}
                className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                disabled={createTask.isPending}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="task-priority"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]"
              >
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as WorkspaceTask["priority"])}
                className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                disabled={createTask.isPending}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="task-assignee"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]"
            >
              Assignee
            </label>
            <select
              id="task-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              disabled={createTask.isPending}
            >
              <option value="">Unassigned</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--outline-variant)] px-5 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={createTask.isPending}
            aria-label="Cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitDisabled}
            aria-disabled={isSubmitDisabled}
            aria-label="Create task"
          >
            {createTask.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </SurfaceCard>
    </div>
  );
}
