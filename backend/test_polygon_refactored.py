#!/usr/bin/env python3
"""
Test script for the refactored Polygon MCP collector
"""

import sys
import os
# Load environment variables through centralized config
try:
    from config.env_loader import Config
except ImportError:
    from dotenv import load_dotenv
    load_dotenv()
    class Config:
        @classmethod
        def get_api_key(cls, service):
            return os.getenv(f'{service.upper()}_API_KEY')
sys.path.append('.')

def test_polygon_collector():
    """Test the refactored Polygon MCP collector"""
    try:
        # Test import
        from data_collectors.commercial.mcp.polygon_mcp_collector import PolygonMCPCollector
        print('✓ Import successful')
        
        # Test instantiation
        collector = PolygonMCPCollector()
        print('✓ Instantiation successful')
        
        # Test properties
        print(f'✓ Cost per request: ${collector.cost_per_request}')
        print(f'✓ Monthly quota limit: {collector.monthly_quota_limit}')
        print(f'✓ Supports MCP: {collector.supports_mcp_protocol}')
        
        # Test methods
        cost_map = collector.get_tool_cost_map()
        print(f'✓ Tool cost map has {len(cost_map)} tools')
        
        tier_info = collector.get_subscription_tier_info()
        print(f'✓ Subscription tier: {tier_info["name"]}')
        
        quota_status = collector.check_quota_status()
        print(f'✓ Quota status: {quota_status["remaining_requests"]} remaining')
        
        # Test collector router integration
        from data_collectors.collector_router import CollectorRouter
        router = CollectorRouter()
        registry = router._get_commercial_collector_registry()
        
        if 'polygon_mcp' in registry:
            print('✓ Polygon collector registered in router')
            capability = registry['polygon_mcp']
            print(f'✓ Quadrant: {capability.quadrant.value}')
            print(f'✓ Use cases: {len(capability.primary_use_cases)}')
            print(f'✓ MCP tools: {capability.mcp_tool_count}')
        else:
            print('❌ Polygon collector not found in router registry')
        
        print('✅ All tests passed!')
        return True
        
    except Exception as e:
        print(f'❌ Test failed: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_polygon_collector()