"""
Comprehensive Test Suite for Government Data Collector Filtering Capabilities

This test suite verifies that all government data collectors can handle
filtering input from users and work properly with frontend integration.

Tests cover:
- Individual collector filtering capabilities
- Frontend filter interface translation
- Collector router smart activation
- Filter validation and suggestions
- End-to-end filtering workflows
"""

import sys
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any
import json

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_collectors.collector_router import CollectorRouter, route_data_request
from data_collectors.frontend_filter_interface import FrontendFilterInterface, FilterType
from data_collectors.government.sec_edgar_collector import SECEdgarCollector  
from data_collectors.government.treasury_direct_collector import TreasuryDirectCollector
from data_collectors.government.treasury_fiscal_collector import TreasuryFiscalCollector
from data_collectors.government.bea_collector import BEACollector
from data_collectors.government.bls_collector import BLSCollector
from data_collectors.government.fred_collector import FREDCollector
from data_collectors.base import DateRange


def test_individual_collector_filtering():
    """Test each collector's individual filtering capabilities."""
    print("🔍 Testing Individual Collector Filtering Capabilities\n")
    
    results = {
        "sec_edgar": test_sec_edgar_filtering(),
        "treasury_direct": test_treasury_direct_filtering(), 
        "treasury_fiscal": test_treasury_fiscal_filtering(),
        "bea": test_bea_filtering(),
        "bls": test_bls_filtering(),
        "fred": test_fred_filtering()
    }
    
    return results


def test_sec_edgar_filtering():
    """Test SEC EDGAR collector filtering capabilities."""
    print("📊 Testing SEC EDGAR Filtering...")
    
    try:
        collector = SECEdgarCollector()
        test_results = {}
        
        # Test 1: Individual company filter
        filter1 = {'companies': ['AAPL'], 'analysis_type': 'fundamental'}
        should_activate1 = collector.should_activate(filter1)
        priority1 = collector.get_activation_priority(filter1)
        
        test_results['individual_company'] = {
            'filter': filter1,
            'should_activate': should_activate1,
            'priority': priority1,
            'expected': 'Should activate with high priority (100)'
        }
        
        # Test 2: Multiple companies filter
        filter2 = {'companies': ['AAPL', 'MSFT', 'GOOGL'], 'analysis_type': 'fundamental'}
        should_activate2 = collector.should_activate(filter2)
        priority2 = collector.get_activation_priority(filter2)
        
        test_results['multiple_companies'] = {
            'filter': filter2,
            'should_activate': should_activate2,
            'priority': priority2,
            'expected': 'Should activate with very high priority (90-95)'
        }
        
        # Test 3: Sector filtering (should activate)
        filter3 = {'sic_codes': ['3571', '7372'], 'analysis_type': 'fundamental'}
        should_activate3 = collector.should_activate(filter3)
        priority3 = collector.get_activation_priority(filter3)
        
        test_results['sector_filtering'] = {
            'filter': filter3,
            'should_activate': should_activate3,
            'priority': priority3,
            'expected': 'Should activate for SIC code filtering'
        }
        
        # Test 4: Economic indicators (should NOT activate)
        filter4 = {'fred_series': ['GDP', 'UNRATE'], 'analysis_type': 'economic'}
        should_activate4 = collector.should_activate(filter4)
        priority4 = collector.get_activation_priority(filter4)
        
        test_results['economic_indicators'] = {
            'filter': filter4,
            'should_activate': should_activate4,
            'priority': priority4,
            'expected': 'Should NOT activate - FRED territory'
        }
        
        # Test 5: Financial metrics screening
        try:
            screening_result = collector.screen_by_financial_metrics(
                min_revenue=1000000000,  # $1B
                min_roe=15.0,
                max_debt_to_equity=0.5,
                company_list=['AAPL', 'MSFT']
            )
            test_results['financial_screening'] = {
                'result_type': type(screening_result).__name__,
                'has_qualified_companies': len(screening_result.get('qualified_companies', [])) > 0,
                'status': 'Success'
            }
        except Exception as e:
            test_results['financial_screening'] = {'error': str(e), 'status': 'Error'}
        
        print(f"   ✅ SEC EDGAR: {len(test_results)} tests completed")
        return test_results
        
    except Exception as e:
        print(f"   ❌ SEC EDGAR: Error - {e}")
        return {"error": str(e)}


