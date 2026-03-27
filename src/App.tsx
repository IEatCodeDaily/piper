import { FolderKanban, LayoutList, PanelsTopLeft, Plus, TimerReset, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RuntimeControls } from "@/features/auth/components/runtime-controls";
import { useAuthStore } from "@/features/auth/state/use-auth-store";
import { AppShell } from "@/components/layout/app-shell";
import type { NavigationItem } from "@/components/layout/navigation";
import { SectionHeader } from "@/components/layout/section-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { TaskDetailPanel } from "@/features/details/task-detail-panel";
import { useSelectionStore } from "@/features/selection/state/use-selection-store";
import { useWorkspaceProjects } from "@/features/projects/hooks/use-workspace-projects";
import { useWorkspaceTasks } from "@/features/tasks/hooks/use-workspace-tasks";
import { useActiveWorkspace } from "@/features/workspaces/hooks/use-active-workspace";
import { useWorkspaces } from "@/features/workspaces/hooks/use-workspaces";
import { useWorkspaceCatalog } from "@/features/workspaces/runtime/workspace-catalog";
import { useWorkspaceStore } from "@/features/workspaces/state/use-workspace-store";
import { ViewSwitcher } from "@/features/views/view-switcher";
import type { WorkspaceViewId } from "@/features/views/types";
import { useRuntimeSettings } from "@/lib/runtime/runtime-settings";

const currentUser = {
  id: "person-zephyr",
  name: "Zephyr",
};

