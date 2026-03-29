/**
 * AuthProvider — Pluggable per-backend authentication.
 *
 * Decouples authentication mechanism from data access so each backend can
 * use its own auth flow (OAuth2, API key, local/none) without affecting
 * the rest of the adapter stack.
 */

// ---------------------------------------------------------------------------
// Credential types
// ---------------------------------------------------------------------------

export type AuthCredential =
  | { type: "bearer"; token: string }
  | { type: "api-key"; key: string; header?: string }
  | { type: "none" };

export type AuthState =
  | "authenticated"
  | "expired"
  | "unauthenticated"
  | "refreshing";

export type AuthType = "oauth2" | "token" | "api-key" | "none";

// ---------------------------------------------------------------------------
// Auth configuration (opaque per backend)
// ---------------------------------------------------------------------------

export type AuthConfig = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Disposable subscription handle
// ---------------------------------------------------------------------------

export interface Disposable {
  dispose(): void;
}

// ---------------------------------------------------------------------------
// AuthProvider interface
// ---------------------------------------------------------------------------

export interface AuthProvider {
  /** Must match the companion IssueStore's backendId. */
  readonly backendId: string;

  /** The authentication mechanism used by this backend. */
  readonly authType: AuthType;

  // -- Lifecycle ------------------------------------------------------------

  /** Initialise the auth provider (load cached tokens, start silent flows). */
  initialize(config: AuthConfig): Promise<void>;

  /** Refresh the credential if it is expired or about to expire. */
  refreshIfNeeded(): Promise<void>;

  /** Sign out and clear stored credentials. */
  signOut(): Promise<void>;

  // -- Credential access ----------------------------------------------------

  /** Get the current access credential for API calls. */
  getCredential(): Promise<AuthCredential>;

  // -- Status ---------------------------------------------------------------

  /** Whether the user is currently authenticated. */
  isAuthenticated(): boolean;

  /** Subscribe to auth state transitions. Returns a disposable to unsubscribe. */
  onAuthStateChange(handler: (state: AuthState) => void): Disposable;
}