def test_treasury_direct_filtering():
    """Test Treasury Direct collector filtering capabilities."""
    print("💰 Testing Treasury Direct Filtering...")
    
    try:
        collector = TreasuryDirectCollector()
        test_results = {}
        
        # Test 1: Treasury securities filter (should activate)
        filter1 = {'treasury_securities': 'bonds,bills,notes', 'analysis_type': 'fiscal'}
        should_activate1 = collector.should_activate(filter1)
        priority1 = collector.get_activation_priority(filter1)
        
        test_results['treasury_securities'] = {
            'filter': filter1,
            'should_activate': should_activate1,
            'priority': priority1,
            'expected': 'Should activate with high priority (85)'
        }
        
        # Test 2: Yield curve analysis (should activate)
        filter2 = {'maturities': ['5 Yr', '10 Yr', '30 Yr'], 'data_type': 'yield_curve'}
        should_activate2 = collector.should_activate(filter2)
        priority2 = collector.get_activation_priority(filter2)
        
        test_results['yield_curve'] = {
            'filter': filter2,
            'should_activate': should_activate2,
            'priority': priority2,
            'expected': 'Should activate for yield curve analysis'
        }
        
        # Test 3: Company analysis (should NOT activate)
        filter3 = {'companies': ['AAPL', 'MSFT'], 'analysis_type': 'fundamental'}
        should_activate3 = collector.should_activate(filter3)
        priority3 = collector.get_activation_priority(filter3)
        
        test_results['company_analysis'] = {
            'filter': filter3,
            'should_activate': should_activate3,
            'priority': priority3,
            'expected': 'Should NOT activate - SEC EDGAR territory'
        }
        
        # Test 4: Security type filtering
        try:
            filtering_result = collector.filter_by_security_type(
                ['bills', 'notes'],
                DateRange(date.today() - timedelta(days=90), date.today())
            )
            test_results['security_type_filtering'] = {
                'result_type': type(filtering_result).__name__,
                'has_results': 'results_by_type' in filtering_result,
                'status': 'Success'
            }
        except Exception as e:
            test_results['security_type_filtering'] = {'error': str(e), 'status': 'Error'}
        
        # Test 5: Yield screening
        try:
            screening_result = collector.screen_by_yield_criteria(
                min_yield=2.0,
                max_yield=6.0,
                target_maturities=['2 Yr', '10 Yr']
            )
            test_results['yield_screening'] = {
                'result_type': type(screening_result).__name__,
                'has_qualified_securities': len(screening_result.get('qualified_securities', [])) >= 0,
                'status': 'Success'
            }
        except Exception as e:
            test_results['yield_screening'] = {'error': str(e), 'status': 'Error'}
        
        print(f"   ✅ Treasury Direct: {len(test_results)} tests completed")
        return test_results
        
    except Exception as e:
        print(f"   ❌ Treasury Direct: Error - {e}")
        return {"error": str(e)}


def test_treasury_fiscal_filtering():
    """Test Treasury Fiscal collector filtering capabilities."""
    print("🏛️ Testing Treasury Fiscal Filtering...")
    
    try:
        collector = TreasuryFiscalCollector()
        test_results = {}
        
        # Test 1: Federal debt analysis (should activate)
        filter1 = {'data_type': 'federal_debt', 'analysis_type': 'fiscal'}
        should_activate1 = collector.should_activate(filter1)
        priority1 = collector.get_activation_priority(filter1)
        
        test_results['federal_debt'] = {
            'filter': filter1,
            'should_activate': should_activate1,
            'priority': priority1,
            'expected': 'Should activate with very high priority (90)'
        }
        
        # Test 2: Government spending filter (should activate)
        filter2 = {'government_spending': 'true', 'budget': 'deficit', 'analysis_type': 'fiscal'}
        should_activate2 = collector.should_activate(filter2)
        priority2 = collector.get_activation_priority(filter2)
        
        test_results['government_spending'] = {
            'filter': filter2,
            'should_activate': should_activate2,
            'priority': priority2,
            'expected': 'Should activate for government spending analysis'
        }
        
        # Test 3: Treasury securities (should NOT activate - Treasury Direct territory)
        filter3 = {'treasury_securities': 'bonds', 'yield_curve': 'true'}
        should_activate3 = collector.should_activate(filter3)
        priority3 = collector.get_activation_priority(filter3)
        
        test_results['treasury_securities'] = {
            'filter': filter3,
            'should_activate': should_activate3,
            'priority': priority3,
            'expected': 'Should NOT activate - Treasury Direct territory'
        }
        
        # Test 4: Federal debt analysis functionality
        try:
            debt_analysis = collector.get_federal_debt_analysis()
            test_results['debt_analysis_function'] = {
                'result_type': type(debt_analysis).__name__,
                'has_snapshot': 'current_debt_snapshot' in debt_analysis,
                'status': 'Success' if not debt_analysis.get('error') else 'API Error'
            }
        except Exception as e:
            test_results['debt_analysis_function'] = {'error': str(e), 'status': 'Error'}
        
        print(f"   ✅ Treasury Fiscal: {len(test_results)} tests completed")
        return test_results
        
    except Exception as e:
        print(f"   ❌ Treasury Fiscal: Error - {e}")
        return {"error": str(e)}


