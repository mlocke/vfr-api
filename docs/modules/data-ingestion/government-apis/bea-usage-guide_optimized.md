# BEA Economic Data Collector - Usage Guide

## Overview

The Bureau of Economic Analysis (BEA) Collector extracts economic data from the U.S. Bureau of Economic Analysis API. Specializes in GDP analysis, regional economics, and industry metrics.

**Status**: Operational - API authenticated and streaming data

## Quick Start

```python
from backend.data_collectors.government.bea_collector import BEACollector

# Initialize collector
collector = BEACollector()

# Get quarterly GDP data
gdp_data = collector.get_gdp_data(frequency='Q', years=['2024'])

# Get regional economic data
regional_data = collector.get_regional_data(geography_type='state', years=['2023'])

# Get comprehensive analysis
summary = collector.get_comprehensive_economic_summary()
```

### Smart Routing Integration

```python
from backend.data_collectors.collector_router import route_data_request

# GDP analysis (BEA activates)
collectors = route_data_request({
    'gdp': 'quarterly_analysis',
    'analysis_type': 'economic'
})

# Execute analysis
for collector in collectors:
    results = collector.get_comprehensive_economic_summary()
```

## Core Methods

### 1. GDP Data Analysis (NIPA Tables)

```python
gdp_data = collector.get_gdp_data(
    frequency='Q',  # 'Q' for quarterly, 'A' for annual
    years=['2022', '2023', '2024'],
    table='gdp_summary'
)

# Available GDP tables
table_options = [
    'gdp_summary',           # Main GDP data
    'gdp_components',        # GDP components breakdown
    'personal_income',       # Personal Income data
    'personal_consumption',  # Personal Consumption Expenditures
    'corporate_profits',     # Corporate Profits
    'government_receipts',   # Government Current Receipts
    'government_expenditures' # Government Current Expenditures
]

# Output structure
{
    "data_type": "BEA GDP Data - gdp_summary",
    "source": "U.S. Bureau of Economic Analysis",
    "gdp_analysis": {
        "table_type": "gdp_summary",
        "frequency": "Q",
        "latest_values": [
            {
                "year": "2024Q2",
                "value": "27000000",
                "line_description": "Gross domestic product",
                "series_code": "A191RC"
            }
        ]
    }
}
```

### 2. Regional Economic Data

```python
regional_data = collector.get_regional_data(
    geography_type='state',      # 'state', 'county', 'metro'
    metric='personal_income',    # Economic metric
    years=['2023', '2024']
)

# Output structure
{
    "data_type": "BEA Regional Data - state personal_income",
    "source": "U.S. Bureau of Economic Analysis",
    "regional_analysis": {
        "geography_type": "state",
        "metric": "personal_income",
        "top_regions": [
            {
                "region": "California",
                "value": "3200000",
                "year": "2024",
                "code": "06000"
            }
        ]
    }
}
```

### 3. Industry GDP Analysis

```python
industry_data = collector.get_industry_gdp_data(
    industry_level='sector',  # 'sector', 'subsector', 'detail'
    years=['2023', '2024']
)

# Output structure
{
    "data_type": "BEA Industry GDP Data - sector",
    "source": "U.S. Bureau of Economic Analysis",
    "industry_analysis": {
        "industry_level": "sector",
        "top_industries": [
            {
                "industry": "Finance and insurance",
                "value": "1800000",
                "year": "2024",
                "industry_code": "52"
            }
        ]
    }
}
```

### 4. Comprehensive Economic Summary

```python
summary = collector.get_comprehensive_economic_summary()

# Output structure
{
    "analysis_type": "Comprehensive BEA Economic Analysis",
    "economic_highlights": {
        "gdp_summary": {"latest_period": "2024Q2", "latest_value": "27000"},
        "regional_overview": {"regions_analyzed": 51, "top_region": "California"},
        "industry_performance": {"industries_analyzed": 20, "top_industry": "Finance"}
    },
    "investment_context": {
        "economic_trends": [
            "GDP trend analysis based on latest BEA data",
            "Economic growth patterns from national accounts"
        ],
        "regional_opportunities": [
            "Regional economic performance variations",
            "Geographic diversification opportunities"
        ],
        "market_considerations": [
            "Monitor GDP components for economic cycle positioning",
            "Consider regional economic variations for geographic allocation"
        ]
    }
}
```

## Activation & Routing Logic

### When BEA Activates

```python
# GDP analysis requests - Priority 90
filter_criteria = {'gdp': 'quarterly_analysis'}

# Regional economic analysis - Priority 90
filter_criteria = {'regional': 'state_economy', 'personal_income': 'analysis'}

# Industry analysis requests - Priority 90
filter_criteria = {'industry_gdp': 'sector_analysis'}

# Economic data analysis - Priority 80
filter_criteria = {'nipa': 'national_accounts', 'analysis_type': 'economic'}
```

### When BEA Skips

