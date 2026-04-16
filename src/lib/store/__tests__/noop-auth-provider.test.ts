import { describe, expect, it, vi } from "vitest";
import { NoopAuthProvider } from "../noop-auth-provider";

describe("NoopAuthProvider", () => {
  it("reports backendId and authType", () => {
    const provider = new NoopAuthProvider("sqlite");
    expect(provider.backendId).toBe("sqlite");
    expect(provider.authType).toBe("none");
  });

  it("is always authenticated", () => {
    const provider = new NoopAuthProvider("sqlite");
    expect(provider.isAuthenticated()).toBe(true);
  });

  it("returns a 'none' credential", async () => {
    const provider = new NoopAuthProvider("sqlite");
    const credential = await provider.getCredential();
    expect(credential).toEqual({ type: "none" });
  });

  it("initialize, refreshIfNeeded, signOut are no-ops", async () => {
    const provider = new NoopAuthProvider("sqlite");
    // These should complete without error
    await provider.initialize({});
    await provider.refreshIfNeeded();
    await provider.signOut();
    expect(provider.isAuthenticated()).toBe(true);
  });

  it("onAuthStateChange returns a disposable that does nothing", () => {
    const provider = new NoopAuthProvider("sqlite");
    const handler = vi.fn();
    const subscription = provider.onAuthStateChange(handler);

    // Handler is never called because state never changes
    expect(handler).not.toHaveBeenCalled();

    // Dispose should not throw
    subscription.dispose();
  });
});
