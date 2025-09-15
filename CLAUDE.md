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

## Market Intelligence Interface Guidelines

**UI Architecture:**
- `app/page.tsx` - Fixed-position navigation button (top-right, z-index 1100)
- `app/stock-intelligence/page.tsx` - Three-column analysis platform
- `useStockSelection` hook - Real-time state management with 3s update intervals
- Glassmorphism design pattern - backdrop-blur, rgba backgrounds, border glow effects

**Navigation Component:**
- Fixed positioning: `top: 65px, right: 20px`
- Responsive text: "Market Intelligence" (desktop) / "Intelligence" (mobile)
- Hover animations: glow expansion, transform translateY(-1px)
- Brain emoji icon (🧠) with red accent borders

**Platform Layout:**
- StockSelectionPanel: Configuration and controls
- Status panel: Loading states with animated spinners
- SelectionResults: Analysis output display
- Background animation: Particle system consistency with homepage

**Performance Targets:**
- Real-time updates: 3-second refresh intervals
- Component initialization: <500ms mount time
- Navigation transition: 300ms cubic-bezier animation
- Responsive breakpoints: sm (640px) for text switching