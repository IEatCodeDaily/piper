import type { CommentRef } from "@/features/comments/types";

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

type CommentThreadProps = {
  comments: CommentRef[];
};

export function CommentThread({ comments }: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-5 text-sm text-[var(--on-surface-variant)]">
        No comments yet. Thread shell is ready for Graph-backed discussion input.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <article key={comment.id} className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--on-surface)]">{comment.author.displayName}</div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                {comment.author.jobTitle}
              </div>
            </div>
            <div className="text-xs text-[var(--on-surface-variant)]">{formatCommentTime(comment.updatedAt ?? comment.createdAt)}</div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--on-surface-variant)]">{comment.body}</p>
        </article>
      ))}
    </div>
  );
}
