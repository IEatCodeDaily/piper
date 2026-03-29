import { useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CommentInputProps = {
  onSubmit: (body: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
};

export function CommentInput({ onSubmit, disabled = false, placeholder = "Add a comment..." }: CommentInputProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue("");
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [value, isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="rounded-2xl bg-[var(--surface-container-low)] p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[60px] w-full resize-none bg-transparent text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] focus:outline-none"
        disabled={disabled || isSubmitting}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--on-surface-variant)]">Ctrl+Enter to send</span>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={disabled || isSubmitting || !value.trim()}
          className="gap-1"
        >
          {isSubmitting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Send
        </Button>
      </div>
    </div>
  );
}
