# ADR-002: Mandatory Test-Driven Development (TDD) Policy

**Status:** Accepted
**Date:** 2026-03-27
**Author:** Raisal / Zephyr
**Deciders:** Engineering Team

## Context

Piper aims to become a daily-use desktop tool for project and task coordination. It will rely on configuration-driven behavior, external API integration, and complex interactive views. AI-assisted coding increases velocity but also increases the risk of subtle regressions unless guardrails are explicit.

## Decision

TDD is **mandatory** for all contributions to Piper.

### Rules

1. **Tests first** — Write failing tests before implementation code.
2. **Static checks first** — Linting and typechecking must pass before feature work is considered complete.
3. **Test mapping/config behavior** — Any config schema or mapping logic change must add/adjust tests.
4. **Critical flows require stronger coverage** — write-through edits, workspace loading, and view transforms must be tested.

## Consequences

### Positive
- Configuration changes remain safer over time
- Interactive behavior is less likely to regress silently
- AI agents have clearer implementation guardrails

### Negative
- Slower initial iteration
- Some integration behavior may require mocks or sandbox test setup

### Risks
- Shallow tests can create false confidence; focus on meaningful assertions and user-critical flows

## References

- [Testing Strategy](../TESTING.md)
