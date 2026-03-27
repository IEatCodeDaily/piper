import { Bell, ChevronDown, FolderKanban, PanelsTopLeft, Plus, Search, TimerReset, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const workspaces = [
  { name: "Core Ops", active: true },
  { name: "Product", active: false },
  { name: "Archived Demo", active: false },
];

const sidebarViews = [
  { icon: PanelsTopLeft, label: "Workspace", active: true },
  { icon: FolderKanban, label: "Kanban" },
  { icon: TimerReset, label: "Timeline" },
  { icon: UserRound, label: "My Tasks" },
];

const focusCards = [
  {
    eyebrow: "ACTIVE WORKSPACE",
    title: "Piper shell scaffold",
    description: "Tauri + React foundation, tonal surfaces, command-first shell, and documentation system now aligned.",
    meta: "Ready for Graph adapter + workspace config engine",
  },
  {
    eyebrow: "NEXT MILESTONE",
    title: "Workspace bootstrap",
    description: "Load shared JSON config, validate schema, and expose task/project lists through semantic mappings.",
    meta: "Spec-first, adapter-first",
  },
];

const tasks = [
  {
    title: "Define workspace config schema",
    status: "In Progress",
    owner: "Raisal",
    due: "Today",
    color: "bg-[var(--status-info)]",
  },
  {
    title: "Graph list adapter spike",
    status: "Planned",
    owner: "Zephyr",
    due: "Tomorrow",
    color: "bg-[var(--status-neutral)]",
  },
  {
    title: "Evaluate Gantt provider",
    status: "Risk Check",
    owner: "Raisal",
    due: "This week",
    color: "bg-[var(--status-warning)]",
  },
];

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] antialiased selection:bg-[var(--surface-bright)] selection:text-[var(--on-surface)]">
      <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)]">
        <aside className="bg-[var(--surface-container-low)] px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-xl font-bold tracking-[-0.03em]">Piper</div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                The Precision Engine
              </div>
            </div>
            <Button size="icon" variant="secondary" className="rounded-full">
              <Bell className="size-4" />
            </Button>
          </div>

          <div className="mt-8 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              Workspaces
            </div>
            <button className="glass-panel flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-white/70">
              <div>
                <div className="text-sm font-semibold">{workspaces.find((workspace) => workspace.active)?.name}</div>
                <div className="mt-1 text-xs text-[var(--on-surface-variant)]">Shared config · Graph-connected</div>
              </div>
              <ChevronDown className="size-4 text-[var(--on-surface-variant)]" />
            </button>
          </div>

          <nav className="mt-8 space-y-1">
            {sidebarViews.map(({ icon: Icon, label, active }) => (
              <button
                key={label}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                  active
                    ? "bg-[var(--surface-bright)] text-[var(--on-surface)]"
                    : "text-[var(--on-surface-variant)] hover:bg-white/70 hover:text-[var(--on-surface)]",
                )}
              >
                <Icon className="size-4" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              Available configs
            </div>
            {workspaces.map((workspace) => (
              <div
                key={workspace.name}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  workspace.active ? "bg-white text-[var(--on-surface)]" : "text-[var(--on-surface-variant)]",
                )}
              >
                {workspace.name}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-8">
            <Button className="w-full justify-between">
              Quick create
              <Plus className="size-4" />
            </Button>
          </div>
        </aside>

        <main className="bg-[var(--surface)] px-6 py-5">
          <header className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                Workspace / Core Ops
              </div>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-[var(--on-surface)]">
                Precision workspace for Microsoft Lists
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)]">
                Piper is now scaffolded as a cross-platform Tauri desktop app with a tonal, no-line UI foundation inspired by your design system. Next up: workspace config loading, Graph adapter integration, and list/kanban/timeline modules.
              </p>
            </div>

            <div className="glass-panel flex items-center gap-2 rounded-2xl px-3 py-2">
              <Search className="size-4 text-[var(--on-surface-variant)]" />
              <span className="text-sm text-[var(--on-surface-variant)]">Search tasks, projects, commands…</span>
              <kbd className="ml-4 rounded-md bg-white/70 px-2 py-1 text-[11px] font-semibold text-[var(--on-surface-variant)]">⌘K</kbd>
            </div>
          </header>

          <section className="mt-10 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {focusCards.map((card) => (
                  <article key={card.title} className="surface-card rounded-3xl p-5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                      {card.eyebrow}
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em]">{card.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">{card.description}</p>
                    <div className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                      {card.meta}
                    </div>
                  </article>
                ))}
              </div>

              <section className="rounded-[28px] bg-[var(--surface-container-high)] p-3">
                <div className="surface-card overflow-hidden rounded-[24px] px-4 py-3">
                  <div className="grid grid-cols-[minmax(0,1.8fr)_130px_120px_100px] gap-3 px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    <div>Task</div>
                    <div>Status</div>
                    <div>Owner</div>
                    <div>Due</div>
                  </div>
                  <div className="space-y-1">
                    {tasks.map((task) => (
                      <div
                        key={task.title}
                        className="grid grid-cols-[minmax(0,1.8fr)_130px_120px_100px] items-center gap-3 rounded-2xl px-2 py-3 hover:bg-[var(--surface-container-low)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={cn("h-8 w-1 rounded-full", task.color)} />
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

            <aside className="space-y-4">
              <section className="surface-card rounded-3xl p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                  Design language
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                  <p>
                    No-line surfaces, tonal layering, subtle glass for floating elements, and strong editorial typography.
                  </p>
                  <p>
                    This shell avoids boxed enterprise chrome and establishes the high-density, precision-first interaction model Piper will use for list, Kanban, and timeline views.
                  </p>
                </div>
              </section>

              <section className="surface-card rounded-3xl p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                  Planned modules
                </div>
                <ul className="mt-4 space-y-3 text-sm text-[var(--on-surface-variant)]">
                  <li>• Shared workspace config loader</li>
                  <li>• Semantic mapping engine</li>
                  <li>• Microsoft Graph list adapter</li>
                  <li>• Detail panel with comments</li>
                  <li>• List / Kanban / Gantt module boundaries</li>
                </ul>
              </section>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
