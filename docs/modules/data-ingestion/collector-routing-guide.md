# Collector Routing Integration Guide

## Overview

This guide explains how to integrate the filter-driven collector routing system into the VFR application. The routing system automatically selects the most appropriate data collectors based on user request specificity.

## Core Concepts

### Filter-Based Activation
Each collector includes logic to determine when it should activate based on request filters:

```python
def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
    """Determine if this collector should handle the request."""
```

### Priority-Based Selection
When multiple collectors can handle a request, priority determines the selection:

```python
def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
    """Return priority level (0-100, higher = more preferred)."""
```

## Integration Steps

### 1. Import the Router System

```python
from backend.data_collectors.collector_router import route_data_request, CollectorRouter
```

### 2. Basic Usage

#### Simple Request Routing
```python
# Route a specific company analysis request
filter_criteria = {
    'companies': ['AAPL', 'MSFT'],
    'analysis_type': 'fundamental'
}

collectors = route_data_request(filter_criteria)
# Returns: [SECEdgarCollector()] - optimal for individual company analysis

# Execute data collection
results = {}
for collector in collectors:
    results[collector.__class__.__name__] = collector.collect_data(filter_criteria)
```

#### Advanced Router Usage
```python
router = CollectorRouter()

# Validate request before processing
validation = router.validate_request(filter_criteria)
if not validation['is_valid']:
    return {'error': validation['warnings']}

# Get detailed collector information
collector_info = router.get_collector_info()

# Route and execute
collectors = router.route_request(filter_criteria)
```

### 3. Request Types and Expected Routing

#### Individual Company Analysis
```python
# Request
filter_criteria = {
    'companies': ['AAPL'],
    'analysis_type': 'fundamental',
    'time_period': '5y'
}

# Expected Routing
# ✅ SEC EDGAR: Priority 100 (individual company specialty)
# ❌ Market APIs: Skip (specific company request)
# ❌ FRED: Skip (not economic data)

# Data Delivered
# - Complete financial statements
# - 15+ calculated financial ratios  
# - 5+ years of historical data
# - SEC filing history
# - Regulatory compliance data
```

#### Sector Analysis
```python
# Request
filter_criteria = {
    'sector': 'Technology',
    'market_cap': 'Large',
    'analysis_type': 'screening'
}

# Expected Routing  
# ❌ SEC EDGAR: Skip (no specific companies)
# ✅ Market Screener: Priority 70 (sector specialty)
# ❌ FRED: Skip (not economic data)

# Data Delivered
# - List of technology companies
# - Basic financial metrics
# - Market cap rankings
# - Sector performance comparison
```

#### Economic Context Analysis
```python
# Request
filter_criteria = {
    'fred_series': ['GDP', 'INFLATION', 'UNEMPLOYMENT'],
    'analysis_type': 'economic',
    'time_period': '10y'
}

# Expected Routing
# ❌ SEC EDGAR: Skip (economic indicators)
# ❌ Market APIs: Skip (macro data)  
# ✅ FRED: Priority 80 (economic data specialty)

# Data Delivered
# - Macroeconomic time series
# - Economic trend analysis
# - Correlation with market performance
# - Recession/expansion indicators
```

## Frontend Integration Examples

### 1. React Component Integration

```typescript
// components/DataAnalysisComponent.tsx
import React, { useState, useEffect } from 'react';

interface FilterCriteria {
  companies?: string[];
  sector?: string;
  index?: string;
  analysisType?: string;
}

const DataAnalysisComponent: React.FC = () => {
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const executeAnalysis = async () => {
    setLoading(true);
    
    try {
      // Call backend API with filter criteria
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: filterCriteria })
      });
      
      const results = await response.json();
      setAnalysisResults(results);
      
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Individual Company Analysis */}
      <button onClick={() => {
        setFilterCriteria({
          companies: ['AAPL', 'MSFT'],
          analysisType: 'fundamental'
        });
      }}>
        Analyze Apple & Microsoft
      </button>

      {/* Sector Analysis */}
      <button onClick={() => {
        setFilterCriteria({
          sector: 'Technology',
          analysisType: 'screening'
        });
      }}>
        Screen Technology Sector
      </button>

      <button onClick={executeAnalysis} disabled={loading}>
        {loading ? 'Analyzing...' : 'Run Analysis'}
      </button>

      {analysisResults && (
        <div>
          <h3>Analysis Results</h3>
          <pre>{JSON.stringify(analysisResults, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
```

