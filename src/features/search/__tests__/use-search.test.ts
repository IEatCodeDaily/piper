import { describe, it, expect } from "vitest";
import { useDebounce, useSearch } from "../use-search";
import { renderHook, act } from "@testing-library/react";

describe("useDebounce", () => {
  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("should debounce value changes", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "first", delay: 100 } }
    );

    expect(result.current).toBe("first");

    rerender({ value: "second", delay: 100 });
    expect(result.current).toBe("first");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(result.current).toBe("second");
  });

  it("should use the latest value after rapid changes", async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 50 } }
    );

    rerender({ value: "b", delay: 50 });
    rerender({ value: "c", delay: 50 });
    rerender({ value: "d", delay: 50 });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current).toBe("d");
  });
});

describe("useSearch", () => {
  it("should initialize with empty query", () => {
    const { result } = renderHook(() => useSearch(300));
    expect(result.current.searchQuery).toBe("");
  });

  it("should update search query immediately", () => {
    const { result } = renderHook(() => useSearch(300));

    act(() => {
      result.current.setSearchQuery("test query");
    });

    expect(result.current.searchQuery).toBe("test query");
  });

  it("should clear search query", () => {
    const { result } = renderHook(() => useSearch(300));

    act(() => {
      result.current.setSearchQuery("something");
    });
    expect(result.current.searchQuery).toBe("something");

    act(() => {
      result.current.clearSearch();
    });
    expect(result.current.searchQuery).toBe("");
  });
});
