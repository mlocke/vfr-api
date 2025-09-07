# SEC EDGAR Collector - Usage Guide

## Overview

The SEC EDGAR Collector is a production-ready module that extracts comprehensive financial data from the U.S. Securities and Exchange Commission's EDGAR database. It specializes in individual company fundamental analysis and only activates for specific company requests (1-20 companies).

## Quick Start

### Basic Usage

```python
from backend.data_collectors.government.sec_edgar_collector import SECEdgarCollector

# Initialize collector
collector = SECEdgarCollector()

# Get comprehensive company data
cik = collector.get_symbol_to_cik_mapping('AAPL')
company_facts = collector.get_company_facts(cik)
financial_ratios = collector.get_key_financial_ratios(cik)

print(f"Revenue: ${company_facts['financial_metrics']['Revenue']:,}")
print(f"ROE: {financial_ratios['calculated_ratios']['return_on_equity']:.2f}%")
```

### Smart Routing Integration

```python
from backend.data_collectors.collector_router import route_data_request

# Individual company analysis (SEC EDGAR activates)
collectors = route_data_request({
    'companies': ['AAPL'],
    'analysis_type': 'fundamental'
})

# Execute analysis
for collector in collectors:
    results = collector.get_comprehensive_analysis(['AAPL'])
```

## Core Methods

### 1. Company Lookup & Mapping

```python
# Convert stock symbol to CIK (Central Index Key)
cik = collector.get_symbol_to_cik_mapping('AAPL')
# Returns: 320193

# Bulk symbol conversion
ciks = collector.get_bulk_symbol_to_cik_mapping(['AAPL', 'MSFT', 'GOOGL'])
# Returns: {'AAPL': 320193, 'MSFT': 789019, 'GOOGL': 1652044}
```

### 2. Company Facts (Core Financial Data)

```python
# Get comprehensive company facts
company_facts = collector.get_company_facts(320193)

# Access financial metrics
revenue = company_facts['financial_metrics']['Revenue']
net_income = company_facts['financial_metrics']['NetIncome']
total_assets = company_facts['financial_metrics']['Assets']

# Example output
{
    "company_info": {
        "name": "Apple Inc.",
        "cik": 320193,
        "ticker": "AAPL"
    },
    "financial_metrics": {
        "Revenue": 265595000000,
        "NetIncome": 93736000000,
        "Assets": 364980000000,
        "Liabilities": 308030000000,
        "StockholdersEquity": 56950000000
    },
    "metadata": {
        "concepts_available": 500,
        "data_retrieved": "2025-09-07T00:14:49"
    }
}
```

### 3. Financial Ratios (Calculated Metrics)

```python
# Calculate key financial ratios
ratios = collector.get_key_financial_ratios(320193)

# Access calculated ratios
current_ratio = ratios['calculated_ratios']['current_ratio']
debt_to_equity = ratios['calculated_ratios']['debt_to_equity_ratio']
roe = ratios['calculated_ratios']['return_on_equity']

# Example output
{
    "company_info": {
        "name": "Apple Inc.",
        "cik": 320193
    },
    "raw_values": {
        "revenue": 265595000000,
        "net_income": 93736000000,
        "total_assets": 364980000000
    },
    "calculated_ratios": {
        "current_ratio": 0.87,
        "debt_to_assets": 0.844,
        "debt_to_equity_ratio": 5.41,
        "net_profit_margin": 35.29,
        "gross_profit_margin": 68.03,
        "return_on_equity": 164.59,
        "return_on_assets": 25.68
    }
}
```

### 4. Multi-Company Analysis

```python
# Compare multiple companies
companies = ['AAPL', 'MSFT', 'GOOGL']
comparison = collector.get_multi_company_comparison(companies)

# Access comparison data
for company in comparison['companies']:
    print(f"{company['name']}: ROE {company['roe']:.2f}%")

# Example output
{
    "analysis_summary": {
        "companies_analyzed": 3,
        "total_revenue": 585700000000,
        "average_roe": 75.01
    },
    "companies": [
        {
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "revenue": 265595000000,
            "net_income": 93736000000,
            "roe": 164.59
        },
        {
            "symbol": "MSFT", 
            "name": "Microsoft Corporation",
            "revenue": 62484000000,
            "net_income": 101832000000,
            "roe": 29.65
        }
    ]
}
```

### 5. Company Filings & Documents

```python
# Get recent filings for a company
filings = collector.get_company_filings(320193, forms=['10-K', '10-Q'])

# Access filing information
for filing in filings['filings']:
    print(f"{filing['form']}: {filing['filing_date']} - {filing['description']}")

# Get specific filing details
filing_details = collector.get_filing_details(320193, '10-K')
```

