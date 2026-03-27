# Piper — Testing Strategy

See [ADR-002: TDD Policy](./adr/002-tdd-policy.md) for the rationale.

## Test Pyramid

```
         ╱╲
        ╱ E2E ╲          Desktop/user flows
       ╱────────╲
      ╱ Integration╲     Graph adapter + config + workspace flows
     ╱──────────────╲
    ╱ Component/Unit  ╲  View logic, mapping logic, UI behavior
   ╱────────────────────╲
  ╱  Lint + Typecheck    ╲
 ╱────────────────────────╲
```

## Test Focus Areas

| Layer | Purpose |
|------|---------|
| Linting | enforce code quality and conventions |
| Typechecking | prevent invalid config/data contracts |
| Unit tests | mapping engine, renderer selection, utility logic |
| Component tests | list/detail/kanban interactions |
| Integration tests | workspace loading, adapter transforms, write-back flows |
| E2E tests | critical user workflows in the desktop app |

## Minimum Coverage Expectations
- New logic should be covered by meaningful tests.
- Mapping/config behavior must be tested when schemas change.
- View interactions that write back to SharePoint should have integration/E2E coverage where practical.

## Example Critical Flows
- load workspace config successfully
- reject invalid config with actionable errors
- render task list from mapped fields
- edit an item and sync the update
- drag a Kanban card and persist status change
- open detail panel and display comments
- switch workspace cleanly
