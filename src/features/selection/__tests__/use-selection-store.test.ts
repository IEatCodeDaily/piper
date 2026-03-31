import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSelectionStore } from "../state/use-selection-store";

describe("useSelectionStore", () => {
  it("returns a stable snapshot reference across consecutive calls when state has not changed", () => {
    const { result, rerender } = renderHook(() => useSelectionStore());

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });

  it("initially has selectedTaskId as null", () => {
    const { result } = renderHook(() => useSelectionStore());
    expect(result.current.selectedTaskId).toBeNull();
  });

  it("selectTask updates selectedTaskId", () => {
    const { result } = renderHook(() => useSelectionStore());

    act(() => {
      result.current.selectTask("task-1");
    });

    expect(result.current.selectedTaskId).toBe("task-1");
  });

  it("clearSelection resets selectedTaskId to null", () => {
    const { result } = renderHook(() => useSelectionStore());

    act(() => {
      result.current.selectTask("task-1");
    });
    expect(result.current.selectedTaskId).toBe("task-1");

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedTaskId).toBeNull();
  });

  it("returns a stable reference after state change and rerender", () => {
    const { result, rerender } = renderHook(() => useSelectionStore());

    act(() => {
      result.current.selectTask("task-abc");
    });

    rerender();
    const ref1 = result.current;
    rerender();
    const ref2 = result.current;

    expect(ref1).toBe(ref2);
    expect(ref1.selectedTaskId).toBe("task-abc");
  });

  it("selectTask with same id is a no-op (reference stays stable)", () => {
    const { result, rerender } = renderHook(() => useSelectionStore());

    act(() => {
      result.current.selectTask("task-1");
    });

    rerender();
    const before = result.current;

    act(() => {
      result.current.selectTask("task-1");
    });

    // Since the id was the same, emitChange should not have been called
    // and the snapshot reference should still be stable
    rerender();
    const after = result.current;
    expect(before).toBe(after);
  });
});
