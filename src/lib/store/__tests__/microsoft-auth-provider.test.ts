/**
 * MicrosoftAuthProvider — unit tests
 *
 * These tests mock the MSAL module boundary so they run without a real browser
 * or Azure AD tenant.  The contract under test is the AuthProvider interface.
 *
 * NEV-13 — M1: Microsoft Graph API OAuth2 auth flow
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Stub the feature/auth/microsoft-auth module before importing the provider
// ---------------------------------------------------------------------------
const mockGetPrimaryAccount = vi.fn();
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockAcquireToken = vi.fn();

vi.mock("@/features/auth/microsoft-auth", () => ({
  isMicrosoftAuthConfigured: vi.fn(() => true),
  getMicrosoftAccounts: vi.fn(async () => []),
  getPrimaryMicrosoftAccount: mockGetPrimaryAccount,
  signInWithMicrosoft: mockSignIn,
  signOutMicrosoft: mockSignOut,
  acquireMicrosoftGraphAccessToken: mockAcquireToken,
}));

vi.mock("@/features/auth/auth-config", () => ({
  getMicrosoftAuthConfig: vi.fn(() => ({
    clientId: "test-client-id",
    tenantId: "test-tenant-id",
    redirectUri: "piper://auth/callback",
    scopes: ["User.Read", "Sites.Read.All", "Lists.ReadWrite"],
  })),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are registered
// ---------------------------------------------------------------------------
import { MicrosoftAuthProvider } from "../microsoft-auth-provider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeAccount = (id = "user-1", name = "Alice") => ({
  homeAccountId: id,
  localAccountId: id,
  environment: "login.microsoftonline.com",
  tenantId: "test-tenant",
  username: `${name.toLowerCase()}@contoso.com`,
  name,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MicrosoftAuthProvider — identity", () => {
  it("reports backendId = 'ms-lists' and authType = 'oauth2'", () => {
    const provider = new MicrosoftAuthProvider();
    expect(provider.backendId).toBe("ms-lists");
    expect(provider.authType).toBe("oauth2");
  });
});

describe("MicrosoftAuthProvider — initialize()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions to authenticated when an account exists in cache", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    expect(provider.isAuthenticated()).toBe(true);
  });

  it("stays unauthenticated when no cached account is found", async () => {
    mockGetPrimaryAccount.mockResolvedValue(null);
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    expect(provider.isAuthenticated()).toBe(false);
  });

  it("notifies state-change listeners during init", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    const provider = new MicrosoftAuthProvider();
    const listener = vi.fn();
    provider.onAuthStateChange(listener);
    await provider.initialize({});
    expect(listener).toHaveBeenCalledWith("authenticated");
  });
});

describe("MicrosoftAuthProvider — getCredential()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a bearer token when authenticated", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    mockAcquireToken.mockResolvedValue("access-token-abc");
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    const credential = await provider.getCredential();
    expect(credential).toEqual({ type: "bearer", token: "access-token-abc" });
  });

  it("throws when called while unauthenticated", async () => {
    mockGetPrimaryAccount.mockResolvedValue(null);
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    await expect(provider.getCredential()).rejects.toThrow();
  });
});

describe("MicrosoftAuthProvider — refreshIfNeeded()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acquires a new token silently when authenticated", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    mockAcquireToken.mockResolvedValue("refreshed-token");
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    await provider.refreshIfNeeded();
    expect(mockAcquireToken).toHaveBeenCalled();
    expect(provider.isAuthenticated()).toBe(true);
  });

  it("is a no-op when not authenticated", async () => {
    mockGetPrimaryAccount.mockResolvedValue(null);
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    await provider.refreshIfNeeded();
    // Should not throw and should remain unauthenticated
    expect(provider.isAuthenticated()).toBe(false);
  });

  it("transitions to 'unauthenticated' and emits when silent refresh fails", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    mockAcquireToken.mockRejectedValue(new Error("interaction_required"));
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});

    const listener = vi.fn();
    provider.onAuthStateChange(listener);
    await provider.refreshIfNeeded();

    expect(provider.isAuthenticated()).toBe(false);
    expect(listener).toHaveBeenCalledWith("unauthenticated");
  });
});

describe("MicrosoftAuthProvider — signOut()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls signOutMicrosoft and transitions to unauthenticated", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    mockSignOut.mockResolvedValue(undefined);
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    await provider.signOut();
    expect(mockSignOut).toHaveBeenCalled();
    expect(provider.isAuthenticated()).toBe(false);
  });

  it("notifies listeners on sign-out", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    mockSignOut.mockResolvedValue(undefined);
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    const listener = vi.fn();
    provider.onAuthStateChange(listener);
    await provider.signOut();
    expect(listener).toHaveBeenCalledWith("unauthenticated");
  });
});

describe("MicrosoftAuthProvider — onAuthStateChange()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a disposable that stops future notifications", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    mockSignOut.mockResolvedValue(undefined);
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});

    const listener = vi.fn();
    const sub = provider.onAuthStateChange(listener);
    sub.dispose();

    await provider.signOut();
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports multiple simultaneous listeners", async () => {
    mockGetPrimaryAccount.mockResolvedValue(null);
    const provider = new MicrosoftAuthProvider();
    const l1 = vi.fn();
    const l2 = vi.fn();
    provider.onAuthStateChange(l1);
    provider.onAuthStateChange(l2);
    await provider.initialize({});
    expect(l1).toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
  });
});

describe("MicrosoftAuthProvider — getAccessTokenProvider()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a callable that resolves to the bearer token string", async () => {
    mockGetPrimaryAccount.mockResolvedValue(makeAccount());
    mockAcquireToken.mockResolvedValue("provider-token-xyz");
    const provider = new MicrosoftAuthProvider();
    await provider.initialize({});
    const tokenFn = provider.getAccessTokenProvider();
    const token = await tokenFn();
    expect(token).toBe("provider-token-xyz");
  });
});
