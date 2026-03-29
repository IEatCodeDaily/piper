import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFilterState } from "../use-filter-state";

describe("useFilterState", () => {
  // 1) Initial state has empty filters
  it("initializes with empty filters", () => {
    const { result } = renderHook(() => useFilterState());

    const { filters } = result.current;
    expect(filters.status).toEqual([]);
    expect(filters.assigneeId).toEqual([]);
    expect(filters.projectId).toEqual([]);
    expect(filters.searchQuery).toBe("");
  });

  // 2) toggleStatusFilter adds/removes status
  it("toggles status filter — adds then removes", () => {
    const { result } = renderHook(() => useFilterState());

    // Add "backlog"
    act(() => {
      result.current.toggleStatusFilter("backlog");
    });
    expect(result.current.filters.status).toEqual(["backlog"]);

    // Add "done"
    act(() => {
      result.current.toggleStatusFilter("done");
    });
    expect(result.current.filters.status).toEqual(["backlog", "done"]);

    // Remove "backlog"
    act(() => {
      result.current.toggleStatusFilter("backlog");
    });
    expect(result.current.filters.status).toEqual(["done"]);
  });

  // 3) toggleAssigneeFilter adds/removes assigneeId
  it("toggles assignee filter — adds then removes", () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.toggleAssigneeFilter("user-1");
    });
    expect(result.current.filters.assigneeId).toEqual(["user-1"]);

    act(() => {
      result.current.toggleAssigneeFilter("user-2");
    });
    expect(result.current.filters.assigneeId).toEqual(["user-1", "user-2"]);

    act(() => {
      result.current.toggleAssigneeFilter("user-1");
    });
    expect(result.current.filters.assigneeId).toEqual(["user-2"]);
  });

  // 4) toggleProjectFilter adds/removes projectId
  it("toggles project filter — adds then removes", () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.toggleProjectFilter("proj-1");
    });
    expect(result.current.filters.projectId).toEqual(["proj-1"]);

    act(() => {
      result.current.toggleProjectFilter("proj-2");
    });
    expect(result.current.filters.projectId).toEqual(["proj-1", "proj-2"]);

    act(() => {
      result.current.toggleProjectFilter("proj-1");
    });
    expect(result.current.filters.projectId).toEqual(["proj-2"]);
  });

  // 5) setSearchQuery sets search query
  it("sets the search query", () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setSearchQuery("urgent bug");
    });
    expect(result.current.filters.searchQuery).toBe("urgent bug");

    act(() => {
      result.current.setSearchQuery("something else");
    });
    expect(result.current.filters.searchQuery).toBe("something else");

    act(() => {
      result.current.setSearchQuery("");
    });
    expect(result.current.filters.searchQuery).toBe("");
  });

  // 6) clearFilters resets all
  it("clears all filters back to defaults", () => {
    const { result } = renderHook(() => useFilterState());

    // Populate every filter slot
    act(() => {
      result.current.toggleStatusFilter("in-progress");
      result.current.toggleAssigneeFilter("user-9");
      result.current.toggleProjectFilter("proj-9");
      result.current.setSearchQuery("find me");
    });

    expect(result.current.filters.status).toEqual(["in-progress"]);
    expect(result.current.filters.assigneeId).toEqual(["user-9"]);
    expect(result.current.filters.projectId).toEqual(["proj-9"]);
    expect(result.current.filters.searchQuery).toBe("find me");

    // Clear
    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters.status).toEqual([]);
    expect(result.current.filters.assigneeId).toEqual([]);
    expect(result.current.filters.projectId).toEqual([]);
    expect(result.current.filters.searchQuery).toBe("");
  });

  // 7) hasActiveFilters is false initially and true after adding a filter
  it("tracks hasActiveFilters correctly", () => {
    const { result } = renderHook(() => useFilterState());

    // Initially false
    expect(result.current.hasActiveFilters).toBe(false);

    // Adding a status makes it true
    act(() => {
      result.current.toggleStatusFilter("backlog");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    // Removing that status makes it false again
    act(() => {
      result.current.toggleStatusFilter("backlog");
    });
    expect(result.current.hasActiveFilters).toBe(false);

    // Adding an assignee makes it true
    act(() => {
      result.current.toggleAssigneeFilter("user-1");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    // Setting a search query keeps it true
    act(() => {
      result.current.clearFilters();
      result.current.setSearchQuery("hello");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    // Clearing resets to false
    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });
});
