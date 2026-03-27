import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

type EditableCellProps = {
  children: React.ReactNode;
  isEditing: boolean;
  onClose: () => void;
  isLoading?: boolean;
  className?: string;
  onDoubleClick?: () => void;
};

/**
 * Generic wrapper for editable cells that handles:
 * - Edit mode toggle
 * - Loading state during mutation
 * - Click outside to close
 */
export function EditableCell({
  children,
  isEditing,
  onClose,
  isLoading,
  className,
  onDoubleClick,
}: EditableCellProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, handleClickOutside]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        isLoading && "pointer-events-none opacity-50",
        className
      )}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}

/**
 * Hook for managing edit state of a cell
 */
export function useEditableCell(initialValue: unknown, onSave: (value: unknown) => Promise<void>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);

  const open = useCallback(() => {
    setEditValue(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const close = useCallback(() => {
    setIsEditing(false);
  }, []);

  const save = useCallback(
    async (value: unknown) => {
      setIsLoading(true);
      try {
        await onSave(value);
        setIsEditing(false);
      } catch (error) {
        console.error("Failed to save:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [onSave]
  );

  return {
    isEditing,
    editValue,
    isLoading,
    open,
    close,
    save,
    setEditValue,
  };
}
