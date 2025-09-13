claude --files "{folder_pattern}" "Please optimize these documentation files following the standards in docs/claude-standards.md.

Requirements:
1. Remove verbose explanations, marketing language, and celebration content
2. Preserve ALL technical specifications, file paths, and implementation details
3. Maintain architecture diagrams and code examples completely
4. Target 60-70% context reduction while keeping 100% development utility
5. Create optimized versions with '_optimized' suffix for comparison

Focus on:
- File structures and navigation paths
- Development workflows and commands
- Configuration requirements and dependencies
- Integration points and API specifications
- Code examples and implementation patterns

Remove:
- Marketing positioning and competitive analysis
- Achievement announcements and status celebrations
- Redundant information found in other files
- Business metrics unless technically relevant
- Verbose explanations of obvious concepts

Validate that optimized versions still contain everything needed for development work."