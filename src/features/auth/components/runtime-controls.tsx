import { FileUp, LogIn, LogOut, Network, ServerCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/layout/surface-card";
import { SectionHeader } from "@/components/layout/section-header";
import type { RepositoryMode } from "@/lib/runtime/runtime-settings";

type RuntimeControlsProps = {
  repositoryMode: RepositoryMode;
  onSelectMode: (mode: RepositoryMode) => void;
  onImportConfig: () => void;
  onRunValidation?: () => void;
  authConfigured: boolean;
  authStatus: string;
  accountLabel?: string;
  authError?: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

const modeLabels: Record<RepositoryMode, string> = {
  mock: "Mock",
  "graph-mock": "Graph Mock",
  "graph-live": "Graph Live",
};

export function RuntimeControls(props: RuntimeControlsProps) {
  const {
    repositoryMode,
    onSelectMode,
    onImportConfig,
    onRunValidation,
    authConfigured,
    authStatus,
    accountLabel,
    authError,
    onSignIn,
    onSignOut,
  } = props;

  return (
    <SurfaceCard>
      <SectionHeader
        eyebrow="Runtime"
        title="Repository and auth"
        description="Switch repository backends, import workspace configs, and attach Microsoft auth for live Graph access."
        titleClassName="mt-0 text-xl"
      />
      <div className="mt-4 space-y-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">Repository mode</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["mock", "graph-mock", "graph-live"] as RepositoryMode[]).map((mode) => (
              <Button
                key={mode}
                variant={repositoryMode === mode ? "default" : "secondary"}
                size="sm"
                onClick={() => onSelectMode(mode)}
              >
                {mode === "mock" ? <ServerCog className="size-3.5" /> : <Network className="size-3.5" />}
                {modeLabels[mode]}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4 text-sm text-[var(--on-surface-variant)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em]">Microsoft auth</div>
          <div className="mt-2">Status: {authConfigured ? authStatus : "not configured"}</div>
          {accountLabel ? <div className="mt-1">Account: {accountLabel}</div> : null}
          {authError ? <div className="mt-2 text-[var(--status-warning)]">{authError}</div> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void onImportConfig()}>
              <FileUp className="size-3.5" />
              Import config
            </Button>
            {onRunValidation ? (
              <Button size="sm" variant="secondary" onClick={() => onRunValidation()}>
                <ServerCog className="size-3.5" />
                Validate config
              </Button>
            ) : null}
            {authConfigured ? (
              authStatus === "signed-in" ? (
                <Button size="sm" variant="secondary" onClick={() => void onSignOut()}>
                  <LogOut className="size-3.5" />
                  Sign out
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => void onSignIn()}>
                  <LogIn className="size-3.5" />
                  Sign in Microsoft
                </Button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
