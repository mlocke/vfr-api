# Financial Data Collectors

A comprehensive suite of modular data collectors for aggregating financial and economic data from various public APIs and government sources. Built for the Stock Picker Financial Analysis Platform.

## 🎯 Overview

This module provides a standardized, plug-and-play architecture for collecting financial data from 80+ different sources. Each collector implements a consistent interface with built-in:

- **Rate limiting** and API quota management
- **Data validation** and quality checks  
- **Error handling** with exponential backoff
- **Caching** for performance optimization
- **Comprehensive logging** and monitoring

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Basic Usage

```python
from data_collectors.government import SECEdgarCollector, FREDCollector
from data_collectors.base import CollectorConfig, DateRange
from datetime import date, timedelta

# Initialize SEC EDGAR collector (no API key needed)
sec_collector = SECEdgarCollector()

# Get company financial facts
facts = sec_collector.get_company_facts("AAPL")
print(f"Retrieved facts for {facts['entityName']}")

# Initialize FRED collector (requires free API key)
config = CollectorConfig(api_key="your_fred_api_key")
fred_collector = FREDCollector(config)

# Get economic data
date_range = DateRange(
    start_date=date.today() - timedelta(days=365),
    end_date=date.today()
)

economic_data = fred_collector.collect_batch(
    symbols=["UNRATE", "GDP", "FEDFUNDS"],
    date_range=date_range
)
```

## 📦 Available Collectors

### Government Sources (Free/Low-cost)

| Collector | Description | API Key Required | Rate Limit |
|-----------|-------------|------------------|------------|
| **SEC EDGAR** | Public company filings, 10-K/10-Q reports | ❌ No | 10 req/sec |
| **FRED** | 800K+ economic indicators from Federal Reserve | ✅ Free | 120 req/min |
| **Treasury Direct** | US Treasury securities, bonds, auction data | ❌ No | 60 req/min |

### Market Data Sources (Paid)

| Collector | Description | API Key Required | Rate Limit |
|-----------|-------------|------------------|------------|
| **Alpha Vantage** | Real-time stocks, forex, crypto | ✅ Paid | 5 req/min (free) |
| **IEX Cloud** | Professional market data | ✅ Paid | Varies by plan |
| **Polygon.io** | Comprehensive financial data | ✅ Paid | 5 req/min (free) |

### News & Sentiment Sources

| Collector | Description | API Key Required | Rate Limit |
|-----------|-------------|------------------|------------|
| **News API** | Financial news aggregation | ✅ Paid | 1000 req/day (free) |
| **Reddit** | Social sentiment from r/investing | ✅ Free | 60 req/min |

## 🏗️ Architecture

### Base Interface

All collectors implement the `DataCollectorInterface`:

```python
class DataCollectorInterface(ABC):
    def authenticate() -> bool
    def collect_batch(symbols, date_range, frequency) -> DataFrame
    def collect_realtime(symbols) -> Iterator[Dict]
    def get_available_symbols() -> List[Dict]
    def validate_symbols(symbols) -> Dict[str, bool]
    def get_rate_limits() -> Dict
    def test_connection() -> Dict
```

### Directory Structure

```
backend/data_collectors/
├── base/                    # Core interfaces and utilities
│   ├── collector_interface.py    # Standard collector interface
│   ├── rate_limiter.py           # Rate limiting utilities
│   ├── data_validator.py         # Data quality validation
│   └── error_handler.py          # Error handling & retry logic
├── government/              # Government data sources
│   ├── sec_edgar_collector.py    # SEC EDGAR filings
│   ├── fred_collector.py         # Federal Reserve data
│   └── treasury_direct_collector.py  # Treasury securities
├── market_data/            # Commercial market data
│   ├── alpha_vantage_collector.py
│   ├── iex_cloud_collector.py
│   └── polygon_collector.py
├── news_sentiment/         # News and sentiment data
│   ├── news_api_collector.py
│   └── reddit_collector.py
├── examples/               # Usage examples and demos
└── tests/                  # Comprehensive test suite
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with your API keys:

```bash
# Government APIs (some require free registration)
FRED_API_KEY=your_fred_api_key_here

