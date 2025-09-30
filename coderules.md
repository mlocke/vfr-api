### IMPORTANT CODING `RULES`
- Always employ all relevant agents in parallel when possible.
- Always follow KISS principles.
- Do what is necessary, but no more.
- NEVER create files or folders that are not strictly necessary.
- NEVER add dependencies unless absolutely necessary.
- ALWAYS prefer editing existing code over creating new code.
- NEVER proactively create documentation files (*.md) or README files. Only do so if explicitly requested.
- NEVER assume the fix works. Test thoroughly and validate.
- If the issues persist, iterate through the above steps again.

### Code Quality
- `npm run type-check` - TypeScript validation (must pass before commits)
- `npm run lint` - ESLint validation
- `npm run format` - Prettier code formatting
- `npm run format:check` - Check formatting without changes

### TypeScript Configuration
- Strict mode enabled with `strict: true`
- Path aliases configured: `@/*`, `@/app/*`, `@/components/*`, `@/services/*`
- Target ES2017 for compatibility