### 2. Backend API Integration

```python
# api/routes/analysis.py
from flask import Flask, request, jsonify
from backend.data_collectors.collector_router import route_data_request

app = Flask(__name__)

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Main analysis endpoint with intelligent collector routing."""
    
    try:
        # Get filter criteria from request
        data = request.get_json()
        filter_criteria = data.get('filters', {})
        
        # Route to appropriate collectors
        collectors = route_data_request(filter_criteria)
        
        if not collectors:
            return jsonify({
                'error': 'No suitable data collectors found for request',
                'filter_criteria': filter_criteria
            }), 400
        
        # Execute data collection
        results = {
            'filter_criteria': filter_criteria,
            'collectors_used': [c.__class__.__name__ for c in collectors],
            'data': {}
        }
        
        for collector in collectors:
            collector_name = collector.__class__.__name__
            
            try:
                # Execute specific collector methods based on request
                if 'companies' in filter_criteria:
                    # Individual company analysis
                    company_data = {}
                    for symbol in filter_criteria['companies']:
                        if hasattr(collector, 'get_company_facts'):
                            company_data[symbol] = {
                                'facts': collector.get_company_facts(
                                    collector.get_symbol_to_cik_mapping(symbol)
                                ),
                                'ratios': collector.get_key_financial_ratios(
                                    collector.get_symbol_to_cik_mapping(symbol)
                                )
                            }
                    results['data'][collector_name] = company_data
                    
                elif filter_criteria.get('sector'):
                    # Sector analysis
                    if hasattr(collector, 'filter_companies_by_sic'):
                        sector_data = collector.filter_companies_by_sic(['7372'])  # Example SIC
                        results['data'][collector_name] = sector_data
                        
                elif filter_criteria.get('fred_series'):
                    # Economic data
                    if hasattr(collector, 'get_series'):
                        econ_data = collector.get_series(filter_criteria['fred_series'])
                        results['data'][collector_name] = econ_data
                        
            except Exception as e:
                results['data'][collector_name] = {'error': str(e)}
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/collectors/info', methods=['GET'])
def collector_info():
    """Get information about available collectors and their capabilities."""
    
    router = CollectorRouter()
    return jsonify(router.get_collector_info())

@app.route('/api/validate-request', methods=['POST'])
def validate_request():
    """Validate a request and provide routing guidance."""
    
    data = request.get_json()
    filter_criteria = data.get('filters', {})
    
    router = CollectorRouter()
    validation = router.validate_request(filter_criteria)
    
    return jsonify(validation)
```

## Testing the Routing System

### 1. Unit Tests for Individual Collectors

```python
# tests/test_sec_edgar_routing.py
import pytest
from backend.data_collectors.government.sec_edgar_collector import SECEdgarCollector

class TestSECEdgarRouting:
    
    def test_should_activate_individual_company(self):
        collector = SECEdgarCollector()
        filter_criteria = {'companies': ['AAPL']}
        
        assert collector.should_activate(filter_criteria) == True
        assert collector.get_activation_priority(filter_criteria) == 100
    
    def test_should_skip_sector_only(self):
        collector = SECEdgarCollector()
        filter_criteria = {'sector': 'Technology'}
        
        assert collector.should_activate(filter_criteria) == False
        assert collector.get_activation_priority(filter_criteria) == 0
    
    def test_should_skip_large_company_lists(self):
        collector = SECEdgarCollector()
        companies = [f'COMPANY_{i}' for i in range(25)]  # 25 companies
        filter_criteria = {'companies': companies}
        
        assert collector.should_activate(filter_criteria) == False
```

