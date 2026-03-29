import { useSyncExternalStore } from "react";

export type RepositoryMode = "mock" | "graph-mock" | "graph-live" | "jira-mock" | "jira-live" | "github-mock" | "github-live";

type RuntimeSettingsState = {
  repositoryMode: RepositoryMode;
};

type RuntimeSettingsSnapshot = RuntimeSettingsState & {
  setRepositoryMode: (mode: RepositoryMode) => void;
};

const storageKey = "piper.repository-mode";
const envDefault = (import.meta.env.VITE_PIPER_REPOSITORY_MODE as RepositoryMode | undefined) ?? "mock";
const state: RuntimeSettingsState = {
  repositoryMode: envDefault,
};
const listeners = new Set<() => void>();
let hydrated = false;
const snapshot: RuntimeSettingsSnapshot = {
  repositoryMode: state.repositoryMode,
  setRepositoryMode,
};

function updateSnapshot() {
  snapshot.repositoryMode = state.repositoryMode;
}

function emitChange() {
  updateSnapshot();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function hydrate() {
  if (hydrated || typeof window === "undefined") {
    hydrated = true;
    updateSnapshot();
    return;
  }
  hydrated = true;
  const stored = window.localStorage.getItem(storageKey) as RepositoryMode | null;
  if (stored === "mock" || stored === "graph-mock" || stored === "graph-live" || stored === "jira-mock" || stored === "jira-live" || stored === "github-mock" || stored === "github-live") {
    state.repositoryMode = stored;
  }
  updateSnapshot();
}

function setRepositoryMode(mode: RepositoryMode) {
  hydrate();
  if (state.repositoryMode === mode) {
    return;
  }
  state.repositoryMode = mode;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, mode);
  }
  emitChange();
}

function getSnapshot(): RuntimeSettingsSnapshot {
  hydrate();
  return snapshot;
}

export function useRuntimeSettings() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
