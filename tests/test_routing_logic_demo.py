#!/usr/bin/env python3
"""
Collector Routing Logic Demo - Verify Filter-Driven Behavior
Demonstrates the smart routing system without base class dependencies.
"""

from typing import Dict, List, Any

class MockSECEdgarCollector:
    """Mock SEC EDGAR collector with routing logic."""
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """SEC EDGAR activation logic - individual company deep-dive analysis."""
        
        # Extract specific company identifiers
        companies = filter_criteria.get('companies', [])
        symbols = filter_criteria.get('symbols', [])
        tickers = filter_criteria.get('tickers', [])
        ciks = filter_criteria.get('ciks', [])
        
        # Combine all specific company identifiers
        specific_companies = companies + symbols + tickers + ciks
        
        # Don't activate for broad sector-only requests
        if filter_criteria.get('sector') and not specific_companies:
            print("   SEC EDGAR: Skipping - sector-only request (use market APIs)")
            return False
        
        # Don't activate for index-only requests
        if filter_criteria.get('index') and not specific_companies:
            print("   SEC EDGAR: Skipping - index-only request (use index APIs)")
            return False
        
        # Don't activate for economic indicator requests
        if filter_criteria.get('economic_indicator') or filter_criteria.get('fred_series'):
            print("   SEC EDGAR: Skipping - economic data request (use FRED API)")
            return False
        
        # Don't activate for very large company lists (inefficient)
        if len(specific_companies) > 20:
            print(f"   SEC EDGAR: Skipping - too many companies ({len(specific_companies)} > 20)")
            return False
        
        # Activate when specific companies are requested
        if specific_companies:
            print(f"   SEC EDGAR: ACTIVATING - analysis for {len(specific_companies)} companies: {specific_companies}")
            return True
        
        # Default: don't activate without specific companies
        print("   SEC EDGAR: Skipping - no specific companies requested")
        return False
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """Get priority level for SEC EDGAR (higher = more preferred)."""
        
        if not self.should_activate(filter_criteria):
            return 0
        
        companies = filter_criteria.get('companies', [])
        symbols = filter_criteria.get('symbols', [])
        tickers = filter_criteria.get('tickers', [])
        ciks = filter_criteria.get('ciks', [])
        
        specific_companies = companies + symbols + tickers + ciks
        
        if len(specific_companies) == 1:
            return 100  # Highest priority for single company deep-dive
        elif len(specific_companies) <= 5:
            return 90   # Very high for small comparison groups
        elif len(specific_companies) <= 10:
            return 80   # High for moderate comparison groups
        elif len(specific_companies) <= 20:
            return 70   # Moderate for larger comparison groups
        
        return 0

class MockMarketAPICollector:
    """Mock Market API collector with routing logic."""
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """Market API activation logic - sector analysis and screening."""
        
        # Extract identifiers
        specific_companies = (
            filter_criteria.get('companies', []) + 
            filter_criteria.get('symbols', []) + 
            filter_criteria.get('tickers', [])
        )
        
        # Activate for sector-only requests
        if filter_criteria.get('sector') and not specific_companies:
            print("   Market API: ACTIVATING - sector analysis request")
            return True
        
        # Activate for index requests
        if filter_criteria.get('index') and not specific_companies:
            print("   Market API: ACTIVATING - index analysis request")
            return True
        
        # Activate for large company lists
        if len(specific_companies) > 20:
            print(f"   Market API: ACTIVATING - large company list ({len(specific_companies)} companies)")
            return True
        
        # Activate for technical analysis
        if filter_criteria.get('analysis_type') == 'technical':
            print("   Market API: ACTIVATING - technical analysis request")
            return True
        
        print("   Market API: Skipping - not optimal for this request")
        return False
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """Get priority level for Market API."""
        
        if not self.should_activate(filter_criteria):
            return 0
        
        # Medium priority for sector/index analysis
        if filter_criteria.get('sector') or filter_criteria.get('index'):
            return 70
        
        # High priority for technical analysis
        if filter_criteria.get('analysis_type') == 'technical':
            return 80
        
        return 60  # Default priority

class MockFREDCollector:
    """Mock FRED collector with routing logic."""
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """FRED activation logic - economic indicators."""
        
        # Activate for economic indicator requests
        if filter_criteria.get('economic_indicator') or filter_criteria.get('fred_series'):
            print("   FRED API: ACTIVATING - economic data request")
            return True
        
        print("   FRED API: Skipping - not economic data request")
        return False
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """Get priority level for FRED."""
        
        if self.should_activate(filter_criteria):
            return 80  # High priority for economic data
        return 0