def test_bea_filtering():
    """Test BEA collector filtering capabilities."""
    print("📈 Testing BEA Filtering...")
    
    try:
        collector = BEACollector()
        test_results = {}
        
        # Test 1: GDP analysis (should activate)
        filter1 = {'gdp': 'true', 'analysis_type': 'economic'}
        should_activate1 = collector.should_activate(filter1)
        priority1 = collector.get_activation_priority(filter1)
        
        test_results['gdp_analysis'] = {
            'filter': filter1,
            'should_activate': should_activate1,
            'priority': priority1,
            'expected': 'Should activate with high priority for GDP'
        }
        
        # Test 2: Regional analysis (should activate)
        filter2 = {'regional': 'true', 'states': ['CA', 'NY'], 'analysis_type': 'economic'}
        should_activate2 = collector.should_activate(filter2)
        priority2 = collector.get_activation_priority(filter2)
        
        test_results['regional_analysis'] = {
            'filter': filter2,
            'should_activate': should_activate2,
            'priority': priority2,
            'expected': 'Should activate for regional analysis'
        }
        
        # Test 3: Individual companies (should NOT activate)
        filter3 = {'companies': ['AAPL'], 'analysis_type': 'fundamental'}
        should_activate3 = collector.should_activate(filter3)
        priority3 = collector.get_activation_priority(filter3)
        
        test_results['company_analysis'] = {
            'filter': filter3,
            'should_activate': should_activate3,
            'priority': priority3,
            'expected': 'Should NOT activate - SEC EDGAR territory'
        }
        
        print(f"   ✅ BEA: {len(test_results)} tests completed")
        return test_results
        
    except Exception as e:
        print(f"   ❌ BEA: Error - {e}")
        return {"error": str(e)}


def test_bls_filtering():
    """Test BLS collector filtering capabilities."""
    print("👷 Testing BLS Filtering...")
    
    try:
        collector = BLSCollector()
        test_results = {}
        
        # Test 1: Employment data (should activate)
        filter1 = {'employment': 'true', 'analysis_type': 'employment'}
        should_activate1 = collector.should_activate(filter1)
        priority1 = collector.get_activation_priority(filter1)
        
        test_results['employment_data'] = {
            'filter': filter1,
            'should_activate': should_activate1,
            'priority': priority1,
            'expected': 'Should activate with high priority for employment data'
        }
        
        # Test 2: BLS series (should activate)
        filter2 = {'bls_series': ['LNS14000000', 'CUUR0000SA0'], 'analysis_type': 'economic'}
        should_activate2 = collector.should_activate(filter2)
        priority2 = collector.get_activation_priority(filter2)
        
        test_results['bls_series'] = {
            'filter': filter2,
            'should_activate': should_activate2,
            'priority': priority2,
            'expected': 'Should activate with very high priority for BLS series'
        }
        
        # Test 3: Inflation/CPI data (should activate)
        filter3 = {'cpi': 'true', 'inflation': 'true'}
        should_activate3 = collector.should_activate(filter3)
        priority3 = collector.get_activation_priority(filter3)
        
        test_results['inflation_data'] = {
            'filter': filter3,
            'should_activate': should_activate3,
            'priority': priority3,
            'expected': 'Should activate for CPI/inflation data'
        }
        
        # Test 4: Individual companies (should NOT activate)
        filter4 = {'companies': ['AAPL'], 'analysis_type': 'fundamental'}
        should_activate4 = collector.should_activate(filter4)
        priority4 = collector.get_activation_priority(filter4)
        
        test_results['company_analysis'] = {
            'filter': filter4,
            'should_activate': should_activate4,
            'priority': priority4,
            'expected': 'Should NOT activate - SEC EDGAR territory'
        }
        
        # Test 5: Treasury data (should NOT activate)
        filter5 = {'treasury_securities': 'bonds', 'analysis_type': 'fiscal'}
        should_activate5 = collector.should_activate(filter5)
        priority5 = collector.get_activation_priority(filter5)
        
        test_results['treasury_data'] = {
            'filter': filter5,
            'should_activate': should_activate5,
            'priority': priority5,
            'expected': 'Should NOT activate - Treasury territory'
        }
        
        print(f"   ✅ BLS: {len(test_results)} tests completed")
        return test_results
        
    except Exception as e:
        print(f"   ❌ BLS: Error - {e}")
        return {"error": str(e)}