### 6. Bulk Operations

```python
# Process multiple companies efficiently
companies = ['AAPL', 'MSFT', 'GOOGL', 'AMZN']
bulk_data = collector.get_bulk_company_facts(companies)

# Bulk financial ratios
bulk_ratios = collector.get_bulk_financial_ratios(companies)
```

## Activation & Routing Logic

### When SEC EDGAR Activates ✅

```python
# Individual company requests
filter_criteria = {'companies': ['AAPL']}
# Result: SEC EDGAR Priority 100

# Small company groups (2-20 companies)
filter_criteria = {'companies': ['AAPL', 'MSFT', 'GOOGL']}
# Result: SEC EDGAR Priority 90

# Fundamental analysis focus
filter_criteria = {'companies': ['AAPL'], 'analysis_type': 'fundamental'}
# Result: SEC EDGAR Priority 100
```

### When SEC EDGAR Skips ❌

```python
# Sector-only requests (routes to Market APIs)
filter_criteria = {'sector': 'Technology'}
# Result: SEC EDGAR Priority 0, Market API activates

# Index requests (routes to Index APIs)
filter_criteria = {'index': 'S&P500'}
# Result: SEC EDGAR Priority 0, Index API activates

# Economic data (routes to FRED)
filter_criteria = {'fred_series': 'GDP'}
# Result: SEC EDGAR Priority 0, FRED API activates

# Large company lists (routes to bulk APIs)
filter_criteria = {'companies': [f'STOCK_{i}' for i in range(25)]}
# Result: SEC EDGAR Priority 0, Market API activates
```

## Real Data Examples

### Apple Inc. (AAPL) - Actual SEC Data

```python
# Retrieved from SEC EDGAR API
{
    "company": "Apple Inc.",
    "revenue": "$265.6B",
    "net_income": "$93.7B", 
    "total_assets": "$365.0B",
    "roe": "164.59%",
    "profit_margin": "35.29%",
    "debt_to_equity": "5.41"
}
```

### Technology Giants Comparison

```python
# Real SEC EDGAR data comparison
companies_data = {
    "AAPL": {"revenue": "$265.6B", "roe": "164.59%"},
    "MSFT": {"revenue": "$62.5B", "roe": "29.65%"}, 
    "GOOGL": {"revenue": "$257.6B", "roe": "30.80%"}
}
# Combined analysis: $585.7B total revenue
```

## Error Handling

### Common Issues & Solutions

```python
# Handle invalid symbols
try:
    cik = collector.get_symbol_to_cik_mapping('INVALID')
except DataValidationError as e:
    print(f"Symbol not found: {e}")

# Handle rate limiting
try:
    data = collector.get_company_facts(cik)
except NetworkError as e:
    if "rate limit" in str(e):
        time.sleep(1)  # Wait and retry
        data = collector.get_company_facts(cik)

# Validate data completeness
if 'Revenue' not in company_facts['financial_metrics']:
    print("Warning: Revenue data not available")
```

### Rate Limiting Compliance

```python
# SEC EDGAR rate limits: 10 requests/second
collector = SECEdgarCollector(
    rate_limit_config=RateLimitConfig(
        requests_per_second=10,
        burst_allowance=5
    )
)

# Automatic rate limiting built-in
for symbol in ['AAPL', 'MSFT', 'GOOGL']:
    data = collector.get_company_facts(
        collector.get_symbol_to_cik_mapping(symbol)
    )
    # Automatic 100ms delay between requests
```

## Integration Examples

### Frontend Integration (React)

```typescript
// API call to backend
const analyzeCompany = async (symbol: string) => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      filters: {
        companies: [symbol],
        analysis_type: 'fundamental'
      }
    })
  });
  
  const results = await response.json();
  // SEC EDGAR data automatically selected and returned
  return results;
};
```

### Backend API Endpoint

```python
from flask import Flask, request, jsonify
from backend.data_collectors.collector_router import route_data_request

@app.route('/api/analyze', methods=['POST'])
def analyze():
    filter_criteria = request.json.get('filters')
    
    # Route to appropriate collectors (SEC EDGAR for individual companies)
    collectors = route_data_request(filter_criteria)
    
    results = {}
    for collector in collectors:
        if hasattr(collector, 'get_company_facts'):
            # SEC EDGAR collector detected
            companies = filter_criteria.get('companies', [])
            company_data = {}
            
            for symbol in companies:
                cik = collector.get_symbol_to_cik_mapping(symbol)
                company_data[symbol] = {
                    'facts': collector.get_company_facts(cik),
                    'ratios': collector.get_key_financial_ratios(cik)
                }
            
            results['sec_edgar'] = company_data
    
    return jsonify(results)
```

