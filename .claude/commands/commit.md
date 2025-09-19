## When run, it git adds, git commits and git pushes the current branch.
1. Run git status to see the current state of the repository.
   - If there are no changes to commit, output "No changes to commit." and exit.
2. Run git add from the root. 
   - Examine the output for any errors and if any files or folders need to be added to .gitignore. Do a git status. Understand the current state and branch.
   - If there are no changes to commit, output "No changes to commit." and exit.
3. If there are changes to commit, create a meaningful commit message based on the changes.
   - The messages should be composed like this: [branch-name] - <description of changes>.
   - For example, if the branch is feature/add-login and the changes include adding login functionality, the commit message should be: [feature/add-login] - main work finished.
4. Push the commit to the remote repository.
   - Output the result of the push command.
