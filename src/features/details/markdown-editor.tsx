import { useState, useCallback, useEffect } from "react";
import { Check, Pencil, X, Loader2, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function renderMarkdownSimple(text: string): string {
  // Simple markdown rendering - just handle basic formatting
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class=\"rounded bg-[var(--surface-container-highest)] px-1 py-0.5 text-xs\">$1</code>")
    .replace(/^### (.+)$/gm, "<h3 class=\"text-base font-semibold mt-4 mb-2\">$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class=\"text-lg font-semibold mt-4 mb-2\">$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class=\"text-xl font-bold mt-4 mb-2\">$1</h1>")
    .replace(/^- (.+)$/gm, "<li class=\"ml-4\">$1</li>")
    .replace(/\n/g, "<br />");
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "No description provided.",
  disabled = false,
  className,
}: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEdit = useCallback(() => {
    if (!disabled) {
      setEditValue(value);
      setIsEditing(true);
      setShowPreview(false);
    }
  }, [disabled, value]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
    setShowPreview(false);
  }, [value]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onChange(editValue);
      setIsEditing(false);
      setShowPreview(false);
    } catch (error) {
      console.error("Failed to save:", error);
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, onChange, value]);

  if (!isEditing) {
    return (
      <section
        className={cn(
          "group relative rounded-[24px] bg-[var(--surface-container-low)] px-4 py-4",
          !disabled && "cursor-pointer hover:bg-[var(--surface-container)]",
          className,
        )}
        onClick={handleStartEdit}
        onKeyDown={(e) => e.key === "Enter" && handleStartEdit()}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Description</div>
          {!disabled && (
            <Pencil className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60 group-focus:opacity-60" />
          )}
        </div>
        {value ? (
          <div
            className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]"
            dangerouslySetInnerHTML={{ __html: renderMarkdownSimple(value) }}
          />
        ) : (
          <p className="mt-3 text-sm italic text-[var(--on-surface-variant)]">{placeholder}</p>
        )}
      </section>
    );
  }

  return (
    <section className={cn("rounded-[24px] bg-[var(--surface-container-low)] px-4 py-4 ring-2 ring-[var(--primary)]", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Description</div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={showPreview ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowPreview(false)}
            disabled={isSaving}
            className="h-7 gap-1 px-2"
          >
            <FileText className="size-3" /> Edit
          </Button>
          <Button
            type="button"
            variant={showPreview ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setShowPreview(true)}
            disabled={isSaving}
            className="h-7 gap-1 px-2"
          >
            <Eye className="size-3" /> Preview
          </Button>
        </div>
      </div>
      {showPreview ? (
        <div
          className="mt-3 min-h-[120px] text-sm leading-6 text-[var(--on-surface-variant)]"
          dangerouslySetInnerHTML={{ __html: renderMarkdownSimple(editValue) }}
        />
      ) : (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder={placeholder}
          className="mt-3 min-h-[120px] w-full resize-y rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          disabled={isSaving}
          autoFocus
        />
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={handleCancel}
          disabled={isSaving}
          className="gap-1"
        >
          <X className="size-3.5" /> Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="gap-1"
        >
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save
        </Button>
      </div>
    </section>
  );
}
