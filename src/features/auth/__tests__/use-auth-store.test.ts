import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the auth config to return null so store starts in "unavailable" state
vi.mock("@/features/auth/auth-config", () => ({
  getMicrosoftAuthConfig: () => null,
}));

import { useAuthStore } from "../../auth/state/use-auth-store";

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a stable snapshot reference across consecutive calls when state has not changed", () => {
    const { result, rerender } = renderHook(() => useAuthStore());

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });

  it("starts in unavailable state when not configured", () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.configured).toBe(false);
    expect(result.current.status).toBe("unavailable");
  });
});
