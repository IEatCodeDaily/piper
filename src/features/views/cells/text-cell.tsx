import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type TextCellProps = {
  value: string;
  className?: string;
  workspaceId: string;
  taskId: string;
  onSave: (value: string) => Promise<void>;
};

export function TextCell({ value, className, onSave }: TextCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync edit value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleOpen = () => {
    setEditValue(value);
    setIsEditing(true);
  };

  const handleClose = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    
    // Don't save if value hasn't changed or is empty
    if (trimmedValue === value || !trimmedValue) {
      handleClose();
      return;
    }

    setIsLoading(true);
    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
      // Reset to original value on error
      setEditValue(value);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className={cn(
          "w-full min-w-0 rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 py-1 text-sm font-medium text-[var(--on-surface)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]",
          isLoading && "pointer-events-none opacity-50",
          className
        )}
      />
    );
  }

  return (
    <div
      onDoubleClick={handleOpen}
      className={cn(
        "cursor-text truncate text-sm font-medium text-[var(--on-surface)]",
        className
      )}
      title="Double-click to edit"
    >
      {value}
    </div>
  );
}
