import { describe, expect, it, vi } from "vitest";
import { createBackendRegistry } from "../backend-registry";
import type { BackendFactory } from "../backend-registry";

function createMockFactory(backendId = "mock"): BackendFactory {
  return {
    createStore: vi.fn(),
    createMapper: vi.fn(),
    createAuthProvider: vi.fn(),
  };
}

describe("createBackendRegistry", () => {
  it("starts with an empty list", () => {
    const registry = createBackendRegistry();
    expect(registry.list()).toEqual([]);
  });

  it("registers and retrieves a factory", () => {
    const registry = createBackendRegistry();
    const factory = createMockFactory("ms-lists");

    registry.register("ms-lists", factory);

    expect(registry.get("ms-lists")).toBe(factory);
    expect(registry.list()).toEqual(["ms-lists"]);
  });

  it("returns undefined for unregistered backends", () => {
    const registry = createBackendRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("supports multiple registrations", () => {
    const registry = createBackendRegistry();
    const msFactory = createMockFactory("ms-lists");
    const sqliteFactory = createMockFactory("sqlite");
    const githubFactory = createMockFactory("github");

    registry.register("ms-lists", msFactory);
    registry.register("sqlite", sqliteFactory);
    registry.register("github", githubFactory);

    expect(registry.list()).toEqual(["ms-lists", "sqlite", "github"]);
    expect(registry.get("ms-lists")).toBe(msFactory);
    expect(registry.get("sqlite")).toBe(sqliteFactory);
    expect(registry.get("github")).toBe(githubFactory);
  });

  it("throws on duplicate registration", () => {
    const registry = createBackendRegistry();
    const factory1 = createMockFactory();
    const factory2 = createMockFactory();

    registry.register("ms-lists", factory1);

    expect(() => registry.register("ms-lists", factory2)).toThrow(
      'Backend "ms-lists" is already registered',
    );
  });
});