const viewOptions: Record<WorkspaceViewId, { title: string; description: string }> = {
  workspace: {
    title: "Workspace stream",
    description: "Cross-project stream backed by the repository layer and tuned for dense triage.",
  },
  list: {
    title: "List view",
    description: "A compact task table with project, assignee, due-date, and scope metadata.",
  },
  kanban: {
    title: "Kanban lanes",
    description: "Structured status lanes backed by repository tasks from the active workspace.",
  },
  timeline: {
    title: "Timeline planning",
    description: "Project and milestone scaffolding rendered from real project/task dates while the Gantt layer remains future work.",
  },
  "my-tasks": {
    title: "My tasks",
    description: "Assigned work filtered to a plausible current user from the shared fixtures or Graph-mapped identities.",
  },
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function App() {
  const [currentView, setCurrentView] = useState<WorkspaceViewId>("workspace");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const auth = useAuthStore();
  const { repositoryMode, setRepositoryMode } = useRuntimeSettings();
  const { workspaces: catalogWorkspaces, imported, importWorkspaceConfigFromJson } = useWorkspaceCatalog();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspaceStore();
  const { selectedTaskId, selectTask, clearSelection } = useSelectionStore();

  useEffect(() => {
    void auth.initialize();
  }, [auth]);

  useEffect(() => {
    if (!activeWorkspaceId && workspaces[0]?.id) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, setActiveWorkspaceId, workspaces]);

  const taskQuery = activeWorkspace ? { workspaceId: activeWorkspace.id, includeCompleted: true } : null;
  const projectQuery = activeWorkspace ? { workspaceId: activeWorkspace.id, includeCompleted: true } : null;

  const { data: tasks = [], isLoading: tasksLoading } = useWorkspaceTasks(taskQuery);
  const { data: projects = [] } = useWorkspaceProjects(projectQuery);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedProject = projects.find((project) => project.id === selectedTask?.projectId);
  const myTasksCount = tasks.filter((task) => task.assignee?.id === currentUser.id).length;

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        sourceLabel: workspace.sourceRefs.map((sourceRef) => sourceRef.label).join(" · "),
      })),
    [workspaces],
  );

  const navigationItems: NavigationItem[] = useMemo(
    () => [
      { id: "workspace", icon: PanelsTopLeft, label: "Workspace" },
      { id: "list", icon: LayoutList, label: "List" },
      { id: "kanban", icon: FolderKanban, label: "Kanban" },
      { id: "timeline", icon: TimerReset, label: "Timeline" },
      { id: "my-tasks", icon: UserRound, label: "My Tasks", badge: String(myTasksCount) },
    ],
    [myTasksCount],
  );

  const shellUtilities = activeWorkspace
    ? [
        { label: "Mode", value: activeWorkspace.mode },
        { label: "Tenant", value: activeWorkspace.tenantName },
        { label: "Updated", value: formatTimestamp(activeWorkspace.updatedAt) },
      ]
    : [];

  const activeViewConfig = viewOptions[currentView];
  const pageTitle = activeWorkspace ? `${activeWorkspace.name} · ${activeViewConfig.title}` : "Loading workspace…";
  const pageDescription = activeWorkspace
    ? `${activeViewConfig.description} ${activeWorkspace.summary.openTaskCount} open tasks across ${activeWorkspace.summary.projectCount} active project tracks.`
    : "Loading workspace metadata from the configured repository mode.";

  async function handleImportWorkspaceConfig(file: File) {
    const raw = await file.text();
    const importedWorkspace = importWorkspaceConfigFromJson(raw);
    setActiveWorkspaceId(importedWorkspace.workspace.id);
    if (repositoryMode === "mock") {
      setRepositoryMode("graph-mock");
    }
    clearSelection();
  }

  return (
    <AppShell
      sidebar={
        <Sidebar
          workspaces={workspaceOptions}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={(workspaceId) => {
            setActiveWorkspaceId(workspaceId);
            clearSelection();
          }}
          navigationItems={navigationItems}
          activeNavigationId={currentView}
          onSelectNavigation={(itemId) => {
            setCurrentView(itemId as WorkspaceViewId);
          }}
          utilitySlot={
            activeWorkspace ? (
              <SurfaceCard className="rounded-[28px] bg-[var(--surface-container-high)] p-3 shadow-none">
                <div className="surface-card rounded-[22px] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Workspace telemetry
                  </div>
                  <div className="mt-4 space-y-3">
                    {shellUtilities.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-[var(--on-surface-variant)]">{item.label}</span>
                        <span className="font-medium text-[var(--on-surface)]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SurfaceCard>
            ) : null
          }
          footer={
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  void handleImportWorkspaceConfig(file);
                  event.currentTarget.value = "";
                }}
              />
              <Button className="w-full justify-between">
                Quick create
                <Plus className="size-4" />
              </Button>
            </div>
          }
        />
      }
      topbar={
        <Topbar
          eyebrow={activeWorkspace ? `Workspace / ${activeWorkspace.name}` : "Workspace / Loading"}
          title={pageTitle}
          description={pageDescription}
          metrics={
            activeWorkspace
              ? [
                  { label: "Open tasks", value: String(activeWorkspace.summary.openTaskCount) },
                  { label: "Overdue", value: String(activeWorkspace.summary.overdueTaskCount) },
                  { label: "Projects", value: String(activeWorkspace.summary.projectCount) },
                ]
              : []
          }
          actions={
            <Button variant="secondary" className="rounded-2xl px-4" onClick={() => fileInputRef.current?.click()}>
              Import config
            </Button>
          }
          searchPlaceholder={activeWorkspace ? `Search ${activeWorkspace.name} tasks, projects, commands…` : undefined}
        />
      }
      rightRail={
        selectedTask ? (
          <TaskDetailPanel task={selectedTask} project={selectedProject} onClose={clearSelection} />
        ) : (
          <>
            <RuntimeControls
              repositoryMode={repositoryMode}
              onSelectMode={setRepositoryMode}
              onImportConfig={() => fileInputRef.current?.click()}
              authConfigured={auth.configured}
              authStatus={auth.status}
              accountLabel={auth.account?.username ?? auth.account?.name ?? undefined}
              authError={auth.error}
              onSignIn={auth.signIn}
              onSignOut={auth.signOut}
            />
            <SurfaceCard>
              <SectionHeader
                eyebrow="Active workspace"
                title={activeWorkspace?.name ?? "Loading"}
                description={activeWorkspace?.description ?? "Hydrating workspace metadata from the repository layer."}
                titleClassName="mt-0 text-xl"
              />
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Data sources</div>
                  <div className="mt-3 space-y-2 text-sm text-[var(--on-surface-variant)]">
                    {activeWorkspace?.sourceRefs.map((sourceRef) => (
                      <div key={`${sourceRef.entityType}-${sourceRef.listId}`}>{sourceRef.label}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Default presets</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeWorkspace?.presets.map((preset) => (
                      <span key={preset.id} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
                        {preset.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Config catalog</div>
                  <div className="mt-3 space-y-2 text-sm text-[var(--on-surface-variant)]">
                    <div>Total workspaces: {catalogWorkspaces.length}</div>
                    <div>Imported configs: {imported.length}</div>
                    <div>Repository mode: {repositoryMode}</div>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <SectionHeader
                eyebrow="Selection shell"
                title="Task detail panel"
                description="Select an item from the list, kanban, or personal queue to inspect description, metadata, and comments."
                titleClassName="mt-0 text-xl"
              />
              <div className="mt-4 rounded-2xl bg-[var(--surface-container-low)] px-4 py-5 text-sm leading-6 text-[var(--on-surface-variant)]">
                This rail is read-only for now, but the shell is wired to repository-backed task state and flat comment threads that can be powered by SharePoint List comments.
              </div>
            </SurfaceCard>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SurfaceCard>
            <SectionHeader eyebrow="Workspace mode" title={activeWorkspace?.mode === "mock" ? "Mock-backed" : "Graph-backed"} titleClassName="mt-1 text-xl" />
            <div className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">
              The shell now reads workspaces, projects, and tasks from the repository layer instead of inline constants.
            </div>
          </SurfaceCard>
          <SurfaceCard>
            <SectionHeader eyebrow="View state" title={activeViewConfig.title} titleClassName="mt-1 text-xl" />
            <div className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">{activeViewConfig.description}</div>
          </SurfaceCard>
          <SurfaceCard>
            <SectionHeader eyebrow="Current user" title={currentUser.name} titleClassName="mt-1 text-xl" />
            <div className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">
              Personalized queue assumes a fixture-backed operator identity and filters the shared task stream accordingly.
            </div>
          </SurfaceCard>
        </div>

        {workspaceLoading || tasksLoading ? (
          <SurfaceCard>
            <div className="text-sm text-[var(--on-surface-variant)]">Loading workspace data…</div>
          </SurfaceCard>
        ) : activeWorkspace ? (
          <ViewSwitcher
            view={currentView}
            tasks={tasks}
            projects={projects}
            selectedTaskId={selectedTaskId}
            onSelectTask={selectTask}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
          />
        ) : (
          <SurfaceCard>
            <div className="text-sm text-[var(--on-surface-variant)]">No workspace is currently available.</div>
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
