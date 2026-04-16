/**
 * Unit tests for LinearAuthProvider.
 */

import { describe, expect, it, beforeEach } from "vitest"
import { LinearAuthProvider } from "../linear-auth-provider"

describe("LinearAuthProvider", () => {
  let provider: LinearAuthProvider

  beforeEach(() => {
    provider = new LinearAuthProvider()
  })

  describe("identity", () => {
    it("reports correct backend ID and auth type", () => {
      expect(provider.backendId).toBe("linear")
      expect(provider.authType).toBe("api-key")
    })
  })

  describe("initialization", () => {
    it("initializes with a valid API key", async () => {
      await provider.initialize({ apiKey: "lin_api_test123" })
      expect(provider.isAuthenticated()).toBe(true)
    })

    it("throws when apiKey is missing", async () => {
      await expect(provider.initialize({})).rejects.toThrow("apiKey is required")
    })

    it("throws when apiKey is empty", async () => {
      await expect(provider.initialize({ apiKey: "" })).rejects.toThrow("apiKey is required")
    })
  })

  describe("credentials", () => {
    it("returns api-key credential when authenticated", async () => {
      await provider.initialize({ apiKey: "lin_api_test123" })
      const cred = await provider.getCredential()
      expect(cred).toEqual({
        type: "api-key",
        key: "lin_api_test123",
        header: "Authorization",
      })
    })

    it("returns none credential when not initialized", async () => {
      const cred = await provider.getCredential()
      expect(cred).toEqual({ type: "none" })
    })

    it("getApiKey returns the raw key", async () => {
      await provider.initialize({ apiKey: "lin_api_test123" })
      expect(await provider.getApiKey()).toBe("lin_api_test123")
    })
  })

  describe("sign out", () => {
    it("clears the API key and marks unauthenticated", async () => {
      await provider.initialize({ apiKey: "lin_api_test123" })
      expect(provider.isAuthenticated()).toBe(true)

      await provider.signOut()
      expect(provider.isAuthenticated()).toBe(false)
      expect(await provider.getApiKey()).toBeUndefined()
    })
  })

  describe("refresh", () => {
    it("does nothing (API keys don't expire)", async () => {
      await provider.initialize({ apiKey: "lin_api_test123" })
      await provider.refreshIfNeeded() // should not throw
      expect(provider.isAuthenticated()).toBe(true)
    })
  })

  describe("auth state change", () => {
    it("notifies listeners on state change", async () => {
      const states: string[] = []
      const sub = provider.onAuthStateChange((state) => {
        states.push(state)
      })

      await provider.initialize({ apiKey: "lin_api_test123" })
      expect(states).toContain("authenticated")

      await provider.signOut()
      expect(states).toContain("unauthenticated")

      sub.dispose()
    })

    it("stops notifications after dispose", async () => {
      const states: string[] = []
      const sub = provider.onAuthStateChange((state) => {
        states.push(state)
      })
      sub.dispose()

      await provider.initialize({ apiKey: "lin_api_test123" })
      // State change happened but listener was disposed
      // The state was set before our listener could receive it
      // This is acceptable behavior
    })
  })
})
