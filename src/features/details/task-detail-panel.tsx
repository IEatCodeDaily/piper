import { MessageSquareMore, Paperclip, X } from "lucide-react";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import { CommentThread } from "@/features/details/comment-thread";
import { FieldList } from "@/features/details/field-list";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/layout/surface-card";

function formatDate(value?: string) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

type TaskDetailPanelProps = {
  task: WorkspaceTask | null;
  project?: WorkspaceProject;
  onClose: () => void;
};

export function TaskDetailPanel({ task, project, onClose }: TaskDetailPanelProps) {
  if (!task) {
    return null;
  }

  const completedChecklistCount = task.checklist.filter((item) => item.completed).length;

  return (
    <SurfaceCard className="rounded-[28px] p-0 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Task detail</div>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--on-surface)]">{task.title}</h2>
          <div className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {task.externalId}
            {project ? ` · ${project.projectCode} · ${project.title}` : ""}
          </div>
        </div>
        <Button type="button" variant="secondary" size="icon" className="rounded-full" aria-label="Close detail panel" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-5 px-5 pb-5">
        <section className="rounded-[24px] bg-[var(--surface-container-low)] px-4 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Description</div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--on-surface-variant)]">{task.description}</p>
        </section>

        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Metadata</div>
          <FieldList
            className="mt-3"
            items={[
              { label: "Status", value: task.status },
              { label: "Priority", value: task.priority },
              { label: "Assignee", value: task.assignee?.displayName ?? "Unassigned" },
              { label: "Reporter", value: task.reporter?.displayName ?? task.createdBy.displayName },
              { label: "Due", value: formatDate(task.dueDate) },
              { label: "Updated", value: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(task.updatedAt)) },
              { label: "Checklist", value: `${completedChecklistCount}/${task.checklist.length} complete` },
              { label: "Labels", value: task.labels.length > 0 ? task.labels.join(", ") : "None", tone: task.labels.length > 0 ? "default" : "muted" },
            ]}
          />
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
              <MessageSquareMore className="size-3.5" /> Read-only shell
            </div>
            <div className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
              Field editing, markdown authoring, and write-through sync stay intentionally disabled in this batch.
            </div>
          </div>
        </section>

        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Comments</div>
          <div className="mt-3">
            <CommentThread comments={task.comments ?? []} />
          </div>
        </section>
      </div>
    </SurfaceCard>
  );
}
