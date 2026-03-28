/**
 * IssueSync — Bidirectional delta sync engine between any two IssueStores.
 *
 * The primary use case is syncing between a remote backend (MS Lists, GitHub)
 * and a local cache (SQLite), but the engine is generic — any two IssueStore
 * instances can be a sync pair.
 */

import type { Disposable } from "./auth-provider";
import type { IssueStore, SyncWatermark } from "./types";

// ---------------------------------------------------------------------------
// Sync options
// ---------------------------------------------------------------------------

export type SyncDirection =
  | "source-to-target"
  | "target-to-source"
  | "bidirectional";

export type ConflictStrategy =
  | "source-wins"
  | "target-wins"
  | "last-write-wins"
  | "manual";

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface SyncOptions {
  direction: SyncDirection;
  conflictStrategy: ConflictStrategy;
  batchSize: number;
  retryPolicy: RetryPolicy;
}

// ---------------------------------------------------------------------------
// Conflict resolution
// ---------------------------------------------------------------------------

export interface ConflictRecord {
  entityId: string;
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
  sourceTimestamp: string;
  targetTimestamp: string;
}

export type ConflictResolution = "use-source" | "use-target" | "merge" | "skip";

export type ConflictHandler = (
  conflict: ConflictRecord,
) => Promise<ConflictResolution>;

// ---------------------------------------------------------------------------
// Sync result
// ---------------------------------------------------------------------------

export interface SyncError {
  entityId?: string;
  operation: "pull" | "push" | "conflict-resolve";
  message: string;
  cause?: unknown;
}

export interface SyncResult {
  sourcePulled: number;
  targetPushed: number;
  conflicts: ConflictRecord[];
  errors: SyncError[];
  newWatermark: SyncWatermark;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Sync subscription (for continuous sync)
// ---------------------------------------------------------------------------

export interface SyncSubscription extends Disposable {
  /** Whether continuous sync is currently running. */
  readonly active: boolean;

  /** Pause continuous sync without disposing. */
  pause(): void;

  /** Resume a paused continuous sync. */
  resume(): void;
}

// ---------------------------------------------------------------------------
// IssueSync interface
// ---------------------------------------------------------------------------

export interface IssueSync {
  /** Configure a sync pair between two stores. */
  configure(
    source: IssueStore,
    target: IssueStore,
    options: SyncOptions,
  ): void;

  /** Execute one sync cycle. */
  sync(): Promise<SyncResult>;

  /**
   * Start continuous sync on a polling interval.
   * Returns a subscription that can be paused, resumed, or disposed.
   */
  startContinuousSync(intervalMs: number): SyncSubscription;

  /** Register a conflict handler. */
  onConflict(handler: ConflictHandler): void;
}
