import { useSyncExternalStore } from "react";
import type { WorkspaceConfig } from "@/features/workspaces/types";
import { parseWorkspaceConfigJson } from "@/features/workspaces/loaders";
import { workspaceFixtures } from "@/features/workspaces/fixtures";

const storageKey = "piper.imported-workspaces";

type WorkspaceCatalogState = {
  imported: WorkspaceConfig[];
};

type WorkspaceCatalogSnapshot = {
  workspaces: WorkspaceConfig[];
  imported: WorkspaceConfig[];
  importWorkspaceConfigFromJson: (raw: string) => WorkspaceConfig;
  removeImportedWorkspace: (workspaceId: string) => void;
};

const builtInWorkspaces = Object.values(workspaceFixtures);
const state: WorkspaceCatalogState = { imported: [] };
const listeners = new Set<() => void>();
let hydrated = false;
const snapshot: WorkspaceCatalogSnapshot = {
  workspaces: [...builtInWorkspaces],
  imported: [],
  importWorkspaceConfigFromJson,
  removeImportedWorkspace,
};

function updateSnapshot() {
  snapshot.imported = [...state.imported];
  snapshot.workspaces = [...builtInWorkspaces, ...state.imported];
}

function emitChange() {
  updateSnapshot();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persist() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(state.imported));
}

function hydrate() {
  if (hydrated || typeof window === "undefined") {
    hydrated = true;
    updateSnapshot();
    return;
  }

  hydrated = true;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    updateSnapshot();
    return;
  }

  try {
    const parsed = JSON.parse(raw) as unknown[];
    state.imported = parsed.map((entry) => parseWorkspaceConfigJson(JSON.stringify(entry)));
  } catch {
    state.imported = [];
  }

  updateSnapshot();
}

function importWorkspaceConfigFromJson(raw: string) {
  hydrate();
  const config = parseWorkspaceConfigJson(raw);
  const withoutExisting = state.imported.filter((workspace) => workspace.workspace.id !== config.workspace.id);
  state.imported = [...withoutExisting, config];
  persist();
  emitChange();
  return config;
}

function removeImportedWorkspace(workspaceId: string) {
  hydrate();
  state.imported = state.imported.filter((workspace) => workspace.workspace.id !== workspaceId);
  persist();
  emitChange();
}

function getSnapshot(): WorkspaceCatalogSnapshot {
  hydrate();
  return snapshot;
}

export function useWorkspaceCatalog() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