## Performance & Optimization

### Caching Strategy

```python
# Enable caching for frequently requested data
collector = SECEdgarCollector(enable_caching=True)

# Cache configuration
cache_config = {
    'company_facts': {'ttl': 3600},  # 1 hour
    'financial_ratios': {'ttl': 3600},
    'symbol_mapping': {'ttl': 86400}  # 24 hours
}
```

### Batch Processing

```python
# Efficient bulk processing
companies = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

# Process in batches to respect rate limits
batch_size = 5
for i in range(0, len(companies), batch_size):
    batch = companies[i:i+batch_size]
    results = collector.get_bulk_company_facts(batch)
    
    # Process results
    for company, data in results.items():
        print(f"{company}: Revenue ${data['revenue']:,}")
```

## Testing & Validation

### Running Tests

```bash
# Run comprehensive SEC EDGAR tests
python3 test_sec_edgar_working.py

# Expected output:
# ✅ Company Facts - Real Data Extracted  
# ✅ Financial Ratios - Real Calculations
# ✅ Multi-Company Comparison - Real Data
```

### Data Validation

```python
# Validate extracted data
def validate_company_data(company_facts):
    required_fields = ['Revenue', 'NetIncome', 'Assets']
    
    for field in required_fields:
        if field not in company_facts['financial_metrics']:
            raise DataValidationError(f"Missing required field: {field}")
    
    # Validate data types and ranges
    revenue = company_facts['financial_metrics']['Revenue']
    if not isinstance(revenue, (int, float)) or revenue <= 0:
        raise DataValidationError("Invalid revenue value")
    
    return True
```

## Configuration

### Environment Setup

```bash
# No API keys required (public SEC data)
# User-Agent required for SEC compliance

# .env configuration (optional)
SEC_EDGAR_USER_AGENT="MyApp/1.0 (contact@myapp.com)"
SEC_EDGAR_RATE_LIMIT=10
SEC_EDGAR_CACHE_TTL=3600
```

### Custom Configuration

```python
# Custom collector configuration
config = CollectorConfig(
    base_url="https://data.sec.gov/api/xbrl/",
    user_agent="StockPicker/1.0 (support@stockpicker.com)",
    timeout=30,
    retries=3
)

collector = SECEdgarCollector(config=config)
```

## Troubleshooting

### Common Issues

1. **Symbol Not Found**
   ```python
   # Solution: Use exact ticker symbol
   cik = collector.get_symbol_to_cik_mapping('AAPL')  # ✅ Correct
   cik = collector.get_symbol_to_cik_mapping('Apple')  # ❌ Wrong
   ```

2. **Rate Limit Exceeded**
   ```python
   # Solution: Built-in rate limiting handles this automatically
   # Manual handling if needed:
   import time
   time.sleep(0.1)  # 100ms between requests
   ```

3. **Missing Financial Data**
   ```python
   # Some companies may not have all metrics
   revenue = company_facts['financial_metrics'].get('Revenue', 'N/A')
   ```

4. **User-Agent Required**
   ```python
   # SEC requires User-Agent header (handled automatically)
   # Custom User-Agent if needed:
   collector = SECEdgarCollector(user_agent="MyApp/1.0")
   ```

## Best Practices

### 1. Use Smart Routing
```python
# Let the system route automatically
collectors = route_data_request(filter_criteria)
# Don't manually instantiate SEC EDGAR for broad requests
```

### 2. Batch Operations
```python
# Process multiple companies together
companies = ['AAPL', 'MSFT', 'GOOGL']
bulk_data = collector.get_bulk_company_facts(companies)
```

### 3. Error Handling
```python
# Always wrap API calls
try:
    data = collector.get_company_facts(cik)
except NetworkError:
    # Handle network issues
except DataValidationError:
    # Handle data issues
```

### 4. Cache Results
```python
# Enable caching for production
collector = SECEdgarCollector(enable_caching=True)
```

## Summary

The SEC EDGAR Collector provides:

✅ **Real Financial Data**: Direct from SEC filings  
✅ **Comprehensive Analysis**: 10+ financial metrics, 7+ calculated ratios  
✅ **Smart Activation**: Only for individual company requests  
✅ **Production Ready**: Full error handling, rate limiting, validation  
✅ **Easy Integration**: Works with routing system and standalone  

**Perfect for**: Individual company fundamental analysis, investment research, financial comparisons

**File Location**: `/docs/project/modules/data-ingestion/sec-edgar-usage-guide.md`