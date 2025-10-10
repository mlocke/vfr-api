---
name: merge
description: Merges the current branch into main using a merge commit and pushes changes.
arguments:
  - name: target_branch
    description: Target branch to merge into (defaults to main).
    required: false
---

## Context
Merge the current branch into the main branch (or specified target: `{{target_branch}}`), preserving history with a merge commit.

## Instructions
1. **Merge the current branch** into the target branch using a merge commit.
2. **Do NOT continue** if there are merge conflicts.
3. **If merge conflicts occur**, abort the merge and notify the user.
4. **Push the changes** to the remote repository.
5. **Switch back** to the previous branch after merging.
