## Documentation Standards for Claude Code

**Context Efficiency Guidelines:**
- All project documentation follows streamlined, context-optimized format
- Marketing language, celebrations, and verbose descriptions removed
- Focus on technical specifications, file paths, and development workflows
- Business metrics included only when technically relevant
- Architecture details and code examples preserved completely
- Read docs/claude-standards.md for full guidelines

**When creating or updating documentation:**
- Follow the concise style demonstrated in README.md and CLAUDE.md
- Prioritize information density over comprehensive explanations
- Remove redundant status updates and achievement language
- Maintain complete technical accuracy while minimizing token usage

**Reference Examples:**
- README.md: See optimized structure with 70% context reduction
- CLAUDE.md: See streamlined format focusing on development essentials

## Stock Selection Engine Development Guidelines

**Architecture Integration:**
- `StockSelectionService` - Main orchestration layer
- `AlgorithmIntegration` - Interfaces with Algorithm Engine
- `SectorIntegration` - Sector-based analysis
- `DataFlowManager` - Request/response optimization

**API Development:**
- `/api/stocks/select` - Unified endpoint for all selection modes
- Request validation via Zod schemas
- Response streaming for large datasets
- Service pooling and connection management

**Performance Requirements:**
- <30s timeout for complex multi-stock analysis
- <5s response for single stock queries
- 75%+ cache hit rate for repeated requests
- Request queuing with priority optimization

**Testing Standards:**
- All selection modes (single, multi, sector) must be tested
- Performance benchmarks required for response times
- Integration tests with MCP data sources
- Error handling validation for timeout/rate limiting scenarios

**Integration Patterns:**
- Use `createStockSelectionService` factory function
- Implement `DataIntegrationInterface` for new data sources
- Follow event-driven architecture for status updates
- Cache keys generated via `SelectionConfigManager`