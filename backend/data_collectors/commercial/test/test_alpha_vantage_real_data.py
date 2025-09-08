#!/usr/bin/env python3
"""
Alpha Vantage Real Data Test

Simple test that connects to the real Alpha Vantage API using the provided
API key and verifies data collection functionality. Writes results to
/docs/project/test_output/Alpha_Vantage/ for verification.

This test validates:
1. API key connectivity  
2. Data retrieval functionality
3. Result formatting and storage
4. Basic Alpha Vantage integration readiness
"""

import json
import requests
import sys
import os
from datetime import datetime
from pathlib import Path

# Configuration
API_KEY = "4M20CQ7QT67RJ835"
BASE_URL = "https://www.alphavantage.co/query"
TEST_OUTPUT_DIR = Path(__file__).parent.parent.parent.parent.parent / "docs/project/test_output/Alpha_Vantage"

def ensure_output_directory():
    """Ensure the output directory exists."""
    TEST_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output directory: {TEST_OUTPUT_DIR}")

def test_api_connectivity():
    """Test basic API connectivity and key validation."""
    print("🔑 Testing Alpha Vantage API connectivity...")
    
    # Test with a simple quote request
    params = {
        'function': 'GLOBAL_QUOTE',
        'symbol': 'AAPL',
        'apikey': API_KEY
    }
    
    try:
        response = requests.get(BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Check for API error messages
        if 'Error Message' in data:
            print(f"❌ API Error: {data['Error Message']}")
            return False, data
            
        if 'Note' in data:
            print(f"⚠️  API Note: {data['Note']}")
            return False, data
            
        if 'Global Quote' in data:
            print("✅ API connectivity successful")
            quote_data = data['Global Quote']
            symbol = quote_data.get('01. symbol', 'Unknown')
            price = quote_data.get('05. price', 'Unknown')
            print(f"📊 Retrieved quote for {symbol}: ${price}")
            return True, data
        else:
            print(f"⚠️  Unexpected response format: {list(data.keys())}")
            return False, data
            
    except requests.RequestException as e:
        print(f"❌ Network error: {e}")
        return False, {"error": str(e)}
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return False, {"error": str(e)}

def test_time_series_data():
    """Test time series data retrieval."""
    print("\n📈 Testing time series data retrieval...")
    
    params = {
        'function': 'TIME_SERIES_DAILY_ADJUSTED',
        'symbol': 'AAPL',
        'outputsize': 'compact',  # Last 100 data points
        'apikey': API_KEY
    }
    
    try:
        response = requests.get(BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Check for errors
        if 'Error Message' in data:
            print(f"❌ API Error: {data['Error Message']}")
            return False, data
            
        if 'Note' in data:
            print(f"⚠️  Rate limit or other issue: {data['Note']}")
            return False, data
        
        if 'Time Series (Daily)' in data:
            time_series = data['Time Series (Daily)']
            data_points = len(time_series)
            latest_date = max(time_series.keys())
            latest_data = time_series[latest_date]
            
            print(f"✅ Time series data retrieved")
            print(f"📊 Data points: {data_points}")
            print(f"📅 Latest date: {latest_date}")
            print(f"💰 Latest close: ${latest_data.get('4. close', 'Unknown')}")
            
            return True, data
        else:
            print(f"⚠️  Unexpected response format: {list(data.keys())}")
            return False, data
            
    except requests.RequestException as e:
        print(f"❌ Network error: {e}")
        return False, {"error": str(e)}
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return False, {"error": str(e)}

def test_technical_indicator():
    """Test technical indicator retrieval."""
    print("\n📊 Testing technical indicator (RSI)...")
    
    params = {
        'function': 'RSI',
        'symbol': 'AAPL',
        'interval': 'daily',
        'time_period': '14',
        'series_type': 'close',
        'apikey': API_KEY
    }
    
    try:
        response = requests.get(BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Check for errors
        if 'Error Message' in data:
            print(f"❌ API Error: {data['Error Message']}")
            return False, data
            
        if 'Note' in data:
            print(f"⚠️  Rate limit or other issue: {data['Note']}")
            return False, data
        
        if 'Technical Analysis: RSI' in data:
            rsi_data = data['Technical Analysis: RSI']
            data_points = len(rsi_data)
            latest_date = max(rsi_data.keys()) if rsi_data else 'None'
            latest_rsi = rsi_data.get(latest_date, {}).get('RSI', 'Unknown') if rsi_data else 'Unknown'
            
            print(f"✅ RSI indicator data retrieved")
            print(f"📊 RSI data points: {data_points}")
            print(f"📅 Latest date: {latest_date}")
            print(f"📈 Latest RSI: {latest_rsi}")
            
            return True, data
        else:
            print(f"⚠️  Unexpected response format: {list(data.keys())}")
            return False, data
            
    except requests.RequestException as e:
        print(f"❌ Network error: {e}")
        return False, {"error": str(e)}
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return False, {"error": str(e)}

def test_company_overview():
    """Test company overview data."""
    print("\n🏢 Testing company overview data...")
    
    params = {
        'function': 'OVERVIEW',
        'symbol': 'AAPL',
        'apikey': API_KEY
    }
    
    try:
        response = requests.get(BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Check for errors
        if 'Error Message' in data:
            print(f"❌ API Error: {data['Error Message']}")
            return False, data
            
        if 'Note' in data:
            print(f"⚠️  Rate limit or other issue: {data['Note']}")
            return False, data
        
        # Check if we got company data
        if 'Symbol' in data and data.get('Symbol') == 'AAPL':
            print(f"✅ Company overview retrieved")
            print(f"🏢 Company: {data.get('Name', 'Unknown')}")
            print(f"💰 Market Cap: ${data.get('MarketCapitalization', 'Unknown')}")
            print(f"📊 P/E Ratio: {data.get('PERatio', 'Unknown')}")
            print(f"💵 EPS: ${data.get('EPS', 'Unknown')}")
            
            return True, data
        else:
            print(f"⚠️  Unexpected response or empty data")
            return False, data
            
    except requests.RequestException as e:
        print(f"❌ Network error: {e}")
        return False, {"error": str(e)}
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return False, {"error": str(e)}

def save_test_results(results):
    """Save test results to output directory."""
    print(f"\n💾 Saving test results to {TEST_OUTPUT_DIR}...")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save individual test results
    for test_name, (success, data) in results.items():
        filename = f"{test_name}_{timestamp}.json"
        filepath = TEST_OUTPUT_DIR / filename
        
        result_data = {
            "test_name": test_name,
            "timestamp": datetime.now().isoformat(),
            "success": success,
            "api_key_used": API_KEY,
            "data": data
        }
        
        try:
            with open(filepath, 'w') as f:
                json.dump(result_data, f, indent=2, default=str)
            print(f"✅ Saved: {filename}")
        except Exception as e:
            print(f"❌ Failed to save {filename}: {e}")
    
    # Save summary report
    summary_file = TEST_OUTPUT_DIR / f"test_summary_{timestamp}.json"
    summary = {
        "test_run_timestamp": datetime.now().isoformat(),
        "api_key_used": API_KEY,
        "total_tests": len(results),
        "successful_tests": sum(1 for success, _ in results.values() if success),
        "failed_tests": sum(1 for success, _ in results.values() if not success),
        "test_results": {name: success for name, (success, _) in results.items()}
    }
    
    try:
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        print(f"✅ Saved summary: test_summary_{timestamp}.json")
    except Exception as e:
        print(f"❌ Failed to save summary: {e}")

def run_alpha_vantage_real_data_test():
    """Run the complete Alpha Vantage real data test."""
    print("🧪 Alpha Vantage Real Data Test")
    print("=" * 50)
    print(f"🔑 API Key: {API_KEY}")
    print(f"📁 Output Directory: {TEST_OUTPUT_DIR}")
    print(f"⏰ Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Ensure output directory exists
    ensure_output_directory()
    
    # Run tests
    tests = [
        ("api_connectivity", test_api_connectivity),
        ("time_series_data", test_time_series_data),
        ("technical_indicator", test_technical_indicator),
        ("company_overview", test_company_overview)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"🚀 Running {test_name.replace('_', ' ').title()}...")
        try:
            success, data = test_func()
            results[test_name] = (success, data)
            
            if success:
                print(f"✅ {test_name} completed successfully")
            else:
                print(f"❌ {test_name} failed")
                
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results[test_name] = (False, {"error": str(e)})
        
        print()  # Add spacing between tests
    
    # Save results
    save_test_results(results)
    
    # Print summary
    successful_tests = sum(1 for success, _ in results.values() if success)
    total_tests = len(results)
    success_rate = (successful_tests / total_tests) * 100
    
    print("🏆 Test Summary")
    print("=" * 30)
    print(f"📊 Total Tests: {total_tests}")
    print(f"✅ Successful: {successful_tests}")
    print(f"❌ Failed: {total_tests - successful_tests}")
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate == 100:
        print("🎉 ALL TESTS PASSED - Alpha Vantage integration ready!")
        status = "SUCCESS"
    elif success_rate >= 75:
        print("🟡 MOSTLY SUCCESSFUL - Minor issues to resolve")
        status = "PARTIAL_SUCCESS"
    else:
        print("🔴 MULTIPLE FAILURES - Check API key and connectivity")
        status = "FAILURE"
    
    print(f"\n📁 Results saved to: {TEST_OUTPUT_DIR}")
    print(f"🎯 Final Status: {status}")
    
    return success_rate >= 75

if __name__ == "__main__":
    try:
        success = run_alpha_vantage_real_data_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test crashed: {e}")
        sys.exit(1)