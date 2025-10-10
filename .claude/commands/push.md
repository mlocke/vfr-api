---
name: push
description: Pushes all commits from the current branch to the remote repository.
arguments:
  - name: force
    description: Whether to force push (use with caution).
    required: false
---

## Context
Push all commits from the current branch to the remote repository. All commits should already be done.

## Instructions
1. **Run git push** to push the current branch to remote.
2. **Be verbose** about the operation and output.
3. **If force is specified** (`{{force}}`), use git push --force (use with extreme caution).
4. **Display the result** of the push operation.
