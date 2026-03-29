# ADR-004: Microsoft Graph API OAuth2 Authentication Flow

**Date:** 2026-03-28
**Status:** Accepted
**Deciders:** Ryudo (Workflow Orchestrator), Noovoleum engineering
**Issue:** NEV-13 — M1: Implement Microsoft Graph API OAuth2 auth flow

---

## Context

Piper needs to authenticate with Microsoft Graph API to read and write SharePoint
List items on behalf of the signed-in user (delegated auth).  The codebase already
ships a layered `GraphClient` abstraction that accepts an `accessTokenProvider`
callback — the missing piece is a concrete, testable auth implementation that wires
MSAL token acquisition into that callback.

Two existing approaches existed before this ADR:
1. `src/features/auth/microsoft-auth.ts` — MSAL browser popup flow, used by
   the React UI (`useAuthStore`) for user-facing sign-in/sign-out UX.
2. `src/lib/store/auth-provider.ts` — abstract `AuthProvider` interface used by
   the backend-agnostic store layer.

Neither was connected to the other.  The `createRuntimeRepository` factory
required callers to pass an explicit `accessTokenProvider` callback; no concrete
implementation existed for `graph-live` mode.

---

## Decision

Implement `MicrosoftAuthProvider` (NEV-13) as the bridge between the two layers:

```
useAuthStore (React UI)
    │
    ▼
microsoft-auth.ts (MSAL browser client — popup, silent, logout)
    │
    ▼
MicrosoftAuthProvider (implements AuthProvider interface)
    │  .getAccessTokenProvider() → () => Promise<string>
    ▼
FetchGraphClient({ accessTokenProvider })
    │
    ▼
Microsoft Graph API
```

Key decisions:

### 1. Reuse @azure/msal-browser (popup flow) for now

The spec (`docs/specs/msal-auth-integration.md`) recommends a manual PKCE +
deep-link flow (no MSAL library). However:
- `@azure/msal-browser` is already a declared dependency.
- The existing `microsoft-auth.ts` module uses it and works in Tauri's webview.
- Switching to a manual PKCE + `tauri-plugin-deep-link` flow requires Tauri
  plugin changes, a new Rust auth module, and platform packaging changes that
  are out of scope for the M1 milestone.

The popup flow is accepted for M1.  The manual PKCE flow is deferred to a
follow-up ADR when the Tauri deep-link plugin is integrated.

### 2. MicrosoftAuthProvider is a thin delegation layer

`MicrosoftAuthProvider` does not duplicate MSAL logic.  It calls the existing
functions from `microsoft-auth.ts` via dynamic import and exposes the
`AuthProvider` interface.  This keeps the store layer free of browser/MSAL
dependencies and testable with simple mocks.

### 3. Singleton provider instance in createRuntimeRepository

`getMicrosoftAuthProvider()` returns a shared singleton.  This ensures the
cached MSAL token survives repository re-creation events (workspace switches,
mode changes) without forcing re-authentication.

### 4. getAccessTokenProvider() for FetchGraphClient injection

Rather than passing the `MicrosoftAuthProvider` instance directly to
`FetchGraphClient`, a dedicated `getAccessTokenProvider()` method returns the
typed `() => Promise<string>` callback.  This keeps `FetchGraphClient`
dependency-free from auth types.

---

## Consequences

**Good:**
- `graph-live` mode now works end-to-end without explicit token plumbing from
  the UI layer.
- `AuthProvider` interface has a concrete implementation backed by real MSAL.
- 14 new unit tests covering all auth state transitions.
- Backwards-compatible: callers that pass `accessTokenProvider` explicitly still work.

**Neutral:**
- Still uses popup flow — requires a browser popup window, not ideal for
  desktop UX.  Tracked as future work.

**Risks:**
- If MSAL popup is blocked (Tauri WebView restrictions) users cannot sign in.
  This is mitigated by the existing sign-in UI fallback and will be addressed
  when the deep-link plugin is added.

---

## Follow-up

- [ ] Replace popup flow with manual PKCE + `tauri-plugin-deep-link` (new ADR)
- [ ] Add Rust-side token storage via `keyring` crate
- [ ] Add 401 retry middleware in `FetchGraphClient` using `MicrosoftAuthProvider.refreshIfNeeded()`
