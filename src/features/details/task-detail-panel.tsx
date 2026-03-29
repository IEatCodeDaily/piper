import { useState, useCallback } from "react";
import { MessageSquareMore, Paperclip, X } from "lucide-react";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { CommentThread } from "@/features/details/comment-thread";
import { EditableField, type SelectOption } from "@/features/details/editable-field";
import { MarkdownEditor } from "@/features/details/markdown-editor";
import { CommentInput } from "@/features/details/comment-input";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/layout/surface-card";
import { useUpdateTask } from "@/features/tasks/hooks/use-update-task";
import { useCreateComment } from "@/features/comments/hooks/use-create-comment";
import { useWorkspacePeople } from "@/features/people/hooks/use-workspace-people";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in-review", label: "In Review" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function formatDate(value?: string) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

type TaskDetailPanelProps = {
  task: WorkspaceTask | null;
  project?: WorkspaceProject;
  onClose: () => void;
};

export function TaskDetailPanel({ task, project, onClose }: TaskDetailPanelProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  const updateTask = useUpdateTask();
  const createComment = useCreateComment();
  const { data: people = [] } = useWorkspacePeople(task?.workspaceId ?? null);

  const handleFieldChange = useCallback(
    async (field: keyof WorkspaceTask, value: string | string[]) => {
      if (!task) return;

      await updateTask.mutateAsync({
        workspaceId: task.workspaceId,
        taskId: task.id,
        patch: { [field]: value },
      });
    },
    [task, updateTask],
  );

  const handleTitleSave = useCallback(async () => {
    if (!task || !titleValue.trim()) return;

    try {
      await updateTask.mutateAsync({
        workspaceId: task.workspaceId,
        taskId: task.id,
        patch: { title: titleValue.trim() },
      });
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  }, [task, titleValue, updateTask]);

  const handleCommentSubmit = useCallback(
    async (body: string) => {
      if (!task) return;

      await createComment.mutateAsync({
        workspaceId: task.workspaceId,
        entityType: "task",
        entityId: task.id,
        body,
        bodyFormat: "plain-text",
      });
    },
    [task, createComment],
  );

  if (!task) {
    return null;
  }

  const completedChecklistCount = task.checklist.filter((item) => item.completed).length;

  const assigneeOptions: SelectOption[] = [
    { value: "", label: "Unassigned" },
    ...people.map((p) => ({ value: p.id, label: p.displayName })),
  ];

  const labelOptions: SelectOption[] = [
    { value: "bug", label: "Bug" },
    { value: "feature", label: "Feature" },
    { value: "enhancement", label: "Enhancement" },
    { value: "documentation", label: "Documentation" },
    { value: "urgent", label: "Urgent" },
    { value: "blocked", label: "Blocked" },
  ];

  return (
    <SurfaceCard data-testid="task-detail-panel" className="rounded-[28px] p-0 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-5">
        <div className="flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Task detail</div>
          {isEditingTitle ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleTitleSave();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="flex-1 text-xl font-semibold bg-transparent border-b-2 border-[var(--primary)] text-[var(--on-surface)] focus:outline-none"
                autoFocus
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => void handleTitleSave()}
                disabled={updateTask.isPending}
              >
                Save
              </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsEditingTitle(false)}
            className="shrink-0 rounded-full"
            aria-label="Cancel editing"
          >
            <X className="size-4" />
          </Button>
            </div>
          ) : (
            <h2
              data-testid="task-detail-title"
              className={cn(
                "mt-3 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--on-surface)] cursor-pointer hover:text-[var(--primary)]",
              )}
              onClick={() => {
                setTitleValue(task.title);
                setIsEditingTitle(true);
              }}
            >
              {task.title}
            </h2>
          )}
          <div className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {task.externalId}
            {project ? ` · ${project.projectCode} · ${project.title}` : ""}
          </div>
        </div>
        <Button type="button" data-testid="task-detail-close" variant="secondary" size="icon" className="rounded-full" aria-label="Close detail panel" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-5 px-5 pb-5">
        <MarkdownEditor
          value={task.description}
          onChange={async (value) => {
            await handleFieldChange("description", value);
          }}
          placeholder="Add a description..."
        />

        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Metadata</div>
          <div className="mt-3 space-y-3">
            <EditableField
              label="Status"
              value={task.status}
              type="select"
              options={STATUS_OPTIONS}
              onChange={async (value) => {
                await handleFieldChange("status", value as string);
              }}
            />
            <EditableField
              label="Priority"
              value={task.priority}
              type="select"
              options={PRIORITY_OPTIONS}
              onChange={async (value) => {
                await handleFieldChange("priority", value as string);
              }}
            />
            <EditableField
              label="Assignee"
              value={task.assignee?.id ?? ""}
              type="select"
              options={assigneeOptions}
              onChange={async (value) => {
                // Note: assignee update would need backend support
                console.log("Assignee change to:", value);
              }}
              formatDisplay={() => task.assignee?.displayName ?? "Unassigned"}
            />
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 rounded-2xl bg-[var(--surface-container-low)] px-3 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Reporter</dt>
              <dd className="text-sm font-medium text-[var(--on-surface)]">
                {task.reporter?.displayName ?? task.createdBy.displayName}
              </dd>
            </div>
            <EditableField
              label="Due"
              value={task.dueDate ?? ""}
              type="date"
              onChange={async (value) => {
                await handleFieldChange("dueDate", value as string);
              }}
              formatDisplay={() => formatDate(task.dueDate)}
            />
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 rounded-2xl bg-[var(--surface-container-low)] px-3 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Updated</dt>
              <dd className="text-sm font-medium text-[var(--on-surface)]">{formatDateTime(task.updatedAt)}</dd>
            </div>
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 rounded-2xl bg-[var(--surface-container-low)] px-3 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Checklist</dt>
              <dd className="text-sm font-medium text-[var(--on-surface)]">
                {completedChecklistCount}/{task.checklist.length} complete
              </dd>
            </div>
            <EditableField
              label="Labels"
              value={task.labels}
              type="multiselect"
              options={labelOptions}
              onChange={async (value) => {
                await handleFieldChange("labels", value as string[]);
              }}
              placeholder="No labels"
            />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              <Paperclip className="size-3.5" /> Attachments
            </div>
            <div className="mt-3 space-y-2">
              {task.attachments.length > 0 ? (
                task.attachments.map((attachment) => (
                  <div key={attachment.id} className="text-sm text-[var(--on-surface)]">{attachment.name}</div>
                ))
              ) : (
                <div className="text-sm text-[var(--on-surface-variant)]">No linked files.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              <MessageSquareMore className="size-3.5" /> Activity
            </div>
            <div className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
              {task.comments?.length ?? 0} comments
            </div>
          </div>
        </section>

        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Comments</div>
          <div className="mt-3 space-y-3">
            <CommentInput
              onSubmit={handleCommentSubmit}
              disabled={createComment.isPending}
            />
            <CommentThread comments={task.comments ?? []} />
          </div>
        </section>
      </div>
    </SurfaceCard>
  );
}
