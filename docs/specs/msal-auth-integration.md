# Piper — Microsoft MSAL Auth Integration for Tauri v2

> Date: 2026-03-27
> Status: Research complete

## Recommended approach: Manual PKCE OAuth2 ( no MSAL package

**Why no MSAL library:**
- `@azure/msal-browser` assumes a full browser environment ( Tauri's webview fights against it
- `@azure/msal-node` requires Node.js runtime ( not available in Tauri frontend
- `@azure/msal-common` is too low-level to no UI

**Best approach: Manual PKCE Authorization Code + PKKCE Challenge + deep-link redirect**
- App opens system browser to Microsoft login
 Tauri deep-link plugin catches the callback
 Exchanges code for tokens via direct HTTP call
 No library friction

## Key components choices

| Choice | Pros | Notes |
|---|---|---|
| `tauri-plugin-deep-link` v2 | `piper://` custom scheme | Required |
| `keyring` Rust crate | OS-native credential storage | Best security |

## Flow

1. Generate PKCE verifier + challenge
2. Build authorization URL
3. Open system browser via `@tauri-apps/plugin-opener` |
4. Catch deep-link callback in webview |
5. Exchange code for tokens via `fetch()` |
6. Store tokens via Tauri commands ( Rust -> OS keychain) |

## Token injection
- `graphFetch()` wrapper auto-attaches `Bearer` header
- Handles 401 with automatic refresh
- Wire into `FetchGraphClient.accessTokenProvider` callback

 |

## Azure AD App Registration requirements
- Platform: "Mobile and desktop applications"
- redirect URI: `piper://auth/callback`
- Allow public client flows: Yes
- Grant type: Authorization code with PKCE ( no client secret)

## References
- `docs/specs/graph-integration.md` Section 3 (Auth flow)
- `src/services/msal-auth.ts` (full implementation)
- `src/services/graph-auth-fetch.ts` (fetch wrapper)
- `src-tauri/src/auth.rs` (token storage)
