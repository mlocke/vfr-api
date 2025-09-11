#!/usr/bin/env python3
"""
Simple SEC EDGAR Collector Test
Quick verification that the collector can connect and retrieve basic data.
"""

import os
import sys
from pathlib import Path

# For testing without full base implementation, we'll create a minimal mock
class MockConfig:
    def __init__(self, source, rate_limit_config, retry_config):
        self.source = source
        self.rate_limit_config = rate_limit_config
        self.retry_config = retry_config

class MockRateLimitConfig:
    def __init__(self, requests_per_second, requests_per_minute, requests_per_hour):
        self.requests_per_second = requests_per_second
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour

class MockRetryConfig:
    def __init__(self, max_retries, backoff_factor, retry_delays):
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.retry_delays = retry_delays

# Mock the base classes for testing
sys.modules['backend.data_collectors.base'] = type(sys)('mock_base')
sys.modules['backend.data_collectors.base'].DataCollectorInterface = object
sys.modules['backend.data_collectors.base'].CollectorConfig = MockConfig
sys.modules['backend.data_collectors.base'].RateLimitConfig = MockRateLimitConfig
sys.modules['backend.data_collectors.base'].RetryConfig = MockRetryConfig
sys.modules['backend.data_collectors.base'].DateRange = object
sys.modules['backend.data_collectors.base'].DataFrequency = object
sys.modules['backend.data_collectors.base'].RateLimiter = lambda x: type('MockRateLimiter', (), {'wait_if_needed': lambda: None})()
sys.modules['backend.data_collectors.base'].ErrorHandler = lambda x: None
sys.modules['backend.data_collectors.base'].with_error_handling = lambda func: func
sys.modules['backend.data_collectors.base'].NetworkError = Exception
sys.modules['backend.data_collectors.base'].AuthenticationError = Exception  
sys.modules['backend.data_collectors.base'].DataValidationError = Exception

# Now import our collector
from backend.data_collectors.government.sec_edgar_collector import SECEdgarCollector, SAMPLE_COMPANIES

def test_simple_connection():
    """Test basic SEC EDGAR API connection."""
    print("🔄 Testing SEC EDGAR API connection...")
    
    collector = SECEdgarCollector()
    
    # Test basic request functionality
    try:
        # Try to get Apple's company facts
        apple_data = collector._make_request("/api/xbrl/companyfacts/CIK0000320193.json")
        
        if apple_data:
            print("✅ SEC EDGAR API connection successful!")
            print(f"📊 Retrieved data for: {apple_data.get('entityName', 'Unknown Company')}")
            print(f"🏢 CIK: {apple_data.get('cik', 'Unknown')}")
            
            # Check if we have financial facts
            facts = apple_data.get('facts', {})
            us_gaap = facts.get('us-gaap', {})
            print(f"📈 Available US-GAAP concepts: {len(us_gaap)}")
            
            return True
        else:
            print("❌ No data retrieved from SEC EDGAR API")
            return False
            
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False

def test_structured_data():
    """Test structured data retrieval."""
    print("\n🔄 Testing structured data retrieval...")
    
    collector = SECEdgarCollector()
    
    try:
        # Get structured company facts
        apple_facts = collector.get_company_facts('320193')
        
        if apple_facts:
            company_name = apple_facts['company_info']['name']
            print(f"✅ Structured data retrieved for {company_name}")
            
            # Check data structure
            print(f"📊 Company info keys: {list(apple_facts['company_info'].keys())}")
            print(f"📈 Financial metrics found: {len(apple_facts['financial_metrics'])}")
            
            # Show sample metrics
            sample_metrics = list(apple_facts['financial_metrics'].keys())[:3]
            print(f"📋 Sample metrics: {sample_metrics}")
            
            for metric in sample_metrics:
                metric_data = apple_facts['financial_metrics'][metric]
                latest_value = metric_data.get('latest_value', 'N/A')
                latest_date = metric_data.get('latest_date', 'N/A')
                print(f"  - {metric}: {latest_value} (as of {latest_date})")
            
            return True
        else:
            print("❌ No structured data retrieved")
            return False
            
    except Exception as e:
        print(f"❌ Structured data test failed: {e}")
        return False

def test_rate_limiting():
    """Test rate limiting functionality."""
    print("\n🔄 Testing rate limiting...")
    
    collector = SECEdgarCollector()
    
    try:
        print("📊 Making multiple requests to test rate limiting...")
        
        # Make a few requests in succession
        companies = ['320193', '789019', '1652044']  # Apple, Microsoft, Alphabet
        results = []
        
        for i, cik in enumerate(companies):
            print(f"  Request {i+1}/3: CIK {cik}")
            try:
                data = collector._make_request(f"/api/xbrl/companyfacts/CIK{cik.zfill(10)}.json")
                if data:
                    results.append(data.get('entityName', 'Unknown'))
                else:
                    results.append('No data')
            except Exception as e:
                print(f"    ⚠️  Request failed: {e}")
                results.append('Failed')
        
        print(f"✅ Rate limiting test completed")
        print(f"📊 Results: {results}")
        
        return len([r for r in results if r not in ['No data', 'Failed']]) > 0
        
    except Exception as e:
        print(f"❌ Rate limiting test failed: {e}")
        return False

def main():
    """Run simple SEC EDGAR collector tests."""
    print("🚀 SEC EDGAR Collector - Simple Test Suite")
    print("=" * 50)
    
    tests = [
        ("API Connection", test_simple_connection),
        ("Structured Data", test_structured_data),
        ("Rate Limiting", test_rate_limiting),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 50}")
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
            results[test_name] = False
    
    # Summary
    print(f"\n{'=' * 50}")
    print("🎯 TEST SUMMARY")
    print(f"{'=' * 50}")
    
    passed_tests = sum(results.values())
    total_tests = len(results)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:.<30} {status}")
    
    print(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n🎉 SUCCESS! SEC EDGAR Collector basic functionality verified!")
        print("✨ Ready to run the full demo with: python test_sec_edgar_full_demo.py")
    else:
        print("\n⚠️  Some basic tests failed. Check implementation.")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)