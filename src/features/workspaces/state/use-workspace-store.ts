import { useSyncExternalStore } from "react";

type WorkspaceStoreState = {
  activeWorkspaceId: string | null;
};

type WorkspaceStoreSnapshot = WorkspaceStoreState & {
  setActiveWorkspaceId: (workspaceId: string) => void;
  reset: () => void;
};

const state: WorkspaceStoreState = {
  activeWorkspaceId: null,
};

const listeners = new Set<() => void>();
const snapshot: WorkspaceStoreSnapshot = {
  activeWorkspaceId: state.activeWorkspaceId,
  setActiveWorkspaceId,
  reset,
};

function updateSnapshot() {
  snapshot.activeWorkspaceId = state.activeWorkspaceId;
}

function emitChange() {
  updateSnapshot();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setActiveWorkspaceId(workspaceId: string) {
  if (state.activeWorkspaceId === workspaceId) {
    return;
  }

  state.activeWorkspaceId = workspaceId;
  emitChange();
}

function reset() {
  if (state.activeWorkspaceId === null) {
    return;
  }

  state.activeWorkspaceId = null;
  emitChange();
}

function getSnapshot(): WorkspaceStoreSnapshot {
  return snapshot;
}

export function useWorkspaceStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
