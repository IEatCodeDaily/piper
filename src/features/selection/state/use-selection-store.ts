import { useSyncExternalStore } from "react";

type SelectionStoreState = {
  selectedTaskId: string | null;
};

type SelectionStoreSnapshot = SelectionStoreState & {
  selectTask: (taskId: string) => void;
  clearSelection: () => void;
};

const state: SelectionStoreState = {
  selectedTaskId: null,
};

const listeners = new Set<() => void>();
const snapshot: SelectionStoreSnapshot = {
  selectedTaskId: state.selectedTaskId,
  selectTask,
  clearSelection,
};

function updateSnapshot() {
  snapshot.selectedTaskId = state.selectedTaskId;
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

function selectTask(taskId: string) {
  if (state.selectedTaskId === taskId) {
    return;
  }

  state.selectedTaskId = taskId;
  emitChange();
}

function clearSelection() {
  if (state.selectedTaskId === null) {
    return;
  }

  state.selectedTaskId = null;
  emitChange();
}

function getSnapshot(): SelectionStoreSnapshot {
  return snapshot;
}

export function useSelectionStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
