# Claude Code Documentation Standards

## Content Requirements

✅ **Include:**
- File paths: `src/api/routes.py`, `components/ui/Button.tsx`
- Setup commands: `npm install`, `docker-compose up`
- Code examples with working snippets
- API endpoints and configurations
- Architecture: data flows, dependencies, module connections
- Environment variables and database setup

❌ **Remove:**
- Marketing language: "revolutionary," "breakthrough"
- Business metrics and competitive positioning
- Verbose explanations of obvious concepts
- Historical updates and changelog content
- Redundant information across sections

## Format Standards

- **Server:** Use `localhost:3000` or `veritak.local` for development
- **Tests:** Save outputs to `/docs/test-output/`
- **Screenshots:** Use puppeteer, save to `/docs/screenshots/`
- **Structure:** Lead with file paths, use bullet points over paragraphs
- **Headers:** Descriptive for quick navigation

## Document Template

```markdown
# [Module/Feature Name]

## Purpose
[1 sentence technical description]

## Files
- `path/to/main.file`
- `path/to/config.file`

## Setup
```bash
command to install
command to configure
```

## Usage
[API endpoints, integration steps, code examples]
```

## Mandatory Agents

Use these agents for all relevant tasks:
- `technical-docs-expert` - Documentation creation
- `api-architect` - API design/implementation  
- `ux-ui-specialist` - Interface design
- `performance-optimizer` - Performance analysis
- `code-security-reviewer` - Security review
- `tdd-test-writer` - Test creation
- `research-analyst` - Technical research
- `task-breakdown-planner` - Complex task decomposition

## Agent Execution Patterns

**Single Task:** Request → Agent → Result  
**Parallel:** Complex Request → Multiple Agents → Integration  
**Sequential:** Research → Planning → Implementation → Testing

## Validation

Every document must contain:
- Complete file paths for navigation
- Working setup instructions
- Architecture understanding
- Zero marketing language
- Actionable development information only