def route_request_demo(filter_criteria: Dict[str, Any]) -> List[str]:
    """Demonstrate smart routing logic."""
    
    print(f"\n🔄 Routing Request: {filter_criteria}")
    print("   Checking collector capabilities...")
    
    collectors = [
        ('SEC EDGAR', MockSECEdgarCollector()),
        ('Market API', MockMarketAPICollector()),
        ('FRED API', MockFREDCollector())
    ]
    
    # Find capable collectors with priorities
    capable_collectors = []
    
    for name, collector in collectors:
        if collector.should_activate(filter_criteria):
            priority = collector.get_activation_priority(filter_criteria)
            capable_collectors.append((name, priority))
            print(f"   ✅ {name}: Priority {priority}")
    
    # Sort by priority (highest first)
    capable_collectors.sort(key=lambda x: x[1], reverse=True)
    
    # Return selected collectors
    if capable_collectors:
        selected = [collector[0] for collector in capable_collectors if collector[1] > 0]
        print(f"   🎯 SELECTED: {selected}")
        return selected
    else:
        print(f"   ❌ NO COLLECTORS: No suitable collectors found")
        return []

def main():
    """Demonstrate the filter-driven routing system."""
    print("🚀 Collector Routing Logic Demonstration")
    print("=" * 70)
    print("Testing smart collector selection based on filter specificity")
    print("=" * 70)
    
    # Test scenarios
    test_scenarios = [
        {
            'name': 'Individual Company Analysis',
            'description': 'Single company fundamental analysis',
            'filters': {
                'companies': ['AAPL'],
                'analysis_type': 'fundamental'
            },
            'expected': 'SEC EDGAR (Priority 100)'
        },
        {
            'name': 'Company Comparison',
            'description': 'Multiple companies comparison',
            'filters': {
                'companies': ['AAPL', 'MSFT', 'GOOGL'],
                'analysis_type': 'fundamental'
            },
            'expected': 'SEC EDGAR (Priority 90)'
        },
        {
            'name': 'Sector Analysis',
            'description': 'Technology sector screening',
            'filters': {
                'sector': 'Technology',
                'analysis_type': 'screening'
            },
            'expected': 'Market API (Priority 70)'
        },
        {
            'name': 'Index Analysis',
            'description': 'S&P 500 composition analysis',
            'filters': {
                'index': 'S&P500',
                'analysis_type': 'index'
            },
            'expected': 'Market API (Priority 70)'
        },
        {
            'name': 'Economic Data',
            'description': 'GDP and inflation analysis',
            'filters': {
                'fred_series': ['GDP', 'INFLATION'],
                'analysis_type': 'economic'
            },
            'expected': 'FRED API (Priority 80)'
        },
        {
            'name': 'Large Company List',
            'description': 'Bulk analysis of 25 companies',
            'filters': {
                'companies': [f'STOCK_{i}' for i in range(25)],
                'analysis_type': 'fundamental'
            },
            'expected': 'Market API (bulk processing)'
        },
        {
            'name': 'Technical Analysis',
            'description': 'Technical indicators for specific stock',
            'filters': {
                'companies': ['AAPL'],
                'analysis_type': 'technical'
            },
            'expected': 'Market API (technical specialty)'
        }
    ]
    
    # Run test scenarios
    results = []
    
    for scenario in test_scenarios:
        print(f"\n📊 TEST: {scenario['name']}")
        print(f"Description: {scenario['description']}")
        print(f"Expected: {scenario['expected']}")
        
        selected_collectors = route_request_demo(scenario['filters'])
        
        # Evaluate results
        if 'SEC EDGAR' in scenario['expected'] and 'SEC EDGAR' in selected_collectors:
            result = "✅ PASS"
        elif 'Market API' in scenario['expected'] and 'Market API' in selected_collectors:
            result = "✅ PASS"
        elif 'FRED API' in scenario['expected'] and 'FRED API' in selected_collectors:
            result = "✅ PASS"
        elif not selected_collectors and 'NO COLLECTORS' in scenario['expected']:
            result = "✅ PASS"
        else:
            result = "❌ FAIL"
        
        results.append(result)
        print(f"Result: {result}")
    
    # Summary
    print("\n" + "=" * 70)
    print("🎯 ROUTING LOGIC DEMONSTRATION SUMMARY")
    print("=" * 70)
    
    test_names = [s['name'] for s in test_scenarios]
    for i, (name, result) in enumerate(zip(test_names, results)):
        print(f"{result} {name}")
    
    passed = sum(1 for r in results if '✅' in r)
    total = len(results)
    
    print(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 SUCCESS! Filter-driven routing logic is working correctly!")
        print("📈 SEC EDGAR activates only for specific company analysis (1-20 companies)")
        print("🔍 Market APIs handle sector screening and large company lists")
        print("📊 FRED API handles economic indicators and macro data")
        print("🚀 Smart routing ensures optimal data source selection!")
    else:
        print("⚠️  Some routing logic needs adjustment")
    
    # Key insights
    print(f"\n💡 Key Insights:")
    print("   • SEC EDGAR: Individual company expertise (1-20 companies)")
    print("   • Market APIs: Sector screening, bulk analysis, technical data")
    print("   • FRED API: Economic indicators, macro trends")
    print("   • Smart routing prevents unnecessary API calls")
    print("   • Priority system handles overlapping capabilities")

if __name__ == "__main__":
    main()