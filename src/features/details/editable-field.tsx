import { useState, useCallback, useEffect } from "react";
import { Check, Pencil, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EditableFieldType = "text" | "select" | "date" | "multiselect";

export type SelectOption = {
  value: string;
  label: string;
};

type EditableFieldProps = {
  label: string;
  value: string | string[];
  type?: EditableFieldType;
  options?: SelectOption[];
  placeholder?: string;
  onChange: (value: string | string[]) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  formatDisplay?: (value: string | string[]) => string;
};

export function EditableField({
  label,
  value,
  type = "text",
  options = [],
  placeholder = "Not set",
  onChange,
  disabled = false,
  className,
  formatDisplay,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string | string[]>(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEdit = useCallback(() => {
    if (!disabled) {
      setEditValue(value);
      setIsEditing(true);
    }
  }, [disabled, value]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onChange(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, onChange, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && type !== "multiselect") {
        void handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleSave, handleCancel, type],
  );

  const displayValue = formatDisplay ? formatDisplay(value) : Array.isArray(value) ? value.join(", ") || placeholder : value || placeholder;
  const isMuted = !value || (Array.isArray(value) && value.length === 0);

  if (!isEditing) {
    return (
      <div
        className={cn(
          "group grid grid-cols-[110px_minmax(0,1fr)] gap-3 rounded-2xl bg-[var(--surface-container-low)] px-3 py-3",
          !disabled && "cursor-pointer hover:bg-[var(--surface-container)]",
          className,
        )}
        onClick={handleStartEdit}
        onKeyDown={(e) => e.key === "Enter" && handleStartEdit()}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">{label}</dt>
        <dd className={cn("flex items-center justify-between gap-2 text-sm font-medium text-[var(--on-surface)]", isMuted && "font-normal text-[var(--on-surface-variant)]")}>
          <span>{displayValue}</span>
          {!disabled && (
            <Pencil className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-focus:opacity-60" />
          )}
        </dd>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-[110px_minmax(0,1fr)] gap-3 rounded-2xl bg-[var(--surface-container-low)] px-3 py-3 ring-2 ring-[var(--primary)]", className)}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">{label}</dt>
      <dd className="flex items-center gap-2">
        {type === "select" && (
          <select
            value={editValue as string}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            autoFocus
            disabled={isSaving}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {type === "multiselect" && (
          <div className="flex flex-wrap gap-1.5" onKeyDown={handleKeyDown}>
            {options.map((opt) => {
              const selected = Array.isArray(editValue) && editValue.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (Array.isArray(editValue)) {
                      if (selected) {
                        setEditValue(editValue.filter((v) => v !== opt.value));
                      } else {
                        setEditValue([...editValue, opt.value]);
                      }
                    }
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    selected
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]",
                  )}
                  disabled={isSaving}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
        {type === "date" && (
          <input
            type="date"
            value={editValue as string}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            autoFocus
            disabled={isSaving}
          />
        )}
        {type === "text" && (
          <input
            type="text"
            value={editValue as string}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            autoFocus
            disabled={isSaving}
          />
        )}
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={handleCancel}
            disabled={isSaving}
            aria-label="Cancel"
          >
            <X className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="size-7"
            onClick={() => void handleSave()}
            disabled={isSaving}
            aria-label="Save"
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </Button>
        </div>
      </dd>
    </div>
  );
}
