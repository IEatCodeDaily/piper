/**
 * MicrosoftAuthProvider — AuthProvider implementation for Microsoft Graph API.
 *
 * Wraps the existing MSAL-browser-based auth helpers
 * (`src/features/auth/microsoft-auth.ts`) behind the backend-agnostic
 * `AuthProvider` interface so that `MsListsIssueStore` and the `GraphClient`
 * factory can consume authentication without knowing about MSAL internals.
 *
 * Auth flow:
 *   1. On `initialize()`: attempt a silent account lookup from the MSAL cache.
 *      If an account is found the provider transitions to "authenticated".
 *   2. On `getCredential()`: acquire an access token silently (MSAL handles
 *      refresh-token exchange automatically).
 *   3. On `refreshIfNeeded()`: force a silent token acquisition.  If MSAL
 *      throws (interaction_required, consent_required, …) the provider
 *      transitions to "unauthenticated" and notifies listeners.
 *   4. On `signOut()`: delegate to MSAL and transition to "unauthenticated".
 *
 * Token injection:
 *   `getAccessTokenProvider()` returns a zero-argument async function that
 *   resolves to the raw Bearer token string.  Pass this to
 *   `FetchGraphClient({ accessTokenProvider: … })`.
 *
 * NEV-13 — M1: Implement Microsoft Graph API OAuth2 auth flow
 */

import type {
  AuthConfig,
  AuthCredential,
  AuthProvider,
  AuthState,
  AuthType,
  Disposable,
} from "./auth-provider";

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

type InternalState = "initializing" | "authenticated" | "unauthenticated" | "refreshing";

// ---------------------------------------------------------------------------
// MicrosoftAuthProvider
// ---------------------------------------------------------------------------

export class MicrosoftAuthProvider implements AuthProvider {
  readonly backendId = "ms-lists";
  readonly authType: AuthType = "oauth2";

  private _state: InternalState = "unauthenticated";
  private _listeners = new Set<(state: AuthState) => void>();

  // -- Lifecycle -----------------------------------------------------------

  async initialize(_config: AuthConfig): Promise<void> {
    const { getPrimaryMicrosoftAccount } = await import(
      "@/features/auth/microsoft-auth"
    );

    const account = await getPrimaryMicrosoftAccount();
    this._transition(account ? "authenticated" : "unauthenticated");
  }

  async refreshIfNeeded(): Promise<void> {
    if (this._state !== "authenticated") {
      return;
    }

    this._transition("refreshing");

    try {
      const { acquireMicrosoftGraphAccessToken } = await import(
        "@/features/auth/microsoft-auth"
      );
      await acquireMicrosoftGraphAccessToken();
      this._transition("authenticated");
    } catch {
      // Silent refresh failed — interaction will be required on next call.
      this._transition("unauthenticated");
    }
  }

  async signOut(): Promise<void> {
    const { signOutMicrosoft } = await import("@/features/auth/microsoft-auth");
    await signOutMicrosoft();
    this._transition("unauthenticated");
  }

  // -- Credential access ---------------------------------------------------

  async getCredential(): Promise<AuthCredential> {
    if (!this.isAuthenticated()) {
      throw new Error(
        "MicrosoftAuthProvider: not authenticated. Sign in before requesting credentials.",
      );
    }

    const { acquireMicrosoftGraphAccessToken } = await import(
      "@/features/auth/microsoft-auth"
    );
    const token = await acquireMicrosoftGraphAccessToken();
    return { type: "bearer", token };
  }

  // -- Status --------------------------------------------------------------

  isAuthenticated(): boolean {
    return this._state === "authenticated";
  }

  onAuthStateChange(handler: (state: AuthState) => void): Disposable {
    this._listeners.add(handler);
    return {
      dispose: () => {
        this._listeners.delete(handler);
      },
    };
  }

  // -- Token provider (for FetchGraphClient) --------------------------------

  /**
   * Returns a zero-argument async function that resolves to the raw Bearer
   * token string.  Use as:
   *
   *   const graphClient = new FetchGraphClient({
   *     accessTokenProvider: msAuthProvider.getAccessTokenProvider(),
   *   });
   */
  getAccessTokenProvider(): () => Promise<string> {
    return async () => {
      const credential = await this.getCredential();
      if (credential.type !== "bearer") {
        throw new Error("MicrosoftAuthProvider: expected bearer credential.");
      }
      return credential.token;
    };
  }

  // -- Private helpers ------------------------------------------------------

  private _transition(next: InternalState): void {
    this._state = next;

    // Map internal state to the public AuthState enum
    const publicState = internalToPublicState(next);
    if (publicState !== null) {
      this._listeners.forEach((fn) => fn(publicState));
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function internalToPublicState(state: InternalState): AuthState | null {
  switch (state) {
    case "authenticated":
      return "authenticated";
    case "unauthenticated":
      return "unauthenticated";
    case "refreshing":
      return "refreshing";
    case "initializing":
      return null; // Don't emit during init before we know the result
    default:
      return null;
  }
}