```python
# Individual company requests (routes to SEC EDGAR) - Priority 0
filter_criteria = {'companies': ['AAPL']}

# Treasury/fiscal requests (routes to Treasury Fiscal) - Priority 0
filter_criteria = {'fiscal_data': 'debt_analysis'}

# Market data requests (routes to Market APIs) - Priority 0
filter_criteria = {'sector': 'Technology', 'price_data': True}
```

## Available Datasets

```python
# Core BEA datasets
datasets = {
    'nipa': 'NIPA',                    # National Income & Product Accounts
    'gdp_by_industry': 'GDPbyIndustry', # GDP by Industry
    'regional_income': 'RegionalIncome', # Regional Income data
    'regional_product': 'RegionalProduct', # Regional GDP data
    'international': 'ITA',            # International Transactions
    'investment_position': 'IIP',      # International Investment Position
    'fixed_assets': 'FixedAssets',     # Fixed Assets tables
    'input_output': 'InputOutput',     # Input-Output tables
    'multinational': 'MNE',            # Multinational Enterprises
    'services_trade': 'IntlServTrade'  # International Services Trade
}

# Key NIPA tables
nipa_tables = {
    'gdp_summary': 'T10101',           # Gross Domestic Product
    'gdp_components': 'T10105',        # GDP components
    'personal_income': 'T20100',       # Personal Income and Outlays
    'personal_consumption': 'T20804',  # Personal Consumption Expenditures
    'corporate_profits': 'T60900',     # Corporate Profits
    'government_receipts': 'T30100',   # Government Current Receipts
    'government_expenditures': 'T30200' # Government Current Expenditures
}

# BEA data series
bea_series = [
    'GDP_QUARTERLY',        # Quarterly GDP data
    'GDP_ANNUAL',           # Annual GDP data
    'PERSONAL_INCOME',      # Personal Income by state/metro
    'REGIONAL_GDP',         # GDP by state/metro
    'INDUSTRY_GDP',         # GDP by industry
    'CONSUMPTION_PCE',      # Personal Consumption Expenditures
    'CORPORATE_PROFITS',    # Corporate Profits
    'GOVERNMENT_SPENDING',  # Government expenditures
    'TRADE_BALANCE',        # International transactions
    'INVESTMENT_POSITION'   # International investment position
]
```

## Error Handling & Validation

### Connection Testing

```python
# Test API connectivity
if collector.test_connection():
    print("✅ BEA API connection successful")
else:
    print("❌ BEA API connection failed")

# Test authentication
if collector.authenticate():
    print("✅ BEA API authentication successful")
else:
    print("❌ Invalid BEA API key")

# Test data retrieval
try:
    gdp_data = collector.get_gdp_data(frequency='Q', years=['2024'])
    validation = collector.validate_data(gdp_data)

    if validation['is_valid']:
        print("✅ Data validation passed")
    else:
        print(f"❌ Validation errors: {validation['errors']}")

except Exception as e:
    print(f"❌ Data retrieval failed: {e}")
```

### Common Issues & Solutions

```python
# Handle API key issues
try:
    gdp_data = collector.get_gdp_data()
except NetworkError as e:
    if "Invalid API UserId" in str(e):
        print("API key needs activation - check BEA registration")

# Handle rate limiting
try:
    for year in ['2020', '2021', '2022', '2023', '2024']:
        data = collector.get_gdp_data(years=[year])
except NetworkError as e:
    if "rate limit" in str(e).lower():
        print("Rate limit exceeded - requests automatically spaced")

# Validate data quality
def validate_bea_data(data):
    required_fields = ['data_type', 'source', 'timestamp']

    for field in required_fields:
        if field not in data:
            raise DataValidationError(f"Missing required field: {field}")

    if 'error' in str(data).lower():
        raise DataValidationError("BEA API returned error")

    return True
```

## Configuration & Authentication

### API Key Setup

```python
# BEA API requires UserID (36-character API key)
collector = BEACollector()  # Uses authenticated API key

# Check authentication status
print(f"Requires API key: {collector.requires_api_key}")    # True
print(f"Source: {collector.source_name}")                  # "U.S. Bureau of Economic Analysis"
print(f"API key configured: {bool(collector.api_key)}")    # True
print(f"Connection status: {collector.test_connection()}")  # True
print(f"Authentication: {collector.authenticate()}")       # True
```

### Custom Configuration

```python
from backend.data_collectors.base import CollectorConfig

custom_config = CollectorConfig()
custom_config.base_url = "https://apps.bea.gov/api/data/"
custom_config.timeout = 45
custom_config.user_agent = "MyApp/1.0 Economic Analysis"

collector = BEACollector(config=custom_config, api_key="your-36-character-key")
```

## Performance & Optimization

### Rate Limiting

