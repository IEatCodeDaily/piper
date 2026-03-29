import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FilterChipData } from "./types";

type FilterChipProps = {
  label: string;
  options: FilterChipData[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export function FilterChip({ label, options, selectedIds, onToggle }: FilterChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCount = selectedIds.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-medium transition-all",
          "bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]",
          "hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]",
          selectedCount > 0 && "bg-[var(--surface-container)] text-[var(--on-surface)]"
        )}
      >
        {label}
        {selectedCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-xs text-white">
            {selectedCount}
          </span>
        )}
        <ChevronDown
          className={cn("size-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-2xl bg-[var(--surface-container-highest)] p-2 shadow-lg">
          {options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggle(option.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  "hover:bg-[var(--surface-container-low)]",
                  isSelected && "bg-[var(--surface-container-low)]"
                )}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors",
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--primary)]"
                      : "border-[var(--outline)]"
                  )}
                >
                  {isSelected && <Check className="size-3 text-white" />}
                </div>
                <span className="text-[var(--on-surface)]">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
