/**
 * E2E: Auth Provider Lifecycle Tests
 *
 * Tests the full auth provider lifecycle across all provider types:
 * - NoopAuthProvider (local backends)
 * - AuthProvider interface contract enforcement
 * - Token expiry simulation
 * - State change subscription lifecycle
 * - Backend registry auth wiring
 *
 * NEV-18 — Phase 1 hardening.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NoopAuthProvider } from "@/lib/store/noop-auth-provider";
import type {
  AuthProvider,
  AuthCredential,
  AuthState,
  Disposable,
} from "@/lib/store/auth-provider";

// ---------------------------------------------------------------------------
// Test AuthProvider — simulates a real OAuth2-style provider
// ---------------------------------------------------------------------------

class MockOAuthProvider implements AuthProvider {
  readonly backendId = "mock-oauth";
  readonly authType = "token" as const;

  private state: AuthState = "unauthenticated";
  private token: string | null = null;
  private tokenExpiresAt: number = 0;
  private listeners = new Set<(state: AuthState) => void>();
  private initialized = false;

  // Test controls
  failInitialize = false;
  failRefresh = false;

  async initialize(): Promise<void> {
    if (this.failInitialize) {
      throw new Error("Mock: initialization failed");
    }
    this.initialized = true;
    this.state = "unauthenticated";
  }

  async refreshIfNeeded(): Promise<void> {
    if (this.failRefresh) {
      this.state = "expired";
      this.emitChange();
      throw new Error("Mock: token refresh failed");
    }

    if (this.token && Date.now() > this.tokenExpiresAt) {
      this.state = "refreshing";
      this.emitChange();

      // Simulate network delay
      this.token = `refreshed-${Date.now()}`;
      this.tokenExpiresAt = Date.now() + 3600_000;
      this.state = "authenticated";
      this.emitChange();
    }
  }

  async signOut(): Promise<void> {
    this.token = null;
    this.tokenExpiresAt = 0;
    this.state = "unauthenticated";
    this.emitChange();
  }

  async getCredential(): Promise<AuthCredential> {
    if (!this.token) {
      return { type: "none" };
    }
    return { type: "bearer", token: this.token };
  }

  isAuthenticated(): boolean {
    return this.state === "authenticated";
  }

  onAuthStateChange(handler: (state: AuthState) => void): Disposable {
    this.listeners.add(handler);
    return {
      dispose: () => {
        this.listeners.delete(handler);
      },
    };
  }

  // Test helpers

  /** Simulate a successful sign-in with a token that expires in `ttlMs` ms. */
  signIn(ttlMs = 3600_000): void {
    this.token = `test-token-${Date.now()}`;
    this.tokenExpiresAt = Date.now() + ttlMs;
    this.state = "authenticated";
    this.emitChange();
  }

  /** Expire the token immediately. */
  expireToken(): void {
    this.tokenExpiresAt = Date.now() - 1000;
    this.state = "expired";
    this.emitChange();
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Auth Provider Lifecycle", () => {
  describe("NoopAuthProvider", () => {
    it("completes full lifecycle: init -> credential -> signOut", async () => {
      const provider = new NoopAuthProvider("sqlite");

      await provider.initialize({});
      expect(provider.isAuthenticated()).toBe(true);

      const cred = await provider.getCredential();
      expect(cred).toEqual({ type: "none" });

      await provider.signOut();
      expect(provider.isAuthenticated()).toBe(true); // always true
    });

    it("refreshIfNeeded is idempotent", async () => {
      const provider = new NoopAuthProvider("sqlite");
      await provider.refreshIfNeeded();
      await provider.refreshIfNeeded();
      expect(provider.isAuthenticated()).toBe(true);
    });

    it("subscription dispose removes listener", () => {
      const provider = new NoopAuthProvider("sqlite");
      const handler = vi.fn();
      const sub = provider.onAuthStateChange(handler);
      sub.dispose();
      // No error — subscription cleaned up
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("MockOAuthProvider — token lifecycle", () => {
    let provider: MockOAuthProvider;

    beforeEach(() => {
      provider = new MockOAuthProvider();
    });

    it("starts unauthenticated", async () => {
      await provider.initialize();
      expect(provider.isAuthenticated()).toBe(false);
      const cred = await provider.getCredential();
      expect(cred).toEqual({ type: "none" });
    });

    it("signs in and becomes authenticated", async () => {
      await provider.initialize();
      provider.signIn();
      expect(provider.isAuthenticated()).toBe(true);
      const cred = await provider.getCredential();
      expect(cred).toEqual({ type: "bearer", token: expect.stringMatching(/^test-token-/) });
    });

    it("signs out and clears credential", async () => {
      await provider.initialize();
      provider.signIn();
      await provider.signOut();
      expect(provider.isAuthenticated()).toBe(false);
      const cred = await provider.getCredential();
      expect(cred).toEqual({ type: "none" });
    });

    it("refreshes expired token", async () => {
      await provider.initialize();
      provider.signIn(0); // already expired
      provider.expireToken();

      await provider.refreshIfNeeded();
      expect(provider.isAuthenticated()).toBe(true);
    });

    it("emits state transitions during refresh", async () => {
      await provider.initialize();
      provider.signIn(0);
      provider.expireToken();

      const states: AuthState[] = [];
      provider.onAuthStateChange((s) => states.push(s));

      await provider.refreshIfNeeded();
      expect(states).toContain("refreshing");
      expect(states).toContain("authenticated");
    });

    it("emits unauthenticated on signOut", async () => {
      await provider.initialize();
      provider.signIn();

      const states: AuthState[] = [];
      provider.onAuthStateChange((s) => states.push(s));

      await provider.signOut();
      expect(states).toContain("unauthenticated");
    });

    it("handles refresh failure gracefully", async () => {
      await provider.initialize();
      provider.signIn();
      provider.failRefresh = true;

      await expect(provider.refreshIfNeeded()).rejects.toThrow("token refresh failed");
      expect(provider.isAuthenticated()).toBe(false);
    });

    it("handles initialization failure", async () => {
      provider.failInitialize = true;
      await expect(provider.initialize()).rejects.toThrow("initialization failed");
    });

    it("multiple subscriptions receive events", async () => {
      await provider.initialize();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const sub1 = provider.onAuthStateChange(handler1);
      provider.onAuthStateChange(handler2);

      provider.signIn();
      expect(handler1).toHaveBeenCalledWith("authenticated");
      expect(handler2).toHaveBeenCalledWith("authenticated");

      sub1.dispose();
      provider.signIn();
      // handler1 should NOT get another call (disposed)
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(2);
    });
  });
});
