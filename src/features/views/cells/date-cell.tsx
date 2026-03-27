import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type DateCellProps = {
  value?: string;
  workspaceId: string;
  taskId: string;
  onSave: (date: string | undefined) => Promise<void>;
};

function formatDisplayDate(value?: string) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}

export function DateCell({ value, onSave }: DateCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.showPicker?.();
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    }

    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing]);

  const handleChange = async (newValue: string) => {
    setIsLoading(true);
    try {
      await onSave(newValue || undefined);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update date:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    setIsLoading(true);
    try {
      await onSave(undefined);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to clear date:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {isEditing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleChange(editValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleChange(editValue);
              } else if (e.key === "Escape") {
                setIsEditing(false);
              }
            }}
            className={cn(
              "rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 py-1 text-sm text-[var(--on-surface-variant)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            )}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="rounded px-1 text-xs text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
            >
              Clear
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditValue(value ?? "");
            setIsEditing(true);
          }}
          disabled={isLoading}
          className={cn(
            "rounded-md px-2 py-1 text-sm text-[var(--on-surface-variant)] transition-colors",
            "hover:bg-[var(--surface-container-low)]",
            isLoading && "pointer-events-none opacity-50"
          )}
        >
          {formatDisplayDate(value)}
        </button>
      )}
    </div>
  );
}
