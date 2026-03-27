import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "@/components/layout/section-header";
import { SurfaceCard } from "@/components/layout/surface-card";
import { useWorkspaceValidation } from "@/features/workspaces/runtime/use-workspace-validation";

type WorkspaceValidationPanelProps = {
  workspaceId: string | null;
};

export function WorkspaceValidationPanel({ workspaceId }: WorkspaceValidationPanelProps) {
  const { data, isLoading } = useWorkspaceValidation(workspaceId);

  return (
    <SurfaceCard>
      <SectionHeader
        eyebrow="Config validation"
        title="Workspace schema check"
        description="Validates mapped source fields against Graph-style list column metadata."
        titleClassName="mt-0 text-xl"
      />
      <div className="mt-4 rounded-2xl bg-[var(--surface-container-low)] px-4 py-4 text-sm text-[var(--on-surface-variant)]">
        {isLoading || !workspaceId ? (
          <div>Validating workspace mapping…</div>
        ) : data?.ok ? (
          <div className="flex items-center gap-2 text-[var(--on-surface)]">
            <CheckCircle2 className="size-4" />
            All mapped fields exist in the current Graph-style schema.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--status-warning)]">
              <AlertTriangle className="size-4" />
              {data?.issues.length ?? 0} validation issue(s) found.
            </div>
            <div className="space-y-2">
              {data?.issues.map((issue, index) => (
                <div key={`${issue.scope}-${issue.semanticField}-${index}`} className="rounded-xl bg-white/80 px-3 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">{issue.scope}</div>
                  <div className="mt-1 text-sm text-[var(--on-surface)]">{issue.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
