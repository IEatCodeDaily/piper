# Piper — Live Microsoft Graph Smoke Test

## Goal

Validate that Piper can authenticate against a real Microsoft Entra app registration and read SharePoint List-backed workspace data through Microsoft Graph using the `graph-live` runtime mode.

## Required Environment

Set these values in a local `.env` file or runtime environment:

```bash
VITE_PIPER_REPOSITORY_MODE=graph-live
VITE_ENTRA_CLIENT_ID=<entra-app-client-id>
VITE_ENTRA_TENANT_ID=<tenant-id-or-domain>
VITE_ENTRA_REDIRECT_URI=http://localhost:1420
VITE_ENTRA_SCOPES=User.Read,Sites.Read.All,Lists.ReadWrite
```

## Expected Entra Setup

Your Entra app should support:
- public client / SPA-style auth as needed for local development
- redirect URI matching `VITE_ENTRA_REDIRECT_URI`
- delegated Microsoft Graph permissions:
  - `User.Read`
  - `Sites.Read.All`
  - `Lists.ReadWrite`

You may need admin consent depending on tenant policy.

## Workspace Config Requirements

The imported or built-in workspace config must contain:
- valid SharePoint `site.id`
- valid `list.id` for both projects and tasks
- field mappings whose `sourceField` names match actual SharePoint internal column names

Before live smoke testing, validate that the config matches the target lists.

## Recommended Smoke Sequence

### 1. Install and start Piper web runtime
```bash
cd ~/repo/piper
bun install
bun run dev:web
```

### 2. Confirm runtime mode
Inside Piper:
- switch Repository mode to `Graph Live`
- verify runtime panel shows `graph-live`

### 3. Sign in with Microsoft
Inside Piper:
- click `Sign in Microsoft`
- complete login popup
- verify account is shown in runtime panel

Expected result:
- auth status becomes `signed-in`
- no runtime auth error is shown

### 4. Validate workspace mapping
Inside Piper:
- import a workspace config if needed
- check the validation panel

Expected result:
- validation passes, or shows clear missing source-field issues

### 5. Read workspace data
Expected result:
- workspace loads successfully
- list/kanban/timeline/my-tasks views render
- project/task counts reflect live list data
- comments render for items that already have list comments

### 6. Exercise write-through placeholder path
Current expected behavior:
- runtime plumbing exists for repository updates
- live Graph repository write-through still needs final real Graph mutation methods
- mock/graph-mock write-through is useful for local validation of UI behavior

## Failure Checklist

If login fails:
- verify client ID / tenant ID
- verify redirect URI registration
- verify popup blockers are not interfering
- verify delegated scopes are consented

If validation fails:
- compare `sourceField` names in config with actual SharePoint internal names
- ensure project/task lists are the intended lists

If workspace loads but views are empty:
- verify list IDs are correct
- verify signed-in user has access to the site and lists
- verify mapped fields exist and are populated in source data

If comments do not appear:
- verify the target lists/items actually have comments
- verify the Graph comments endpoint is supported and accessible for the tenant/list type

## Current Scope Note

Piper currently supports:
- live auth foundation
- live Graph repository boot path
- realistic Graph schema validation
- mock and graph-mock repository modes

The next live-Graph milestone after smoke testing is:
- real Graph mutation support for updating tasks and creating comments.
