import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { useRuntimeSettings } from "../../../lib/runtime/runtime-settings";

describe("useRuntimeSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a stable snapshot reference across consecutive calls when state has not changed", () => {
    const { result, rerender } = renderHook(() => useRuntimeSettings());

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });

  it("defaults repositoryMode to mock", () => {
    const { result } = renderHook(() => useRuntimeSettings());
    expect(result.current.repositoryMode).toBe("mock");
  });

  it("setRepositoryMode updates the mode", () => {
    const { result } = renderHook(() => useRuntimeSettings());

    act(() => {
      result.current.setRepositoryMode("graph-live");
    });

    expect(result.current.repositoryMode).toBe("graph-live");
  });

  it("returns stable reference after state change and rerender", () => {
    const { result, rerender } = renderHook(() => useRuntimeSettings());

    act(() => {
      result.current.setRepositoryMode("graph-mock");
    });

    rerender();
    const ref1 = result.current;
    rerender();
    const ref2 = result.current;

    expect(ref1).toBe(ref2);
    expect(ref1.repositoryMode).toBe("graph-mock");
  });
});
