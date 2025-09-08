# SEC EDGAR MCP Integration

## Overview

The SEC EDGAR MCP Collector provides AI-native access to official SEC (Securities and Exchange Commission) filing data through the Model Context Protocol (MCP). This integration leverages the official SEC EDGAR MCP server ([stefanoamorelli/sec-edgar-mcp](https://github.com/stefanoamorelli/sec-edgar-mcp)) to deliver institutional-grade financial data with exact precision and comprehensive filing analysis.

## Key Features

### 🏛️ **Official SEC Data**
- Complete SEC EDGAR filings database (1994-present)
- Real-time filing submissions and updates
- Direct XBRL parsing for exact financial precision
- No AI hallucination - deterministic responses only

### 📊 **Comprehensive Financial Data**
- **Company Facts**: Revenue, assets, liabilities, equity with historical trends
- **Financial Statements**: Income statements, balance sheets, cash flow statements
- **Filing Analysis**: 10-K annual reports, 10-Q quarterly reports, 8-K current reports
- **Insider Trading**: Forms 3/4/5 analysis with detailed transaction data

### 🎯 **Intelligent Filtering**
- Follows sophisticated filtering guidelines
- Activates only for specific company analysis (no broad market screening)
- Supports 1-20 companies for optimal performance
- Priority-based activation system

### 🔄 **Hybrid Architecture**
- Primary: MCP server for AI-native data access
- Fallback: Direct SEC API calls for reliability
- Automatic failover and error recovery
- Cost optimization (free public data)

## Installation & Setup

### Prerequisites

```bash
# Install SEC EDGAR MCP Server
pip install sec-edgar-mcp

# Or via Docker (recommended for production)
docker pull stefanoamorelli/sec-edgar-mcp:latest
```

### Environment Configuration

```bash
# Required: SEC User-Agent (must include email contact)
export SEC_EDGAR_USER_AGENT="Your Company Name (contact@yourcompany.com)"

# Optional: Docker preference
export SEC_MCP_USE_DOCKER=true
```

### Code Integration

```python
from backend.data_collectors.government.mcp.sec_edgar_mcp_collector import create_sec_edgar_mcp_collector

# Create collector
collector = create_sec_edgar_mcp_collector("Your Company (contact@example.com)")

# Test connection
connection_status = collector.test_connection()
print(f"Status: {connection_status['status']}")
```

## Usage Examples

### Individual Company Analysis

```python
import asyncio

# Get comprehensive company fundamentals
fundamentals = await collector.get_company_fundamentals("AAPL")
print(f"Revenue: ${fundamentals['financial_metrics']['Revenue']['latest_value']:,}")

# Analyze recent filings
filings = await collector.get_recent_filings("AAPL", form_types=["10-K", "10-Q"])
for filing in filings['recent_filings']:
    print(f"{filing['form']} filed on {filing['filingDate']}")

# Track insider trading
insider_activity = await collector.analyze_insider_trading("AAPL", days=90)
print(f"Found {len(insider_activity['transactions'])} insider transactions")
```

### Batch Company Analysis

```python
# Analyze multiple companies
symbols = ["AAPL", "MSFT", "GOOGL"]
batch_results = collector.collect_batch(symbols, date_range=None, data_type="fundamentals")

print(batch_results[['symbol', 'company_name', 'latest_revenue']])
```

### Financial Statement Analysis

```python
# Get detailed financial statements
statements = await collector.get_financial_statements("AAPL", statement_type="income")

# Analyze 8-K current reports
current_reports = await collector.analyze_8k_filing("AAPL")
```

## Filtering Guidelines & Activation Rules

The SEC EDGAR MCP Collector follows strict activation rules to ensure optimal performance and appropriate use:

### ✅ **ACTIVATES When:**
- **Specific Companies**: Individual tickers/symbols (1-20 companies)
- **SEC-Specific Requests**: Filings, financial statements, insider trading
- **Deep Analysis**: Company facts, business descriptions, XBRL data
- **Regulatory Data**: Forms 10-K, 10-Q, 8-K, 3, 4, 5

### ❌ **DOES NOT Activate When:**
- **Broad Screening**: Sector-only filtering (use market APIs)
- **Index Analysis**: Index-only requests (use index APIs)
- **Market Data**: Real-time prices, technical indicators
- **Economic Data**: Macro indicators (use FRED API)
- **Large Lists**: >20 companies (use bulk market APIs)

### Priority Scoring
- **SEC-Specific Requests**: Priority 100 (highest)
- **Single Company**: Priority 95
- **Small Groups (≤5)**: Priority 85
- **Medium Groups (≤10)**: Priority 75
- **Larger Groups (≤20)**: Priority 65

## API Reference

### Core Methods

#### `get_company_fundamentals(symbol: str)`
```python
result = await collector.get_company_fundamentals("AAPL")
# Returns: company_info, financial_metrics, metadata
```

#### `get_recent_filings(symbol: str, form_types: List[str] = None)`
```python
filings = await collector.get_recent_filings("AAPL", ["10-K", "10-Q"])
# Returns: recent_filings list with dates, forms, accession numbers
```

#### `analyze_insider_trading(symbol: str, days: int = 90)`
```python
insider_data = await collector.analyze_insider_trading("AAPL", days=30)
# Returns: insider transactions, analysis, trends
```

#### `get_financial_statements(symbol: str, statement_type: str = "all")`
```python
statements = await collector.get_financial_statements("AAPL", "income")
# Returns: structured financial statement data
```

### Utility Methods

#### `should_activate(filter_criteria: Dict[str, Any]) -> bool`
```python
# Check if collector should handle this request
activate = collector.should_activate({
    'symbols': ['AAPL', 'MSFT'],
    'data_types': ['filings']
})
```

#### `validate_symbols(symbols: List[str]) -> Dict[str, bool]`
```python
# Validate symbol availability
validation = collector.validate_symbols(['AAPL', 'INVALID'])
# Returns: {'AAPL': True, 'INVALID': False}
```

## Error Handling & Fallback

### Automatic Fallback
The collector implements intelligent fallback to direct SEC API calls:

```python
# If MCP server fails, automatically falls back to SEC API
try:
    result = await collector.call_mcp_tool("get_company_facts", {"ticker": "AAPL"})
except Exception:
    # Automatic fallback to direct SEC API
    result = collector._fallback_api_call("get_company_facts", {"ticker": "AAPL"})
```

### Error Types
- **MCPConnectionError**: MCP server communication issues
- **MCPToolError**: MCP tool execution failures
- **MCPQuotaError**: Rate limit exceeded (handled automatically)
- **ValueError**: Invalid configuration (user agent, etc.)

### Rate Limiting
- **SEC Guidelines**: 10 requests/second maximum
- **No Quotas**: Unlimited requests (free public data)
- **Automatic Throttling**: Built-in rate limit compliance

## Testing

### Run Test Suite
```bash
# Run comprehensive test suite
python -m pytest backend/data_collectors/government/mcp/test_sec_edgar_mcp_collector.py -v

# Test specific functionality
python -m pytest -k "test_filtering_guidelines" -v
```

### Manual Testing
```python
# Test connection
collector = create_sec_edgar_mcp_collector("Test (test@example.com)")
status = collector.test_connection()

# Test tool discovery
tools = await collector.get_available_tools()
print(f"Available tools: {len(tools)}")

# Test filtering
activate = collector.should_activate({'symbols': ['AAPL']})
print(f"Should activate: {activate}")
```

## Integration with Stock Picker Platform

### Four-Quadrant Architecture
The SEC EDGAR MCP Collector integrates seamlessly into the platform's four-quadrant data collection architecture:

```
Government Data Sources:
├── API Collectors (Existing)
│   ├── SEC API Collector          # Direct API access
│   ├── FRED API Collector         # Economic data
│   └── Treasury API Collectors    # Government bonds
└── MCP Collectors (New)
    ├── SEC EDGAR MCP Collector    # AI-native SEC access
    └── FRED MCP Collector         # Future: AI-native economic data
```

### Router Integration
```python
# The platform router automatically selects the appropriate collector
from backend.data_collectors.router import DataCollectorRouter

router = DataCollectorRouter()

# This request activates SEC EDGAR MCP Collector (specific companies)
result = router.collect_data({
    'symbols': ['AAPL', 'MSFT'], 
    'data_types': ['filings', 'financial_statements']
})

# This request uses market APIs instead (broad screening)
result = router.collect_data({
    'sector': 'Technology',
    'market_cap': 'large'
})
```

### Cost Optimization
- **Free Data Source**: No API costs for SEC EDGAR data
- **Intelligent Routing**: Avoids expensive commercial APIs for filing data
- **Efficient Processing**: MCP protocol optimized for AI consumption

## Advanced Configuration

### Docker Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  sec-edgar-mcp:
    image: stefanoamorelli/sec-edgar-mcp:latest
    environment:
      - SEC_EDGAR_USER_AGENT=Stock-Picker Platform (contact@stockpicker.com)
    restart: unless-stopped
```

### Production Settings
```python
# Production configuration
config = CollectorConfig(
    base_url="https://data.sec.gov",
    timeout=60,                    # Longer timeout for large filings
    requests_per_minute=600,       # SEC compliant rate limit
    rate_limit_enabled=True
)

collector = SECEdgarMCPCollector(
    config=config,
    user_agent="Production System (compliance@company.com)"
)
```

### Monitoring & Logging
```python
import logging

# Configure logging for SEC EDGAR operations
logging.getLogger('sec_edgar_mcp').setLevel(logging.INFO)

# Monitor MCP server health
status = collector.test_connection()
if status['status'] != 'connected':
    alert_ops_team(f"SEC EDGAR MCP server down: {status}")
```

## Compliance & Legal

### SEC Requirements
- **User-Agent**: Must include valid email contact
- **Rate Limits**: Maximum 10 requests per second
- **Attribution**: Data sourced from SEC EDGAR database
- **Disclaimer**: For informational purposes only

### Data Usage
- **Public Data**: All SEC EDGAR data is public domain
- **No Licensing**: No API fees or licensing restrictions
- **Real-time**: Data updated as filings are submitted to SEC
- **Accuracy**: Direct XBRL parsing ensures exact precision

### Compliance Code Example
```python
# Ensure compliance with SEC guidelines
collector = SECEdgarMCPCollector(
    user_agent="Your Company (compliance@yourcompany.com)"
)

# Rate limiting automatically enforced
# Attribution included in all responses
# Data validation ensures accuracy
```

## Troubleshooting

### Common Issues

#### 1. MCP Server Won't Start
```bash
# Check if Docker is available
docker --version

# Check if pip package is installed
pip show sec-edgar-mcp

# Install if missing
pip install sec-edgar-mcp
```

#### 2. Invalid User Agent Error
```python
# Must include valid email contact
user_agent = "Company Name (contact@company.com)"  # ✅ Valid
user_agent = "Company Name"                        # ❌ Invalid
```

#### 3. Rate Limiting
```python
# Built-in rate limiting handles SEC guidelines
# No manual intervention needed
# Fallback API provides redundancy
```

#### 4. Tool Discovery Fails
```bash
# Test MCP server manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | docker run -i stefanoamorelli/sec-edgar-mcp:latest
```

### Debug Mode
```python
import logging
logging.basicConfig(level=logging.DEBUG)

collector = create_sec_edgar_mcp_collector("Debug (debug@example.com)")
# Detailed MCP communication logging enabled
```

## Performance Optimization

### Caching Strategy
- **Tool Cache**: 5-minute cache for tool discovery
- **Response Cache**: Consider implementing Redis for production
- **Fallback Cache**: Leverage existing SEC API collector caching

### Batch Processing
```python
# Efficient batch processing for multiple companies
symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
results = collector.collect_batch(symbols, data_type="fundamentals")

# Process results in pandas DataFrame
print(results.head())
```

### Resource Management
```python
# Automatic cleanup on exit
try:
    results = await collector.get_company_fundamentals("AAPL")
finally:
    collector.cleanup()  # Terminates MCP server process
```

---

## Support & Contributing

### Getting Help
- **Documentation**: This README and inline code documentation
- **Test Suite**: Comprehensive test coverage with examples
- **Issues**: Report issues via GitHub Issues
- **Community**: SEC EDGAR MCP community discussions

### Contributing
- Follow existing code patterns and filtering guidelines
- Maintain backward compatibility with SEC API collector
- Add comprehensive tests for new features
- Update documentation for changes

### Version History
- **v1.0**: Initial SEC EDGAR MCP integration
- **v1.1**: Enhanced filtering guidelines compliance
- **v1.2**: Docker deployment support
- **v1.3**: Fallback API integration