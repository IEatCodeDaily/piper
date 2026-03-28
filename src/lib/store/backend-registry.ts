/**
 * BackendRegistry — Runtime registry of available backend adapters.
 *
 * The workspace config's `backend.type` field selects which adapter to
 * instantiate. The registry holds factories that produce the full adapter
 * stack (IssueStore + SchemaMapper + AuthProvider) for each backend type.
 */

import type { AuthConfig, AuthProvider } from "./auth-provider";
import type { FieldMappingConfig, SchemaMapper } from "./schema-mapper";
import type { BackendConfig, IssueStore } from "./types";

// ---------------------------------------------------------------------------
// Factory interface
// ---------------------------------------------------------------------------

export interface BackendFactory {
  /** Create an IssueStore for this backend. */
  createStore(config: BackendConfig): IssueStore;

  /** Create a SchemaMapper for this backend. */
  createMapper(config: FieldMappingConfig): SchemaMapper;

  /** Create an AuthProvider for this backend. */
  createAuthProvider(config: AuthConfig): AuthProvider;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface BackendRegistry {
  /** Register a new backend factory under the given backend ID. */
  register(backendId: string, factory: BackendFactory): void;

  /** Look up a registered factory. Returns undefined if not registered. */
  get(backendId: string): BackendFactory | undefined;

  /** List all registered backend IDs. */
  list(): string[];
}

/**
 * Default in-memory backend registry.
 *
 * Usage:
 * ```ts
 * const registry = createBackendRegistry();
 * registry.register("ms-lists", msListsFactory);
 * registry.register("sqlite", sqliteFactory);
 *
 * const factory = registry.get("ms-lists");
 * const store = factory?.createStore(config);
 * ```
 */
export function createBackendRegistry(): BackendRegistry {
  const factories = new Map<string, BackendFactory>();

  return {
    register(backendId: string, factory: BackendFactory) {
      if (factories.has(backendId)) {
        throw new Error(
          `Backend "${backendId}" is already registered. Unregister it first or use a different ID.`,
        );
      }
      factories.set(backendId, factory);
    },

    get(backendId: string) {
      return factories.get(backendId);
    },

    list() {
      return Array.from(factories.keys());
    },
  };
}
