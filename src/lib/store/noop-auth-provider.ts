/**
 * NoopAuthProvider — Auth provider for backends that require no authentication.
 *
 * Used by local backends (SQLite, in-memory mock, etc.) where there is no
 * credential exchange.
 */

import type {
  AuthConfig,
  AuthCredential,
  AuthProvider,
  AuthState,
  AuthType,
  Disposable,
} from "./auth-provider";

export class NoopAuthProvider implements AuthProvider {
  readonly backendId: string;
  readonly authType: AuthType = "none";

  constructor(backendId: string) {
    this.backendId = backendId;
  }

  async initialize(_config: AuthConfig): Promise<void> {
    // Nothing to initialise.
  }

  async refreshIfNeeded(): Promise<void> {
    // Nothing to refresh.
  }

  async signOut(): Promise<void> {
    // Nothing to clear.
  }

  async getCredential(): Promise<AuthCredential> {
    return { type: "none" };
  }

  isAuthenticated(): boolean {
    return true;
  }

  onAuthStateChange(_handler: (state: AuthState) => void): Disposable {
    // State never changes.
    return { dispose() {} };
  }
}
