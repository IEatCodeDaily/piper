import { Search, X } from "lucide-react";
import { useCallback, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  commandHint?: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search tasks, projects, commands…",
  commandHint = "⌘K",
  className,
}: SearchInputProps) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  return (
    <div className={cn("glass-panel flex items-center gap-2 rounded-2xl px-3 py-2", className)}>
      <Search className="size-4 shrink-0 text-[var(--on-surface-variant)]" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 rounded-md p-1 text-[var(--on-surface-variant)] hover:bg-white/50 transition-colors"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : (
        <kbd className="ml-auto rounded-md bg-white/70 px-2 py-1 text-[11px] font-semibold text-[var(--on-surface-variant)]">
          {commandHint}
        </kbd>
      )}
    </div>
  );
}