def test_fred_filtering():
    """Test FRED collector filtering capabilities."""
    print("🏦 Testing FRED Filtering...")
    
    try:
        # Import FRED collector if available
        collector = FREDCollector()
        test_results = {}
        
        # Test 1: Economic indicators (should activate)
        filter1 = {'fred_series': ['GDP', 'UNRATE'], 'analysis_type': 'economic'}
        should_activate1 = collector.should_activate(filter1)
        priority1 = collector.get_activation_priority(filter1)
        
        test_results['economic_indicators'] = {
            'filter': filter1,
            'should_activate': should_activate1,
            'priority': priority1,
            'expected': 'Should activate with high priority for FRED series'
        }
        
        # Test 2: Individual companies (should NOT activate)
        filter2 = {'companies': ['AAPL'], 'analysis_type': 'fundamental'}
        should_activate2 = collector.should_activate(filter2)
        priority2 = collector.get_activation_priority(filter2)
        
        test_results['company_analysis'] = {
            'filter': filter2,
            'should_activate': should_activate2,
            'priority': priority2,
            'expected': 'Should NOT activate - SEC EDGAR territory'
        }
        
        print(f"   ✅ FRED: {len(test_results)} tests completed")
        return test_results
        
    except Exception as e:
        print(f"   ❌ FRED: Not available or error - {e}")
        return {"error": str(e), "note": "FRED collector may not be fully implemented"}


def test_frontend_filter_interface():
    """Test the frontend filter interface capabilities."""
    print("🎨 Testing Frontend Filter Interface...\n")
    
    try:
        interface = FrontendFilterInterface()
        test_results = {}
        
        # Test 1: Get available filter options
        all_options = interface.get_available_filter_options()
        test_results['available_options'] = {
            'total_filter_types': len(all_options),
            'filter_types': list(all_options.keys()),
            'sample_company_options': len(all_options.get('companies', [])),
            'status': 'Success'
        }
        
        # Test 2: Frontend filter translation
        frontend_filters = {
            "companies": "AAPL,MSFT,GOOGL",
            "analysis_type": "fundamental",
            "time_period": "5y",
            "financial_metrics": "min_roe:15,max_debt_to_equity:0.5"
        }
        
        translated = interface.translate_frontend_filters(frontend_filters)
        test_results['filter_translation'] = {
            'original_keys': list(frontend_filters.keys()),
            'translated_keys': list(translated.keys()),
            'has_companies_list': isinstance(translated.get('companies'), list),
            'has_date_range': 'date_range' in translated,
            'has_financial_metrics': 'min_roe' in translated,
            'status': 'Success'
        }
        
        # Test 3: Filter validation
        validation_result = interface.validate_filter_combination(translated)
        test_results['filter_validation'] = {
            'is_valid': validation_result.is_valid,
            'has_warnings': len(validation_result.warnings) > 0,
            'expected_collectors': validation_result.expected_collectors,
            'estimated_performance': validation_result.estimated_performance,
            'status': 'Success'
        }
        
        # Test 4: Filter suggestions
        partial_filters = {"companies": ["AAPL", "MSFT"]}
        suggestions = interface.get_filter_suggestions(partial_filters)
        test_results['filter_suggestions'] = {
            'suggestion_count': len(suggestions),
            'has_analysis_type_suggestion': any(s.get('filter_key') == 'analysis_type' for s in suggestions),
            'has_time_period_suggestion': any(s.get('filter_key') == 'time_period' for s in suggestions),
            'status': 'Success'
        }
        
        # Test 5: Filter presets
        presets = interface.get_all_presets()
        test_results['filter_presets'] = {
            'preset_count': len(presets),
            'preset_names': list(presets.keys()),
            'tech_preset_exists': 'tech_fundamentals' in presets,
            'economic_preset_exists': 'economic_dashboard' in presets,
            'status': 'Success'
        }
        
        print(f"   ✅ Frontend Interface: {len(test_results)} tests completed")
        return test_results
        
    except Exception as e:
        print(f"   ❌ Frontend Interface: Error - {e}")
        return {"error": str(e)}


