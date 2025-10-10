---
name: docs-update
description: Updates README.md and documentation files in /docs to reflect latest changes.
arguments:
  - name: scope
    description: Specific documentation area to update (e.g., API, architecture, guides).
    required: false
---

## Context
Update the README.md and other documentation files to reflect the latest changes in the project.

## Instructions
1. **Look in /docs** and subdirectories for .md files to update (or specific scope: `{{scope}}`).
2. **Follow the structure and style** of existing documentation.
3. **Use clear and concise language** following docs/claude-style guidelines.
4. **Update README.md** if required to reflect major changes.
