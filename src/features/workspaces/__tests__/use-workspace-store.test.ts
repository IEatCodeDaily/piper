import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkspaceStore } from "../../workspaces/state/use-workspace-store";

describe("useWorkspaceStore", () => {
  it("returns a stable snapshot reference across consecutive calls when state has not changed", () => {
    const { result, rerender } = renderHook(() => useWorkspaceStore());

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });

  it("initially has activeWorkspaceId as null", () => {
    const { result } = renderHook(() => useWorkspaceStore());
    expect(result.current.activeWorkspaceId).toBeNull();
  });

  it("setActiveWorkspaceId updates the active workspace", () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => {
      result.current.setActiveWorkspaceId("ws-1");
    });

    expect(result.current.activeWorkspaceId).toBe("ws-1");
  });

  it("reset clears the active workspace", () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => {
      result.current.setActiveWorkspaceId("ws-1");
    });
    expect(result.current.activeWorkspaceId).toBe("ws-1");

    act(() => {
      result.current.reset();
    });
    expect(result.current.activeWorkspaceId).toBeNull();
  });

  it("returns stable reference after state change and rerender", () => {
    const { result, rerender } = renderHook(() => useWorkspaceStore());

    act(() => {
      result.current.setActiveWorkspaceId("ws-99");
    });

    rerender();
    const ref1 = result.current;
    rerender();
    const ref2 = result.current;

    expect(ref1).toBe(ref2);
    expect(ref1.activeWorkspaceId).toBe("ws-99");
  });
});