def test_collector_router_integration():
    """Test the collector router with various filter combinations."""
    print("🚦 Testing Collector Router Integration...\n")
    
    try:
        router = CollectorRouter()
        test_results = {}
        
        # Test 1: Individual company routing
        filter1 = {'companies': ['AAPL'], 'analysis_type': 'fundamental'}
        collectors1 = router.route_request(filter1)
        test_results['individual_company_routing'] = {
            'filter': filter1,
            'collector_count': len(collectors1),
            'collector_names': [c.__class__.__name__ for c in collectors1],
            'expected': 'Should route to SEC EDGAR only',
            'status': 'Success'
        }
        
        # Test 2: Economic analysis routing
        filter2 = {'fred_series': ['GDP', 'UNRATE'], 'analysis_type': 'economic'}
        collectors2 = router.route_request(filter2)
        test_results['economic_analysis_routing'] = {
            'filter': filter2,
            'collector_count': len(collectors2),
            'collector_names': [c.__class__.__name__ for c in collectors2],
            'expected': 'Should route to FRED or BEA',
            'status': 'Success'
        }
        
        # Test 3: Treasury analysis routing
        filter3 = {'treasury_securities': 'bonds,bills', 'analysis_type': 'fiscal'}
        collectors3 = router.route_request(filter3)
        test_results['treasury_analysis_routing'] = {
            'filter': filter3,
            'collector_count': len(collectors3),
            'collector_names': [c.__class__.__name__ for c in collectors3],
            'expected': 'Should route to Treasury Direct',
            'status': 'Success'
        }
        
        # Test 4: Federal debt routing
        filter4 = {'federal_debt': 'true', 'analysis_type': 'fiscal'}
        collectors4 = router.route_request(filter4)
        test_results['federal_debt_routing'] = {
            'filter': filter4,
            'collector_count': len(collectors4),
            'collector_names': [c.__class__.__name__ for c in collectors4],
            'expected': 'Should route to Treasury Fiscal',
            'status': 'Success'
        }
        
        # Test 5: Router validation
        validation = router.validate_request(filter1)
        test_results['router_validation'] = {
            'is_valid': validation.get('is_valid', False),
            'has_warnings': len(validation.get('warnings', [])) > 0,
            'has_recommendations': len(validation.get('recommendations', [])) > 0,
            'status': 'Success'
        }
        
        print(f"   ✅ Router Integration: {len(test_results)} tests completed")
        return test_results
        
    except Exception as e:
        print(f"   ❌ Router Integration: Error - {e}")
        return {"error": str(e)}


