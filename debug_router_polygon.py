#!/usr/bin/env python3
"""
Debug script to examine why Polygon MCP collector isn't being selected by router.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.data_collectors.collector_router import CollectorRouter, route_data_request

def debug_polygon_router():
    """Debug Polygon router integration step by step."""
    print("🔍 Debugging Polygon MCP Router Integration")
    print("=" * 60)
    
    # Create router
    router = CollectorRouter()
    
    print("📋 Registered Collectors:")
    for name, capability in router.collector_registry.items():
        print(f"  - {name}: {capability.collector_class.__name__}")
        print(f"    Primary use cases: {capability.primary_use_cases}")
        print(f"    Quadrant: {capability.quadrant}")
        print()
    
    # Test request analysis
    test_criteria = {'companies': ['AAPL'], 'real_time': True}
    
    print(f"🎯 Test criteria: {test_criteria}")
    
    # Analyze request
    analysis = router._analyze_request(test_criteria)
    print(f"📊 Request analysis: {analysis}")
    
    # Find capable collectors 
    capable = router._find_capable_collectors(test_criteria, analysis)
    print(f"✅ Capable collectors: {[c.collector_class.__name__ for c in capable]}")
    
    # Test route_data_request directly
    print("\n🔀 Testing route_data_request...")
    try:
        collectors = route_data_request(test_criteria, budget_limit=100.0)
        collector_names = [c.__class__.__name__ for c in collectors]
        print(f"Selected collectors: {collector_names}")
    except Exception as e:
        print(f"Error in route_data_request: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_polygon_router()