```python
# Built-in rate limiting (2 requests per second)
# Automatic 500ms delays between requests

# Batch operations for efficiency
economic_data = {}
economic_data['gdp'] = collector.get_gdp_data(frequency='Q', years=['2024'])
economic_data['regional'] = collector.get_regional_data(geography_type='state')
economic_data['industry'] = collector.get_industry_gdp_data(industry_level='sector')
```

### Caching Recommendations

```python
# Recommended cache TTL based on data type
cache_config = {
    'quarterly_gdp': {'ttl': 7776000},    # 90 days (quarterly release)
    'annual_gdp': {'ttl': 31536000},      # 1 year (annual data)
    'regional_data': {'ttl': 2592000},    # 30 days (regional updates)
    'industry_gdp': {'ttl': 7776000}      # 90 days (quarterly industry data)
}
```

## Integration Examples

### Frontend Integration (React)

```typescript
const analyzeEconomicData = async () => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      filters: {
        gdp: 'quarterly_analysis',
        regional: 'state_economy',
        analysis_type: 'economic'
      }
    })
  });

  const results = await response.json();
  const gdpData = results.bea.gdp_analysis;
  const regionalData = results.bea.regional_analysis;

  return {
    currentGDP: gdpData.latest_values[0].value,
    topRegion: regionalData.top_regions[0].region,
    economicTrends: results.bea.investment_context.economic_trends
  };
};
```

### Backend API Endpoint

```python
from flask import Flask, request, jsonify
from backend.data_collectors.collector_router import route_data_request

@app.route('/api/economic-analysis', methods=['POST'])
def economic_analysis():
    data = request.get_json()
    analysis_type = data.get('analysis_type', 'comprehensive')

    collectors = route_data_request({
        'gdp': 'analysis',
        'regional': 'economics',
        'industry_gdp': 'sector_analysis',
        'analysis_type': analysis_type
    })

    results = {}
    for collector in collectors:
        if hasattr(collector, 'get_gdp_data'):
            if analysis_type == 'gdp':
                results['gdp_analysis'] = collector.get_gdp_data(frequency='Q')
            elif analysis_type == 'regional':
                results['regional_analysis'] = collector.get_regional_data()
            elif analysis_type == 'industry':
                results['industry_analysis'] = collector.get_industry_gdp_data()
            else:
                results['comprehensive'] = collector.get_comprehensive_economic_summary()

    return jsonify(results)
```

## Testing & Validation

### Running Tests

```bash
# Test BEA collector
python3 -c "
from backend.data_collectors.government.bea_collector import BEACollector
collector = BEACollector()
if collector.authenticate():
    print('✅ BEA API ready')
    gdp_data = collector.get_gdp_data(frequency='Q', years=['2024'])
    print(f'✅ GDP data: {len(gdp_data.get(\"gdp_analysis\", {}).get(\"latest_values\", []))} records')
else:
    print('❌ API key needs activation')
"
```

### Data Validation

```python
def validate_economic_data(data):
    required_fields = ['data_type', 'source', 'timestamp']

    for field in required_fields:
        if field not in data:
            raise DataValidationError(f"Missing required field: {field}")

    if 'gdp_analysis' in data:
        gdp_analysis = data['gdp_analysis']
        if not gdp_analysis.get('latest_values'):
            raise DataValidationError("GDP analysis missing latest values")

    if any('error' in str(value).lower() for value in data.values()):
        raise DataValidationError("BEA data contains errors")

    return True
```

## Best Practices

### 1. Use Smart Routing
```python
# Let the system route automatically for economic data
collectors = route_data_request({'gdp': 'analysis', 'regional': 'economics'})
```

### 2. Economic Context Analysis
```python
# Combine BEA data with other sources
gdp_data = collector.get_gdp_data()
industry_data = collector.get_industry_gdp_data()

economic_growth = gdp_data['gdp_analysis']['latest_values'][0]['value']
sector_performance = industry_data['industry_analysis']['top_industries']
```

### 3. Error Handling
```python
# Always wrap BEA API calls
try:
    gdp_data = collector.get_gdp_data()
except NetworkError:
    # Handle network issues
except DataValidationError:
    # Handle data structure issues
```

### 4. Investment Integration
```python
# Use BEA data for economic analysis
economic_summary = collector.get_comprehensive_economic_summary()
economic_trends = economic_summary['investment_context']['economic_trends']
```

## Summary

The BEA Economic Data Collector provides:

- **Comprehensive GDP Analysis**: Quarterly and annual GDP components and trends
- **Regional Economic Data**: State, county, and metro area economic performance
- **Industry-Specific Metrics**: Value added and GDP by industry sector
- **Investment Context**: Economic trends and sector rotation insights
- **Smart Activation**: Only for GDP, regional, and industry analysis requests
- **Production Ready**: Full error handling, validation, rate limiting

**Perfect for**: GDP component analysis, regional investment strategies, sector rotation decisions, economic cycle positioning

**Status**: Operational - API authenticated, streaming live data, production-ready

**File Location**: `/docs/modules/data-ingestion/government-apis/bea-usage-guide_optimized.md`