#!/usr/bin/env python3
"""
Quick test to verify Polygon MCP Collector router integration.
Validates that the collector properly implements router interface methods.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.data_collectors.commercial.mcp.polygon_mcp_collector import PolygonMCPCollector
from backend.data_collectors.collector_router import CollectorRouter, route_data_request

def test_polygon_router_compliance():
    """Test that Polygon MCP collector implements router interface correctly."""
    print("🔍 Testing Polygon MCP Collector Router Compliance")
    print("=" * 60)
    
    try:
        # Test 1: Instantiate collector
        print("📦 Instantiating Polygon MCP Collector...")
        collector = PolygonMCPCollector(api_key="test_key_for_interface_testing")
        print("✅ Collector instantiated successfully")
        
        # Test 2: Check required methods exist
        print("\n🔧 Checking router interface methods...")
        assert hasattr(collector, 'should_activate'), "Missing should_activate method"
        assert hasattr(collector, 'get_activation_priority'), "Missing get_activation_priority method"
        print("✅ Router interface methods present")
        
        # Test 3: Test activation logic
        print("\n🎯 Testing activation logic...")
        
        test_cases = [
            # Should activate
            ({'real_time': True}, True, "Real-time data"),
            ({'options': True}, True, "Options data"),
            ({'forex': True}, True, "Forex data"),
            ({'crypto': True}, True, "Crypto data"), 
            ({'time_period': 'intraday'}, True, "Intraday data"),
            ({'news_analysis': True}, True, "News analysis"),
            ({'futures': True}, True, "Futures data"),
            
            # Should not activate
            ({'companies': ['AAPL'], 'analysis_type': 'fundamental'}, False, "Basic fundamental analysis"),
            ({'sector': 'Technology'}, False, "Sector analysis"),
            ({'economic_indicator': 'GDP'}, False, "Economic data"),
        ]
        
        passed = 0
        for criteria, expected, description in test_cases:
            should_activate = collector.should_activate(criteria)
            priority = collector.get_activation_priority(criteria)
            
            if should_activate == expected:
                status = "✅"
                passed += 1
            else:
                status = "❌"
            
            print(f"  {status} {description}: activate={should_activate}, priority={priority}")
        
        print(f"\n📊 Activation tests: {passed}/{len(test_cases)} passed")
        
        # Test 4: Test router integration
        print("\n🔀 Testing full router integration...")
        
        router_test_cases = [
            # Real-time request should include Polygon
            {
                'criteria': {'companies': ['AAPL'], 'real_time': True},
                'should_include_polygon': True,
                'description': 'Real-time stock data'
            },
            
            # Options request should include Polygon
            {
                'criteria': {'companies': ['AAPL'], 'options': True},
                'should_include_polygon': True,
                'description': 'Options chain data'
            },
            
            # Basic fundamental should not include Polygon
            {
                'criteria': {'companies': ['AAPL'], 'analysis_type': 'fundamental'},
                'should_include_polygon': False,
                'description': 'Basic fundamental analysis'
            }
        ]
        
        router_passed = 0
        for test_case in router_test_cases:
            try:
                collectors = route_data_request(test_case['criteria'], budget_limit=100.0)
                collector_names = [c.__class__.__name__ for c in collectors]
                
                includes_polygon = 'PolygonMCPCollector' in collector_names
                expected = test_case['should_include_polygon']
                
                if includes_polygon == expected:
                    status = "✅"
                    router_passed += 1
                else:
                    status = "❌"
                
                print(f"  {status} {test_case['description']}: Polygon included={includes_polygon}")
                print(f"      Selected collectors: {collector_names}")
                
            except Exception as e:
                print(f"  ❌ {test_case['description']}: Error - {e}")
        
        print(f"\n📊 Router integration tests: {router_passed}/{len(router_test_cases)} passed")
        
        # Test 5: Priority scoring validation
        print("\n🎖️  Testing priority scoring...")
        high_priority_criteria = {'real_time': True, 'options': True, 'forex': True}
        priority = collector.get_activation_priority(high_priority_criteria)
        print(f"  High-priority request priority: {priority}")
        
        if priority >= 90:
            print("  ✅ High-priority scoring correct")
            priority_passed = True
        else:
            print("  ❌ High-priority scoring too low")
            priority_passed = False
        
        # Summary
        print("\n" + "=" * 60)
        print("🎉 POLYGON MCP ROUTER INTEGRATION SUMMARY")
        print("=" * 60)
        
        all_tests_passed = (
            passed == len(test_cases) and 
            router_passed == len(router_test_cases) and 
            priority_passed
        )
        
        if all_tests_passed:
            print("✅ ALL TESTS PASSED - Polygon MCP Collector is router compliant!")
            print("🚀 Ready for Four-Quadrant Collector Router integration")
        else:
            print("⚠️  Some tests failed - review implementation")
        
        print(f"\n📈 Test Results:")
        print(f"   - Activation Logic: {passed}/{len(test_cases)}")
        print(f"   - Router Integration: {router_passed}/{len(router_test_cases)}")
        print(f"   - Priority Scoring: {'✅' if priority_passed else '❌'}")
        
        return all_tests_passed
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_polygon_router_compliance()
    exit(0 if success else 1)