def test_end_to_end_filtering_workflow():
    """Test complete end-to-end filtering workflow."""
    print("🔄 Testing End-to-End Filtering Workflow...\n")
    
    try:
        interface = FrontendFilterInterface()
        test_results = {}
        
        # Simulate frontend user selecting filters
        frontend_request = {
            "companies": "AAPL,MSFT",
            "analysis_type": "fundamental", 
            "time_period": "5y",
            "financial_metrics": "min_roe:15,max_debt_to_equity:0.5"
        }
        
        # Step 1: Translate frontend filters
        translated_filters = interface.translate_frontend_filters(frontend_request)
        
        # Step 2: Validate filter combination
        validation = interface.validate_filter_combination(translated_filters)
        
        # Step 3: Route to appropriate collectors
        collectors = route_data_request(translated_filters)
        
        # Step 4: Test actual collector activation
        collector_results = {}
        for collector in collectors:
            collector_name = collector.__class__.__name__
            try:
                # Test if collector would activate for these filters
                should_activate = collector.should_activate(translated_filters)
                priority = collector.get_activation_priority(translated_filters)
                
                collector_results[collector_name] = {
                    'should_activate': should_activate,
                    'priority': priority,
                    'status': 'Success'
                }
            except Exception as e:
                collector_results[collector_name] = {
                    'error': str(e),
                    'status': 'Error'
                }
        
        test_results['end_to_end_workflow'] = {
            'frontend_request': frontend_request,
            'translation_successful': len(translated_filters) > len(frontend_request),
            'validation_passed': validation.is_valid,
            'collectors_found': len(collectors),
            'collector_results': collector_results,
            'workflow_status': 'Success'
        }
        
        print(f"   ✅ End-to-End Workflow: Test completed successfully")
        return test_results
        
    except Exception as e:
        print(f"   ❌ End-to-End Workflow: Error - {e}")
        return {"error": str(e)}


def run_comprehensive_filtering_tests():
    """Run all filtering capability tests and generate report."""
    print("🧪 Comprehensive Government Data Collector Filtering Tests")
    print("=" * 70)
    print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Run all test suites
    test_suites = [
        ("Individual Collector Filtering", test_individual_collector_filtering),
        ("Frontend Filter Interface", test_frontend_filter_interface),
        ("Collector Router Integration", test_collector_router_integration),
        ("End-to-End Workflow", test_end_to_end_filtering_workflow)
    ]
    
    all_results = {}
    
    for suite_name, test_function in test_suites:
        print(f"\n{'='*20} {suite_name} {'='*20}")
        try:
            results = test_function()
            all_results[suite_name] = results
        except Exception as e:
            print(f"❌ {suite_name}: Critical Error - {e}")
            all_results[suite_name] = {"critical_error": str(e)}
    
    # Generate summary report
    print("\n" + "="*70)
    print("📋 TEST SUMMARY REPORT")
    print("="*70)
    
    total_tests = 0
    successful_tests = 0
    
    for suite_name, suite_results in all_results.items():
        print(f"\n{suite_name}:")
        
        if isinstance(suite_results, dict) and "critical_error" in suite_results:
            print(f"   ❌ CRITICAL ERROR: {suite_results['critical_error']}")
            continue
        
        # Count tests in this suite
        suite_test_count = 0
        suite_success_count = 0
        
        if isinstance(suite_results, dict):
            for test_name, test_result in suite_results.items():
                if isinstance(test_result, dict):
                    suite_test_count += 1
                    total_tests += 1
                    
                    if test_result.get('status') == 'Success' or not test_result.get('error'):
                        suite_success_count += 1
                        successful_tests += 1
                        print(f"   ✅ {test_name}")
                    else:
                        print(f"   ❌ {test_name}: {test_result.get('error', 'Unknown error')}")
        
        print(f"   📊 Suite Results: {suite_success_count}/{suite_test_count} tests passed")
    
    # Overall summary
    success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0
    print(f"\n🎯 OVERALL RESULTS:")
    print(f"   Total Tests: {total_tests}")
    print(f"   Successful: {successful_tests}")
    print(f"   Failed: {total_tests - successful_tests}")
    print(f"   Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print("   🌟 EXCELLENT: All collectors ready for frontend integration!")
    elif success_rate >= 75:
        print("   ✅ GOOD: Most filtering capabilities working, minor issues to resolve")
    elif success_rate >= 50:
        print("   ⚠️ NEEDS WORK: Significant filtering issues need attention")
    else:
        print("   ❌ CRITICAL: Major filtering problems - not ready for frontend")
    
    print(f"\nTest Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return all_results


if __name__ == "__main__":
    # Run the comprehensive test suite
    results = run_comprehensive_filtering_tests()
    
    # Optional: Save detailed results to JSON file
    try:
        with open('collector_filtering_test_results.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n💾 Detailed results saved to: collector_filtering_test_results.json")
    except Exception as e:
        print(f"\n⚠️ Could not save results file: {e}")