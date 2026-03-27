import { useSyncExternalStore } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { getMicrosoftAuthConfig } from "@/features/auth/auth-config";

async function authModule() {
  return import("@/features/auth/microsoft-auth");
}

export type MicrosoftAuthStatus = "unavailable" | "signed-out" | "signing-in" | "signed-in" | "error";

type AuthState = {
  status: MicrosoftAuthStatus;
  configured: boolean;
  account: AccountInfo | null;
  error: string | null;
};

type AuthSnapshot = AuthState & {
  initialize: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string>;
};

const configured = getMicrosoftAuthConfig() !== null;

const state: AuthState = {
  status: configured ? "signed-out" : "unavailable",
  configured,
  account: null,
  error: null,
};

const listeners = new Set<() => void>();
let initialized = false;
const snapshot: AuthSnapshot = {
  status: state.status,
  configured: state.configured,
  account: state.account,
  error: state.error,
  initialize,
  signIn,
  signOut,
  getAccessToken,
};

function updateSnapshot() {
  snapshot.status = state.status;
  snapshot.configured = state.configured;
  snapshot.account = state.account;
  snapshot.error = state.error;
}

function emitChange() {
  updateSnapshot();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function initialize() {
  if (initialized) {
    return;
  }
  initialized = true;

  if (!state.configured) {
    state.status = "unavailable";
    emitChange();
    return;
  }

  try {
    const { getPrimaryMicrosoftAccount } = await authModule();
    const account = await getPrimaryMicrosoftAccount();
    state.account = account;
    state.status = account ? "signed-in" : "signed-out";
    state.error = null;
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.message : "Failed to initialize Microsoft auth.";
  }

  emitChange();
}

async function signIn() {
  if (!state.configured) {
    state.status = "unavailable";
    emitChange();
    return;
  }

  state.status = "signing-in";
  state.error = null;
  emitChange();

  try {
    const { getPrimaryMicrosoftAccount, signInWithMicrosoft } = await authModule();
    const result = await signInWithMicrosoft();
    state.account = result.account ?? (await getPrimaryMicrosoftAccount());
    state.status = state.account ? "signed-in" : "signed-out";
    state.error = null;
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.message : "Microsoft sign-in failed.";
  }

  emitChange();
}

async function signOut() {
  try {
    const { signOutMicrosoft } = await authModule();
    await signOutMicrosoft();
    state.account = null;
    state.status = state.configured ? "signed-out" : "unavailable";
    state.error = null;
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.message : "Microsoft sign-out failed.";
  }

  emitChange();
}

async function getAccessToken() {
  const { acquireMicrosoftGraphAccessToken } = await authModule();
  return acquireMicrosoftGraphAccessToken();
}

function getSnapshot(): AuthSnapshot {
  return snapshot;
}

export function useAuthStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
