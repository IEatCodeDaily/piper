import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceOption = {
  id: string;
  name: string;
  description: string;
  active?: boolean;
};

type WorkspaceSwitcherProps = {
  workspaces: WorkspaceOption[];
  className?: string;
};

export function WorkspaceSwitcher({ workspaces, className }: WorkspaceSwitcherProps) {
  const activeWorkspace = workspaces.find((workspace) => workspace.active) ?? workspaces[0];

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Workspaces</div>
      <button type="button" className="glass-panel flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-white/70">
        <div>
          <div className="text-sm font-semibold">{activeWorkspace.name}</div>
          <div className="mt-1 text-xs text-[var(--on-surface-variant)]">{activeWorkspace.description}</div>
        </div>
        <ChevronDown className="size-4 shrink-0 text-[var(--on-surface-variant)]" />
      </button>
      <div className="space-y-1 pt-1">
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            className={cn(
              "rounded-xl px-3 py-2 text-sm transition",
              workspace.active ? "bg-white text-[var(--on-surface)]" : "text-[var(--on-surface-variant)] hover:bg-white/60",
            )}
          >
            {workspace.name}
          </div>
        ))}
      </div>
    </div>
  );
}
