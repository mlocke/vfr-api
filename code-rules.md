### IMPORTANT CODING `RULES`

- NO ASSUMPTIONS! EVER! EVER! EVER! Do you understand? Ask questions if anything is unclear.
- Always use relevant agents to do the work.
- Employ agents in parallel wherever possible.
- Always follow KISS principles.
- Do what is necessary, but no more.
- Create files or folders that are only strictly necessary.
- NEVER add dependencies unless absolutely necessary.
- NEVER "patch" or "hack" or "quick fix" code. Always find the root cause of issues and fix them properly.
- ALWAYS prefer editing existing code over creating new code unless the files are overly large. Then split them up.
- Attempt to keep files under 300 lines of code. Refactor if necessary.
- ALWAYS write modular, reusable code.
- ALWAYS write code with proper error handling and logging.
- ALWAYS write code with proper input validation and type checking.
- NEVER proactively create documentation files (\*.md) or README files. Only do so if explicitly requested.
- NEVER assume the fix works. Test thoroughly and validate.
- If the issues persist, iterate through the above steps again.
- NO MOCK DATA! EVER! EVER! EVER!

### Code Quality

- `npm run type-check` - TypeScript validation (must pass before commits)
- `npm run lint` - ESLint validation
- `npm run format` - Prettier code formatting
- `npm run format:check` - Check formatting without changes

### TypeScript Configuration

- Strict mode enabled with `strict: true`
- Path aliases configured: `@/*`, `@/app/*`, `@/components/*`, `@/services/*`
- Target ES2017 for compatibility

### Confirm Understanding

- Acknowledge understanding of these coding rules before proceeding with any tasks.
