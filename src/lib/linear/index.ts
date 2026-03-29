/**
 * Linear adapter — Linear GraphQL API backend for Piper.
 *
 * Phase 5 implementation of the IssueStore adapter layer.
 * Provides full CRUD, sync, and auth for the Linear issue tracker.
 */

// GraphQL client
export { LinearClient, fetchAllPages } from "./linear-client"
export type { LinearClientConfig, LinearApiError, LinearClientLike } from "./linear-client"

// Types
export type {
  LinearUser,
  LinearLabel,
  LinearTeam,
  LinearWorkflowState,
  LinearWorkflowType,
  LinearCycle,
  LinearProject,
  LinearIssue,
  LinearIssuePriority,
  LinearComment,
  LinearPaginationInfo,
  LinearConnection,
  LinearCreateIssueInput,
  LinearUpdateIssueInput,
} from "./linear-types"
export { linearPriorityLabels } from "./linear-types"

// Adapter / mapping functions
export {
  mapLinearUser,
  mapLinearIssueToWorkspaceTask,
  mapLinearProjectToWorkspaceProject,
  mapLinearCommentToCommentRef,
  collectPeopleFromLinearEntities,
  applyProjectTaskAggregates,
  buildLinearBackedWorkspace,
} from "./linear-adapter"

// IssueStore implementation
export { LinearIssueStore } from "./linear-issue-store"
export type { LinearBackendConfig } from "./linear-issue-store"

// Schema mapper
export { LinearSchemaMapper } from "./linear-schema-mapper"
export type { LinearMapperContext } from "./linear-schema-mapper"

// Auth provider
export { LinearAuthProvider } from "./linear-auth-provider"
export type { LinearAuthConfig } from "./linear-auth-provider"

// Repository (PiperRepository implementation)
export { LinearPiperRepository } from "./linear-repository"
