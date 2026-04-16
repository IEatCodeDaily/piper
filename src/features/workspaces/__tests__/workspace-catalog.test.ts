import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";

beforeEach(() => {
  localStorage.clear();
});

import { useWorkspaceCatalog } from "../../workspaces/runtime/workspace-catalog";

describe("useWorkspaceCatalog", () => {
  it("returns a stable snapshot reference across consecutive calls when state has not changed", () => {
    const { result, rerender } = renderHook(() => useWorkspaceCatalog());

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });

  it("starts with built-in workspaces and empty imported list", () => {
    const { result } = renderHook(() => useWorkspaceCatalog());
    expect(result.current.workspaces.length).toBeGreaterThan(0);
    expect(result.current.imported).toEqual([]);
  });

  it("snapshot reference remains the same object across multiple rerenders", () => {
    const { result, rerender } = renderHook(() => useWorkspaceCatalog());

    const refs = [];
    for (let i = 0; i < 5; i++) {
      rerender();
      refs.push(result.current);
    }

    // All references must be the same object
    for (let i = 1; i < refs.length; i++) {
      expect(refs[i]).toBe(refs[0]);
    }
  });
});
