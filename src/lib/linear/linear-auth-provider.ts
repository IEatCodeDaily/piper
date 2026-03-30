/**
 * LinearAuthProvider — API key authentication for Linear.
 *
 * Linear uses Personal API Keys which don't expire (the user manages
 * them in Linear settings). The provider stores the key in memory
 * and returns it as a bearer-style credential for the LinearClient.
 */

import type {
  AuthConfig,
  AuthCredential,
  AuthProvider,
  AuthState,
  AuthType,
  Disposable,
} from "@/lib/store/auth-provider"

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

export interface LinearAuthConfig extends AuthConfig {
  /** Linear Personal API Key (from https://linear.app/settings/api) */
  apiKey: string
}

// ---------------------------------------------------------------------------
// LinearAuthProvider
// ---------------------------------------------------------------------------

export class LinearAuthProvider implements AuthProvider {
  readonly backendId = "linear"
  readonly authType: AuthType = "api-key"

  private apiKey: string | null = null
  private state: AuthState = "unauthenticated"
  private listeners: Set<(state: AuthState) => void> = new Set()

  // -- Lifecycle ------------------------------------------------------------

  async initialize(config: AuthConfig): Promise<void> {
    const linearConfig = config as LinearAuthConfig

    if (!linearConfig.apiKey) {
      throw new Error(
        "LinearAuthProvider: apiKey is required in AuthConfig.",
      )
    }

    this.apiKey = linearConfig.apiKey
    this.setState("authenticated")
  }

  async refreshIfNeeded(): Promise<void> {
    // Linear API keys don't expire — nothing to refresh.
  }

  async signOut(): Promise<void> {
    this.apiKey = null
    this.setState("unauthenticated")
  }

  // -- Credential access ----------------------------------------------------

  async getCredential(): Promise<AuthCredential> {
    if (!this.apiKey) {
      return { type: "none" }
    }

    // Linear uses the API key directly as a bearer-like token.
    // The header name is customized by the client (Authorization: <key>).
    return {
      type: "api-key",
      key: this.apiKey,
      header: "Authorization",
    }
  }

  /**
   * Convenience: return the API key string for the LinearClient.
   * The LinearClient expects the raw key in the Authorization header.
   */
  async getApiKey(): Promise<string | undefined> {
    return this.apiKey ?? undefined
  }

  // -- Status ---------------------------------------------------------------

  isAuthenticated(): boolean {
    return this.state === "authenticated" && this.apiKey !== null
  }

  onAuthStateChange(handler: (state: AuthState) => void): Disposable {
    this.listeners.add(handler)
    return {
      dispose: () => {
        this.listeners.delete(handler)
      },
    }
  }

  // -- Internal -------------------------------------------------------------

  private setState(newState: AuthState): void {
    this.state = newState
    for (const listener of this.listeners) {
      listener(newState)
    }
  }
}
