---
name: commit
description: Adds all changes, creates a commit with a meaningful message, and pushes to remote.
arguments:
  - name: message
    description: Optional custom commit message. If not provided, a message will be generated based on changes.
    required: false
---

## Context
Handles the complete git workflow: staging changes, creating commits with branch-prefixed messages, and pushing to remote.

## Instructions
1. **Run git status** to see the current state of the repository.
   - If there are no changes to commit, output "No changes to commit." and exit.
2. **Run git add --all** to stage all changes.
   - Examine the output for any errors and check if files need to be added to .gitignore.
   - Run git status to verify the state and branch.
   - If there are no changes to commit, output "No changes to commit." and exit.
3. **Create a meaningful commit message** based on the changes (or use `{{message}}` if provided).
   - Format: `[branch-name] - <description of changes>`
   - Example: `[feature/add-login] - main work finished`
4. **Push the commit** to the remote repository.
   - Output the result of the push command.
