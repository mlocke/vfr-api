Claude Code Documentation Standards
Context Optimization Guidelines
This project uses streamlined documentation optimized for AI reasoning efficiency. All documentation should follow these standards to maximize Claude Code's effectiveness while minimizing context token usage.
Writing Standards
✅ INCLUDE (Essential for Development)

Architecture details: File structures, data flows, system design
Technical specifications: APIs, dependencies, configurations
Development workflows: Setup commands, testing procedures, deployment steps
File paths and locations: Exact paths for navigation
Code examples: Working snippets and implementation patterns
Configuration requirements: Environment variables, API keys, database setup
Integration points: How modules connect and communicate

❌ REMOVE (Context-Heavy, Low Value)

Marketing language: "Revolutionary," "breakthrough," competitive positioning
Status celebrations: Achievement announcements, milestone celebrations
Verbose explanations: Obvious concepts explained at length
Business metrics: Revenue projections, valuations (unless technically relevant)
Redundant descriptions: Information repeated across multiple sections
Historical updates: "Latest developments" and changelog-style content

📏 LENGTH GUIDELINES

One-liner descriptions: For simple concepts, prefer single sentences
Bullet points over paragraphs: Use lists for scannable information
Code blocks: Prefer working examples over lengthy explanations
Headers: Use descriptive headers for quick navigation

Context Efficiency Principles
Token Optimization

Prefer specific terms over general ones ("FastAPI endpoint" not "API functionality")
Use exact file paths instead of vague references ("src/api/routes.py" not "the routes file")
Include version numbers and specific configurations when relevant

Information Hierarchy

Lead with most critical information (what/where/how)
Technical implementation before conceptual explanation
Current state before future plans

Document Structure Template
markdown# [Module/Feature Name]

## Purpose
[1-2 sentence technical description]

## Architecture
[File structure, dependencies, data flow]

## Implementation
[Key files, code examples, configuration]

## Usage
[Commands, API endpoints, integration steps]
Context Reduction Targets

Target Reduction: 60-70% fewer tokens while preserving 100% technical utility
Information Density: Every sentence should provide actionable development information
Scannable Format: Use headers, bullet points, code blocks for quick navigation

File Naming Conventions

Technical docs: [feature]-implementation.md
Optimized versions: [original-name]-optimized.md

## Testing and Validation
-Test outputs: Always save to /docs/test-output/
-Test outcomes: Always save to /docs/test-outcomes/

## Screenshots
-Always use puppeteer for screenshots
-Save to /docs/screenshots/

## Subagents
-**IMPORTANT**-
-For every task, analyze if an existing subagent can be used. If not, RECOMMEND creating one. 
-DO NOT create a new subagent without explicit user approval.
-When asked what is the next step, use the technical docs expert agent to determine next steps.
-- For documentation tasks, ALWAYS use the technical docs expert agent.
-- For UX/UI tasks, ALWAYS use the UX/UI expert agent.
-- For testing tasks, ALWAYS use the testing expert agent.
-- For API tasks, ALWAYS use the API expert agent.
-- For research tasks, ALWAYS use the research expert agent.
-- For performance tasks, ALWAYS use the performance expert agent.
-- For finance tasks, ALWAYS use the finance expert agent.
-- For security tasks, ALWAYS use the security expert agent.
-**END IMPORTANT**

## Validation Checklist
Before finalizing any documentation, verify it contains:

All necessary file paths for code navigation
Complete setup/configuration instructions
Architecture understanding for system integration
No marketing language or business positioning
No redundant information found elsewhere
Actionable development information in every section

Reference Examples

README.md: Optimized from 15,000+ words to focused technical overview
CLAUDE.md: Streamlined project context with essential development info
Both files demonstrate 70% context reduction with zero loss of technical utility

Implementation Notes

Apply these standards when creating new documentation
When updating existing docs, prioritize high-traffic files first
Consider consolidating related information to reduce file proliferation
Archive business-focused content to separate /docs/business/ folder if needed