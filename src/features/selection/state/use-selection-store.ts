import { useSyncExternalStore } from "react";

type SelectionStoreState = {
  selectedTaskId: string | null;
};

type SelectionStoreSnapshot = SelectionStoreState & {
  selectTask: (taskId: string) => void;
  clearSelection: () => void;
};

let state: SelectionStoreState = {
  selectedTaskId: null,
};

let cachedSnapshot: SelectionStoreSnapshot | null = null;

const listeners = new Set<() => void>();

function emitChange() {
  cachedSnapshot = null; // Invalidate cache so next getSnapshot() returns fresh object
  listeners.forEach((listener) => listener());
}

function selectTask(taskId: string) {
  if (state.selectedTaskId === taskId) {
    return;
  }

  state = { ...state, selectedTaskId: taskId };
  emitChange();
}

function clearSelection() {
  if (state.selectedTaskId === null) {
    return;
  }

  state = { ...state, selectedTaskId: null };
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SelectionStoreSnapshot {
  if (cachedSnapshot === null) {
    cachedSnapshot = {
      selectedTaskId: state.selectedTaskId,
      selectTask,
      clearSelection,
    };
  }
  return cachedSnapshot;
}

export function useSelectionStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