# Market Data APIs (require paid subscriptions)  
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
IEX_CLOUD_API_KEY=your_iex_cloud_key_here
NEWS_API_KEY=your_news_api_key_here
```

### Collector Configuration

```python
from data_collectors.base import CollectorConfig

# Production configuration
config = CollectorConfig(
    api_key="your_api_key",
    timeout=30,
    max_retries=3,
    requests_per_minute=100,
    cache_enabled=True,
    cache_ttl=300,
    validate_data=True,
    log_level="INFO"
)

# Development configuration  
dev_config = CollectorConfig(
    timeout=10,
    max_retries=1,
    requests_per_minute=30,
    log_level="DEBUG"
)
```

## 📊 Usage Examples

### SEC EDGAR - Company Analysis

```python
from data_collectors.government import SECEdgarCollector

collector = SECEdgarCollector()

# Get company financial facts
facts = collector.get_company_facts("AAPL")

# Access financial metrics
us_gaap = facts['facts']['us-gaap']
revenue_data = us_gaap.get('Revenues', {})

# Get recent filings
date_range = DateRange(
    start_date=date(2024, 1, 1),
    end_date=date.today()
)

filings = collector.collect_batch(
    symbols=["AAPL", "MSFT"],
    date_range=date_range,
    data_type="filings"
)

print(f"Found {len(filings)} recent filings")
```

### FRED - Economic Analysis

```python
from data_collectors.government import FREDCollector

collector = FREDCollector(config)

# Get popular economic indicators
indicators = collector.get_popular_indicators()

# Collect unemployment and GDP data
economic_data = collector.collect_batch(
    symbols=["UNRATE", "GDP"],
    date_range=date_range,
    frequency=DataFrequency.MONTHLY
)

# Get latest observations
latest_unemployment = collector.get_latest_observation("UNRATE")
print(f"Current unemployment rate: {latest_unemployment['value']}%")
```

### Treasury Direct - Bond Analysis

```python
from data_collectors.government import TreasuryDirectCollector

collector = TreasuryDirectCollector()

# Get yield curve data
yields = collector.collect_batch(
    symbols=["1 Yr", "10 Yr", "30 Yr"],
    date_range=date_range,
    data_type="daily_treasury_yield"
)

# Analyze yield curve
yield_curve = yields.pivot(columns='symbol', values='value')
current_curve = yield_curve.iloc[-1]

print("Current Treasury Yield Curve:")
for maturity, yield_rate in current_curve.items():
    print(f"{maturity}: {yield_rate:.2f}%")
```

### Real-time Data Streaming

```python
# Stream real-time data (where available)
for data_point in collector.collect_realtime(symbols=["AAPL"]):
    print(f"Real-time update: {data_point}")
    
    # Process data point
    if data_point['data_type'] == 'filing':
        print(f"New filing: {data_point['form_type']}")
```

## 🛡️ Error Handling & Reliability

### Built-in Error Handling

```python
from data_collectors.base import ErrorHandler, RetryConfig

# Configure retry behavior
retry_config = RetryConfig(
    max_attempts=5,
    initial_delay=1.0,
    backoff_factor=2.0,
    retry_on=(NetworkError, APILimitError)
)

error_handler = ErrorHandler(retry_config)

# Automatic retry on failure
@error_handler.handle_with_retry
def collect_data():
    return collector.collect_batch(symbols, date_range)
```

### Rate Limiting

```python
from data_collectors.base import RateLimiter, RateLimitConfig

# Configure rate limiting
rate_config = RateLimitConfig(
    requests_per_second=5,
    requests_per_minute=300,
    burst_limit=10
)

rate_limiter = RateLimiter(rate_config)

# Check if request can proceed
can_proceed, wait_time = rate_limiter.can_proceed()
if not can_proceed:
    print(f"Rate limited. Wait {wait_time} seconds.")
```

### Data Validation

```python
from data_collectors.base import DataValidator

