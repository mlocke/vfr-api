---
name: optimize
description: Optimizes documentation files following claude-standards.md, reducing context while preserving technical details.
arguments:
  - name: folder_pattern
    description: The folder pattern to optimize (e.g., "docs/**/*.md").
    required: true
---

## Context
Optimize documentation files following the standards in docs/claude-standards.md to reduce verbose content while preserving all technical specifications.

## Instructions
1. **Target files** matching the pattern: `{{folder_pattern}}`.
2. **Remove** verbose explanations, marketing language, and celebration content.
3. **Preserve ALL** technical specifications, file paths, and implementation details.
4. **Maintain** architecture diagrams and code examples completely.
5. **Target** 60-70% context reduction while keeping 100% development utility.
6. **Create** optimized versions with '_optimized' suffix for comparison.

**Focus on:**
- File structures and navigation paths
- Development workflows and commands
- Configuration requirements and dependencies
- Integration points and API specifications
- Code examples and implementation patterns

**Remove:**
- Marketing positioning and competitive analysis
- Achievement announcements and status celebrations
- Redundant information found in other files
- Business metrics unless technically relevant
- Verbose explanations of obvious concepts

7. **Validate** that optimized versions still contain everything needed for development work.
