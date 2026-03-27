import { FolderKanban, LayoutList, PanelsTopLeft, Plus, TimerReset, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/layout/section-header";
import { Sidebar } from "@/components/layout/sidebar";
import { StatusPillar } from "@/components/layout/status-pillar";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";

const workspaces = [
  { id: "core-ops", name: "Core Ops", description: "Shared config · Graph-connected", active: true },
  { id: "product", name: "Product", description: "Shared config · Planned rollout" },
  { id: "archived-demo", name: "Archived Demo", description: "Reference workspace · Mock only" },
];

const navigationItems = [
  { icon: PanelsTopLeft, label: "Workspace", active: true },
  { icon: LayoutList, label: "List" },
  { icon: FolderKanban, label: "Kanban" },
  { icon: TimerReset, label: "Timeline" },
  { icon: UserRound, label: "My Tasks", badge: "12" },
];

const focusCards = [
  {
    eyebrow: "ACTIVE WORKSPACE",
    title: "Piper shell scaffold",
    description:
      "Tauri + React foundation, tonal surfaces, reusable shell primitives, and a future-ready injection model now align around the Precision Engine aesthetic.",
    meta: "Ready for Graph adapter + workspace config engine",
  },
  {
    eyebrow: "NEXT MILESTONE",
    title: "Workspace bootstrap",
    description:
      "Load shared JSON config, validate schema, and inject list, Kanban, timeline, and personalized views without changing the shell contract.",
    meta: "Spec-first, adapter-first",
  },
];

const taskRows = [
  {
    title: "Define workspace config schema",
    status: "In Progress",
    owner: "Raisal",
    due: "Today",
    tone: "info" as const,
  },
  {
    title: "Graph list adapter spike",
    status: "Planned",
    owner: "Zephyr",
    due: "Tomorrow",
    tone: "neutral" as const,
  },
  {
    title: "Evaluate Gantt provider",
    status: "Risk Check",
    owner: "Raisal",
    due: "This week",
    tone: "warning" as const,
  },
];

const designNotes = [
  "No-line surfaces, tonal layering, subtle glass for floating elements, and strong editorial typography.",
  "The shell avoids boxed enterprise chrome and establishes the high-density, precision-first interaction model Piper will use for list, Kanban, and timeline modules.",
];

const plannedModules = [
  "Shared workspace config loader",
  "Semantic mapping engine",
  "Microsoft Graph list adapter",
  "Detail panel with comments",
  "List / Kanban / timeline view injection",
];

const shellUtilities = [
  { label: "Pinned mode", value: "Mock shell" },
  { label: "Source of truth", value: "SharePoint Lists" },
  { label: "View engine", value: "Slot-ready" },
];

export default function App() {
  return (
    <AppShell
      sidebar={
        <Sidebar
          workspaces={workspaces}
          navigationItems={navigationItems}
          utilitySlot={
            <SurfaceCard className="rounded-[28px] bg-[var(--surface-container-high)] p-3 shadow-none">
              <div className="surface-card rounded-[22px] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                  Shell telemetry
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
          }
          footer={
            <Button className="w-full justify-between">
              Quick create
              <Plus className="size-4" />
            </Button>
          }
        />
      }
      topbar={
        <Topbar
          eyebrow="Workspace / Core Ops"
          title="Precision workspace for Microsoft Lists"
          description="Piper now exposes a reusable app shell with interchangeable views and a right rail surface, keeping the Precision Engine look intact while preparing the UI for future workspace-driven injection."
          actions={
            <Button variant="secondary" className="rounded-2xl px-4">
              Configure shell
            </Button>
          }
        />
      }
      rightRail={
        <>
          <SurfaceCard>
            <SectionHeader eyebrow="Design language" title="Precision Engine" description={designNotes[0]} titleClassName="mt-0 text-xl" />
            <div className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">{designNotes[1]}</div>
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader eyebrow="Planned modules" title="Foundation phase" titleClassName="mt-0 text-xl" />
            <ul className="mt-4 space-y-3 text-sm text-[var(--on-surface-variant)]">
              {plannedModules.map((module) => (
                <li key={module}>• {module}</li>
              ))}
            </ul>
          </SurfaceCard>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {focusCards.map((card) => (
            <SurfaceCard key={card.title}>
              <SectionHeader
                eyebrow={card.eyebrow}
                title={card.title}
                description={card.description}
                titleClassName="mt-4"
              />
              <div className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                {card.meta}
              </div>
            </SurfaceCard>
          ))}
        </div>

        <section className="rounded-[28px] bg-[var(--surface-container-high)] p-3">
          <div className="surface-card overflow-hidden rounded-[24px] px-4 py-3">
            <SectionHeader
              eyebrow="Workspace view slot"
              title="Current task stream"
              description="Mock data only for now. This workspace pane is ready for list, Kanban, timeline, and personalized task view injection through simple shell props."
              titleClassName="mt-2 text-xl"
            />

            <div className="mt-6 grid grid-cols-[minmax(0,1.8fr)_130px_120px_100px] gap-3 px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              <div>Task</div>
              <div>Status</div>
              <div>Owner</div>
              <div>Due</div>
            </div>

            <div className="space-y-1">
              {taskRows.map((task) => (
                <div
                  key={task.title}
                  className="grid grid-cols-[minmax(0,1.8fr)_130px_120px_100px] items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-[var(--surface-container-low)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusPillar tone={task.tone} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--on-surface)]">{task.title}</div>
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                        SharePoint-backed item
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-[var(--on-surface-variant)]">{task.status}</div>
                  <div className="text-sm text-[var(--on-surface-variant)]">{task.owner}</div>
                  <div className="text-sm text-[var(--on-surface-variant)]">{task.due}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
