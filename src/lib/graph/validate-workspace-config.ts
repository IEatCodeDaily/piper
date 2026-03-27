import type { WorkspaceConfig, WorkspaceEntityScope } from "@/features/workspaces/types"
import type { GraphClient } from "@/lib/graph/graph-client"

export interface WorkspaceGraphValidationIssue {
  scope: WorkspaceEntityScope
  semanticField?: string
  sourceField?: string
  message: string
}

export interface WorkspaceGraphValidationResult {
  ok: boolean
  issues: WorkspaceGraphValidationIssue[]
}

export async function validateWorkspaceConfigAgainstGraph(
  workspaceConfig: WorkspaceConfig,
  graphClient: GraphClient,
): Promise<WorkspaceGraphValidationResult> {
  const issues: WorkspaceGraphValidationIssue[] = []

  for (const scope of ["projects", "tasks"] as WorkspaceEntityScope[]) {
    const listConfig = workspaceConfig.lists[scope]
    const columns = await graphClient.listColumns({
      siteId: listConfig.site.id,
      listId: listConfig.list.id,
      label: listConfig.list.label,
    })
    const columnNames = new Set(columns.value.map((column) => column.name))

    for (const [semanticField, mapping] of Object.entries(listConfig.fields)) {
      if (!columnNames.has(mapping.sourceField)) {
        issues.push({
          scope,
          semanticField,
          sourceField: mapping.sourceField,
          message: `Mapped source field '${mapping.sourceField}' is not present in Graph column metadata for ${scope}.`,
        })
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}