### 2. Integration Tests for Router

```python
# tests/test_collector_router.py
import pytest
from backend.data_collectors.collector_router import CollectorRouter, route_data_request

class TestCollectorRouter:
    
    def test_route_individual_company_to_sec_edgar(self):
        filter_criteria = {
            'companies': ['AAPL', 'MSFT'],
            'analysis_type': 'fundamental'
        }
        
        collectors = route_data_request(filter_criteria)
        
        assert len(collectors) == 1
        assert collectors[0].__class__.__name__ == 'SECEdgarCollector'
    
    def test_route_sector_request_skips_sec_edgar(self):
        filter_criteria = {
            'sector': 'Technology',
            'analysis_type': 'screening'
        }
        
        collectors = route_data_request(filter_criteria)
        
        # Should not route to SEC EDGAR for sector-only requests
        sec_edgar_collectors = [c for c in collectors 
                              if c.__class__.__name__ == 'SECEdgarCollector']
        assert len(sec_edgar_collectors) == 0
    
    def test_validation_system(self):
        router = CollectorRouter()
        
        # Valid request
        valid_criteria = {'companies': ['AAPL']}
        validation = router.validate_request(valid_criteria)
        assert validation['is_valid'] == True
        
        # Invalid/empty request  
        invalid_criteria = {}
        validation = router.validate_request(invalid_criteria)
        assert len(validation['warnings']) > 0
```

### 3. End-to-End Integration Test

```python
# tests/test_end_to_end_routing.py
import pytest
from backend.data_collectors.collector_router import route_data_request

class TestEndToEndRouting:
    
    def test_complete_individual_analysis_workflow(self):
        """Test complete workflow for individual company analysis."""
        
        # Step 1: Route request
        filter_criteria = {
            'companies': ['AAPL'],
            'analysis_type': 'fundamental'
        }
        
        collectors = route_data_request(filter_criteria)
        assert len(collectors) > 0
        
        # Step 2: Execute data collection
        sec_edgar = collectors[0]
        cik = sec_edgar.get_symbol_to_cik_mapping('AAPL')
        
        # Step 3: Get comprehensive data
        company_facts = sec_edgar.get_company_facts(cik)
        financial_ratios = sec_edgar.get_key_financial_ratios(cik)
        
        # Step 4: Validate results
        assert company_facts is not None
        assert financial_ratios is not None
        assert 'financial_metrics' in company_facts
        assert 'calculated_ratios' in financial_ratios
```

## Performance Considerations

### 1. Routing Efficiency
- Router decisions are made in O(1) time for most cases
- Collector activation checks are lightweight
- No unnecessary API calls for declined collectors

### 2. Caching Strategy
```python
# Example caching in router
from functools import lru_cache

class CollectorRouter:
    
    @lru_cache(maxsize=100)
    def route_request_cached(self, filter_criteria_hash: str) -> List[str]:
        """Cache routing decisions for identical requests."""
        # Implementation here
```

### 3. Error Handling
```python
# Robust error handling in routing
def route_request(self, filter_criteria: Dict[str, Any]) -> List[DataCollectorInterface]:
    try:
        collectors = self._select_optimal_collectors(...)
        return collectors
    except Exception as e:
        logger.error(f"Routing failed: {e}")
        # Return fallback collector or empty list
        return []
```

## Best Practices

### 1. Filter Design
- Use specific company lists when possible for best SEC EDGAR utilization
- Combine filters appropriately (e.g., `companies` + `sector` for context)
- Avoid overly broad requests that could trigger multiple collectors unnecessarily

### 2. Error Handling
- Always check if collectors were returned before execution
- Handle individual collector failures gracefully
- Provide meaningful error messages to users

### 3. Performance Optimization
- Cache routing decisions for identical requests
- Implement timeout handling for slow collectors
- Monitor collector performance and adjust priorities as needed

This integration guide provides a comprehensive foundation for implementing the filter-driven collector routing system throughout the VFR application.