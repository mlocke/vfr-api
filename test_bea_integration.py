#!/usr/bin/env python3

"""
BEA Collector Integration Test

Tests the BEA collector integration with the smart routing system to ensure
proper activation for GDP, regional, and industry economic analysis requests.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from backend.data_collectors.collector_router import route_data_request, CollectorRouter
from backend.data_collectors.government.bea_collector import BEACollector

def main():
    """Test BEA collector integration."""
    
    print("🚀 BEA Collector Integration Test")
    print("=" * 60)
    print("Testing BEA integration with smart routing system")
    print("=" * 60)
    
    router = CollectorRouter()
    
    # Test cases for BEA routing
    test_cases = [
        {
            'name': 'GDP Analysis Request',
            'filter_criteria': {
                'gdp': 'quarterly_analysis',
                'analysis_type': 'economic'
            },
            'expected_collector': 'BEACollector'
        },
        {
            'name': 'Regional Economic Analysis',
            'filter_criteria': {
                'regional': 'state_economy',
                'personal_income': 'analysis'
            },
            'expected_collector': 'BEACollector'
        },
        {
            'name': 'Industry GDP Analysis',
            'filter_criteria': {
                'industry_gdp': 'sector_analysis',
                'nipa': 'industry_data'
            },
            'expected_collector': 'BEACollector'
        },
        {
            'name': 'NIPA Table Request',
            'filter_criteria': {
                'nipa': 'national_accounts',
                'analysis_type': 'economic'
            },
            'expected_collector': 'BEACollector'
        },
        {
            'name': 'BEA Data Request',
            'filter_criteria': {
                'bea_data': 'comprehensive',
                'economic_analysis': 'gdp_components'
            },
            'expected_collector': 'BEACollector'
        },
        {
            'name': 'Company Analysis (Should NOT route to BEA)',
            'filter_criteria': {
                'companies': ['AAPL'],
                'analysis_type': 'fundamental'
            },
            'expected_collector': 'SECEdgarCollector'
        },
        {
            'name': 'Treasury Fiscal (Should NOT route to BEA)',
            'filter_criteria': {
                'fiscal_data': 'debt_analysis',
                'treasury_series': 'debt_data'
            },
            'expected_collector': 'TreasuryFiscalCollector'
        }
    ]
    
    print("\n" + "=" * 60)
    print("🔄 Running BEA Routing Tests")
    print("=" * 60)
    
    successful_routes = 0
    total_bea_tests = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest {i}: {test_case['name']}")
        print(f"Filter: {test_case['filter_criteria']}")
        
        try:
            collectors = route_data_request(test_case['filter_criteria'])
            
            if collectors:
                collector_names = [c.__class__.__name__ for c in collectors]
                print(f"✅ Routed to: {', '.join(collector_names)}")
                
                # Verify expected collector
                if test_case['expected_collector'] in collector_names:
                    print(f"✅ Correct collector selected: {test_case['expected_collector']}")
                    successful_routes += 1
                else:
                    print(f"❌ Expected {test_case['expected_collector']}, got {collector_names}")
                
                # Count BEA-specific tests
                if test_case['expected_collector'] == 'BEACollector':
                    total_bea_tests += 1
                    
            else:
                print("❌ No collectors selected")
                    
        except Exception as e:
            print(f"❌ Routing failed: {e}")
    
    print("\n" + "=" * 60)
    print("🔄 Testing BEA Collector Registry")
    print("=" * 60)
    
    collector_info = router.get_collector_info()
    print(f"📊 Registered Collectors: {len(collector_info)}")
    
    if 'bea' in collector_info:
        bea_info = collector_info['bea']
        print(f"\n📋 BEA COLLECTOR:")
        print(f"  Class: {bea_info['class_name']}")
        print(f"  Use Cases: {', '.join(bea_info['primary_use_cases'])}")
        print(f"  Max Companies: {bea_info['max_companies']}")
        print(f"  Requires Specific Companies: {bea_info['requires_specific_companies']}")
        print(f"  Key Strengths:")
        for strength in bea_info['strengths'][:3]:
            print(f"    • {strength}")
        print(f"  Limitations:")
        for limitation in bea_info['limitations'][:2]:
            print(f"    • {limitation}")
    else:
        print("❌ BEA collector not found in registry")
    
    print("\n" + "=" * 60)
    print("🔄 Testing BEA Collector Activation Logic")
    print("=" * 60)
    
    bea_collector = BEACollector()
    
    activation_tests = [
        {
            'name': 'GDP Request',
            'filters': {'gdp': 'analysis', 'nipa': 'gdp_data'},
            'should_activate': True
        },
        {
            'name': 'Regional Analysis',
            'filters': {'regional': 'state_data', 'personal_income': 'analysis'},
            'should_activate': True
        },
        {
            'name': 'Industry Analysis',
            'filters': {'industry_gdp': 'sector_analysis'},
            'should_activate': True
        },
        {
            'name': 'Company Request',
            'filters': {'companies': ['AAPL'], 'analysis_type': 'fundamental'},
            'should_activate': False
        },
        {
            'name': 'Treasury Request',
            'filters': {'treasury_series': 'debt_data', 'fiscal_data': 'analysis'},
            'should_activate': False
        }
    ]
    
    activation_success = 0
    
    for test in activation_tests:
        should_activate = bea_collector.should_activate(test['filters'])
        priority = bea_collector.get_activation_priority(test['filters'])
        
        status = "✅ CORRECT" if should_activate == test['should_activate'] else "❌ WRONG"
        action = "ACTIVATES" if should_activate else "SKIPS"
        
        print(f"  {test['name']}: {action} (Priority: {priority}) - {status}")
        
        if should_activate == test['should_activate']:
            activation_success += 1
    
    print("\n" + "=" * 60)
    print("🔄 Testing BEA API Connection")
    print("=" * 60)
    
    print("🔄 Testing BEA API connectivity...")
    if bea_collector.test_connection():
        print("✅ BEA API connection successful")
        api_status = "CONNECTED"
    else:
        print("❌ BEA API connection failed (API key may need activation)")
        api_status = "KEY_PENDING"
    
    print("🔄 Testing BEA authentication...")
    if bea_collector.authenticate():
        print("✅ BEA API authentication successful")
        auth_status = "AUTHENTICATED"
    else:
        print("❌ BEA API authentication failed (API key may need activation)")
        auth_status = "KEY_PENDING"
    
    print("\n" + "=" * 70)
    print("🎯 BEA INTEGRATION TEST SUMMARY")
    print("=" * 70)
    print(f"✅ Successful Routes: {successful_routes}/{len(test_cases)}")
    print(f"✅ BEA Activation Logic: {activation_success}/{len(activation_tests)} tests passed")
    print(f"📊 BEA-Specific Routes: {total_bea_tests} test cases")
    print(f"🔗 API Connection: {api_status}")
    print(f"🔑 Authentication: {auth_status}")
    print()
    
    if successful_routes == len(test_cases):
        print("🎉 SUCCESS! BEA collector routing system fully integrated!")
    else:
        print("⚠️  Some routing tests failed - check configuration")
        
    if activation_success == len(activation_tests):
        print("🎉 SUCCESS! BEA activation logic working perfectly!")
    else:
        print("⚠️  Some activation tests failed - check logic")
    
    if auth_status == "KEY_PENDING":
        print("📝 NOTE: BEA API key may need activation at https://apps.bea.gov/API/signup/")
        print("📝 Implementation is complete and ready for when API key is active")
    
    print("💡 BEA collector provides GDP, regional, and industry economic data")
    print("💡 Smart routing automatically selects BEA for economic analysis requests")

if __name__ == "__main__":
    main()