validator = DataValidator()

# Validate collected data
report = validator.validate(dataframe)

if report.is_valid:
    print("✅ Data passed all validation checks")
else:
    print(f"❌ Found {report.error_count} validation errors")
    for issue in report.issues:
        print(f"   {issue.level}: {issue.message}")
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
python -m pytest tests/

# Run specific collector tests
python -m pytest tests/test_sec_edgar_collector.py

# Run with coverage
python -m pytest tests/ --cov=data_collectors --cov-report=html
```

### Demo Scripts

Try the example demos:

```bash
# Government collectors demo
python examples/government_collectors_demo.py

# Market data collectors demo  
python examples/market_data_demo.py

# Combined analysis example
python examples/combined_analysis_demo.py
```

## 📈 Performance & Monitoring

### Built-in Metrics

```python
# Get collector performance stats
stats = collector.get_error_stats()
rate_status = collector.get_rate_limits()

print(f"Total errors: {stats['total_errors']}")
print(f"Current rate limit: {rate_status['can_proceed']}")
```

### Caching for Performance

```python
# Configure caching
config = CollectorConfig(
    cache_enabled=True,
    cache_ttl=300  # 5 minutes
)

# Cached requests return immediately
data1 = collector.collect_batch(symbols, date_range)  # API call
data2 = collector.collect_batch(symbols, date_range)  # From cache
```

## 🔐 Security Best Practices

### API Key Management

- Store API keys in environment variables only
- Use different keys for development/production
- Rotate keys regularly
- Monitor API key usage

### Data Privacy

- Cache only non-sensitive data
- Implement data retention policies
- Log collection activities appropriately
- Follow GDPR/privacy regulations

## 🆘 Getting API Keys

### Free Government APIs

1. **FRED API**: https://fred.stlouisfed.org/docs/api/api_key.html
   - Free registration required
   - Instant approval
   - 120 requests/minute limit

2. **SEC EDGAR**: No registration required
   - Rate limited to 10 requests/second
   - Must include User-Agent header

3. **Treasury Direct**: No registration required  
   - No explicit rate limits
   - Be respectful with request frequency

### Paid Market Data APIs

1. **Alpha Vantage**: https://www.alphavantage.co/support/#api-key
   - Free tier: 5 calls/minute, 500 calls/day
   - Paid plans available

2. **IEX Cloud**: https://iexcloud.io/
   - Usage-based pricing
   - Free tier available

3. **News API**: https://newsapi.org/
   - 1000 requests/day free
   - Paid plans for production use

## 🐛 Troubleshooting

### Common Issues

**Rate Limiting Errors**
```python
# Check rate limit status
status = collector.get_rate_limits()
if not status['can_proceed']:
    wait_time = status['wait_time']
    print(f"Rate limited. Wait {wait_time} seconds.")
```

**Authentication Failures**  
```python
# Test authentication
if not collector.authenticate():
    print("Authentication failed. Check your API key.")
    connection_info = collector.test_connection()
    print(f"Error details: {connection_info}")
```

**Data Validation Issues**
```python
# Get detailed validation report
report = validator.validate(data)
for issue in report.issues:
    if issue.level == ValidationLevel.ERROR:
        print(f"Critical: {issue.message}")
```

### Debug Mode

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Enable debug logging for detailed output
config.log_level = "DEBUG"
collector = SECEdgarCollector(config)
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch
3. Add your collector following the standard interface
4. Include comprehensive tests
5. Update documentation
6. Submit a pull request

### Adding New Collectors

1. Create new collector class implementing `DataCollectorInterface`
2. Add to appropriate category directory
3. Include configuration example
4. Write comprehensive tests
5. Add usage examples
6. Update this README

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: Check the `/examples` directory for detailed usage examples
- **Issues**: Report bugs and feature requests on GitHub Issues
- **API Keys**: See the "Getting API Keys" section above

---

**⚠️ Legal Disclaimer**: This platform is for educational and informational purposes only. All investment decisions should be made in consultation with qualified financial advisors. Past performance does not guarantee future results.