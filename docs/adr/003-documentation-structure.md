# ADR-003: Documentation Structure Enforcement

**Status:** Accepted
**Date:** 2026-03-27
**Author:** Raisal / Zephyr
**Deciders:** Engineering Team

## Context

Piper is being built with strong AI-agent assistance. Both humans and agents need reliable project documentation, especially because Piper is configuration-driven and integration-heavy.

## Decision

The documentation hierarchy for Piper is:

```
docs/
├── BRD.md                  # Business requirements — WHAT and WHY
├── ECOSYSTEM_MAP.md        # External systems and dependencies
├── ARCHITECTURE.md         # System design — HOW Piper works
├── DEVELOPMENT.md          # How to work on Piper
├── TESTING.md              # Test strategy
├── changelog.mdx           # User-visible changes
├── adr/                    # Architecture Decision Records
│   └── 000-template.md     # Template for new ADRs
├── specs/                  # Feature specifications
│   └── FEATURE_MAP.md      # Master feature list with priorities
├── plans/                  # Implementation plans
├── mistakes/               # Post-mortem learnings
│   └── TEMPLATE.md         # Template for post-mortems
├── ux/                     # UX designs and user flows
│   ├── user-flows/
│   └── wireframes/
└── legacy/                 # Imported references or prior analysis
```

### Enforcement Rules

1. **Every feature** needs a spec in `docs/specs/{feature-name}.md` before implementation.
2. **Every architectural decision** requires an ADR in `docs/adr/{number}-{slug}.md`.
3. **Every significant mistake** gets a post-mortem in `docs/mistakes/` and a summary in `AGENTS.md`.
4. **User-visible changes** should update `docs/changelog.mdx`.
5. **AGENTS.md** at repo root is the primary instruction file for AI agents.

## Consequences

### Positive
- Agents and humans have a predictable source of truth
- Project knowledge stays organized as Piper grows
- View/config/adapter changes are easier to reason about historically

### Negative
- Documentation overhead per feature/PR

### Risks
- Docs can drift if updates are skipped

## References

- [AGENTS.md](../../AGENTS.md)
- [BRD](../BRD.md)
