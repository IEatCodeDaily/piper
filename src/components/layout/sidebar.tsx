import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { PiperLogo } from "@/components/icons/piper-logo";
import { Navigation, type NavigationItem } from "@/components/layout/navigation";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/layout/workspace-switcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarProps = {
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  navigationItems: NavigationItem[];
  activeNavigationId: string;
  onSelectNavigation: (itemId: string) => void;
  footer?: ReactNode;
  utilitySlot?: ReactNode;
  className?: string;
};

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  navigationItems,
  activeNavigationId,
  onSelectNavigation,
  footer,
  utilitySlot,
  className,
}: SidebarProps) {
  return (
    <aside data-testid="sidebar" className={cn("flex min-h-screen flex-col bg-[var(--surface-container-low)] px-5 py-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PiperLogo />
          <div>
            <div className="font-display text-xl font-bold tracking-[-0.03em]">Piper</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              The Precision Engine
            </div>
          </div>
        </div>
        <Button size="icon" variant="secondary" className="rounded-full" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
      </div>

      <WorkspaceSwitcher
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={onSelectWorkspace}
        className="mt-8"
      />
      <Navigation items={navigationItems} activeItemId={activeNavigationId} onSelect={onSelectNavigation} className="mt-8" />
      {utilitySlot ? <div className="mt-8">{utilitySlot}</div> : null}
      <div className="mt-auto pt-8">{footer}</div>
    </aside>
  );
}
