---
name: doc-updater
description: Invokes the doc-updater agent to update documentation based on current work.
arguments:
  - name: context
    description: Additional context about what documentation needs updating.
    required: false
---

## Context
Use the doc-updater agent to update documents pertaining to current work and code changes.

## Instructions
1. **Invoke the doc-updater agent** with context about recent changes.
2. **Provide details** about modified files, features, or systems: `{{context}}`.
3. **Allow the agent** to identify and update relevant documentation files.
