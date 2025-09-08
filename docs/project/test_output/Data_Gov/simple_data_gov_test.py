#!/usr/bin/env python3
"""
Simple Data.gov Real-Time Test

Simplified test to fetch real data from data.gov APIs using only standard library.
"""

import json
import urllib.request
import urllib.error
import time
from datetime import datetime
import sys

def test_sec_company_tickers():
    """Test SEC Company Tickers API."""
    print("🔍 Testing SEC Company Tickers API...")
    
    try:
        url = "https://www.sec.gov/files/company_tickers.json"
        
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'StockPicker-DataGov-Test/1.0')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            
            print(f"✅ SUCCESS: Found {len(data)} companies in SEC database")
            
            # Show sample companies
            sample_count = 0
            print("\n📊 Sample companies:")
            for key, company in data.items():
                if sample_count < 5:
                    print(f"  • {company.get('ticker', 'N/A')} - {company.get('title', 'Unknown')}")
                    sample_count += 1
                else:
                    break
            
            return {
                'success': True,
                'total_companies': len(data),
                'sample_data': dict(list(data.items())[:3])
            }
    
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return {'success': False, 'error': str(e)}

def test_treasury_fiscal_api():
    """Test Treasury Fiscal Data API."""
    print("\n🔍 Testing Treasury Fiscal Data API...")
    
    try:
        url = "https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/rates_of_exchange?limit=5"
        
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'StockPicker-DataGov-Test/1.0')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            
            records = data.get('data', [])
            print(f"✅ SUCCESS: Retrieved {len(records)} exchange rate records")
            
            if records:
                print("\n📊 Sample exchange rates:")
                for record in records[:3]:
                    country = record.get('country_currency_desc', 'Unknown')
                    rate = record.get('exchange_rate', 'N/A')
                    date = record.get('record_date', 'N/A')
                    print(f"  • {country}: {rate} (Date: {date})")
            
            return {
                'success': True,
                'records_count': len(records),
                'sample_data': records[:2]
            }
    
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return {'success': False, 'error': str(e)}

def test_sec_company_facts():
    """Test SEC Company Facts API for Apple."""
    print("\n🔍 Testing SEC Company Facts API (Apple)...")
    
    try:
        # Apple's CIK
        cik = "0000320193"
        url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
        
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'StockPicker-DataGov-Test/1.0')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            
            facts = data.get('facts', {})
            us_gaap = facts.get('us-gaap', {})
            
            print(f"✅ SUCCESS: Retrieved financial data for {data.get('entityName', 'Unknown Company')}")
            print(f"📊 Total US-GAAP facts: {len(us_gaap)}")
            
            # Show sample financial metrics
            sample_metrics = ['Assets', 'Revenues', 'NetIncomeLoss']
            print("\n📈 Sample financial facts available:")
            for metric in sample_metrics:
                if metric in us_gaap:
                    label = us_gaap[metric].get('label', metric)
                    print(f"  • {label}")
            
            return {
                'success': True,
                'company_name': data.get('entityName'),
                'cik': data.get('cik'),
                'total_facts': len(us_gaap),
                'sample_metrics': sample_metrics
            }
    
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return {'success': False, 'error': str(e)}

def test_treasury_daily_rates():
    """Test Treasury daily rates endpoint."""
    print("\n🔍 Testing Treasury Daily Rates API...")
    
    try:
        # Treasury MTS (Monthly Treasury Statement)
        url = "https://api.fiscaldata.treasury.gov/services/api/v1/accounting/mts/mts_table_1?limit=3"
        
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'StockPicker-DataGov-Test/1.0')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            
            records = data.get('data', [])
            print(f"✅ SUCCESS: Retrieved {len(records)} treasury financial records")
            
            if records:
                print("\n💰 Sample treasury data:")
                for record in records[:2]:
                    date = record.get('record_date', 'N/A')
                    classification = record.get('classification_desc', 'N/A')[:50]
                    amount = record.get('current_month_net_rcpt_outly_amt', 'N/A')
                    print(f"  • {date}: {classification} = ${amount}")
            
            return {
                'success': True,
                'records_count': len(records),
                'data_type': 'Monthly Treasury Statement',
                'sample_data': records[:1]
            }
    
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return {'success': False, 'error': str(e)}

def main():
    """Main test function."""
    print("🚀 REAL-TIME DATA.GOV API TEST")
    print("=" * 50)
    print(f"⏰ Test started at: {datetime.now().isoformat()}")
    print()
    
    # Run tests
    results = {
        'test_timestamp': datetime.now().isoformat(),
        'tests': {}
    }
    
    test_functions = [
        ('SEC Company Tickers', test_sec_company_tickers),
        ('Treasury Fiscal Data', test_treasury_fiscal_api),
        ('SEC Company Facts', test_sec_company_facts),
        ('Treasury Daily Rates', test_treasury_daily_rates)
    ]
    
    successful_tests = 0
    total_tests = len(test_functions)
    
    for test_name, test_func in test_functions:
        try:
            result = test_func()
            results['tests'][test_name] = result
            if result.get('success'):
                successful_tests += 1
            
            # Small delay between tests to be respectful
            time.sleep(1)
            
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {e}")
            results['tests'][test_name] = {'success': False, 'error': str(e)}
    
    # Generate summary
    success_rate = (successful_tests / total_tests) * 100
    results['summary'] = {
        'total_tests': total_tests,
        'successful_tests': successful_tests,
        'failed_tests': total_tests - successful_tests,
        'success_rate_percentage': success_rate
    }
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Total Tests:      {total_tests}")
    print(f"Successful:       {successful_tests} ✅")
    print(f"Failed:           {total_tests - successful_tests} ❌")
    print(f"Success Rate:     {success_rate:.1f}%")
    print()
    
    if success_rate >= 75:
        print("🎉 EXCELLENT! Data.gov APIs are highly available!")
        print("✅ Ready for MCP server integration")
    elif success_rate >= 50:
        print("🔶 GOOD! Most APIs working, minor issues detected")
    else:
        print("🔴 ATTENTION! Multiple API failures detected")
    
    print("\n💡 MCP INTEGRATION INSIGHTS:")
    print("• SEC data available for 15+ years of financial analysis")
    print("• Treasury data provides real-time economic context")
    print("• Government APIs are free and publicly accessible")
    print("• Ready for AI-native MCP tool integration")
    
    # Save results
    try:
        output_file = "data_gov_real_time_test_results.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n📄 Results saved to: {output_file}")
    except Exception as e:
        print(f"⚠️  Could not save results: {e}")
    
    return 0 if success_rate >= 50 else 1

if __name__ == '__main__':
    sys.exit(main())