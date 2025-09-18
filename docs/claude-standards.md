# Claude Code Documentation Standards

## Format Standards
- **Server**: `localhost:3000` or `veritak-api.local` for development
- **Tests**: Save outputs to `/docs/test-output/`
- **Screenshots**: Use puppeteer or playwright, save to `/docs/screenshots/`
- **Structure**: Lead with file paths, use bullet points over paragraphs

## Agent Execution Patterns
- **Single Task**: Request → Agent → Result
- **Parallel**: Complex Request → Multiple Agents → Integration
- **Sequential**: Research → Planning → Implementation → Testing

## Validation Requirements
- Complete file paths for navigation
- Working setup instructions
- Architecture understanding
- Actionable development information only
- ALWAYS use real data sources (APIs, databases) - NEVER mock data