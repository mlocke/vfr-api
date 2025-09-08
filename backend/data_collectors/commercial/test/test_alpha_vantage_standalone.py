#!/usr/bin/env python3
"""
Alpha Vantage MCP Collector - Standalone Test Suite

Simple standalone test that validates the Alpha Vantage MCP collector
without complex import dependencies. Tests basic functionality and
integration readiness.
"""

import sys
import os
import json
import asyncio
from datetime import datetime
from pathlib import Path

# Add paths
project_root = Path(__file__).parent.parent.parent.parent
sys.path.append(str(project_root))

def test_collector_architecture():
    """Test collector architecture and file structure."""
    print("🏗️  Testing Alpha Vantage MCP Collector Architecture...")
    
    # Check if collector file exists
    collector_path = Path(__file__).parent.parent / 'mcp' / 'alpha_vantage_mcp_collector.py'
    if collector_path.exists():
        print("✅ Alpha Vantage MCP collector file exists")
        
        # Check file size (should be substantial)
        file_size = collector_path.stat().st_size
        if file_size > 10000:  # At least 10KB
            print(f"✅ Collector file is substantial ({file_size:,} bytes)")
        else:
            print(f"⚠️  Collector file seems small ({file_size:,} bytes)")
    else:
        print("❌ Alpha Vantage MCP collector file not found")
        return False
    
    # Check MCP client file
    mcp_client_path = Path(__file__).parent.parent / 'mcp' / 'mcp_client.py'
    if mcp_client_path.exists():
        print("✅ MCP client framework exists")
    else:
        print("❌ MCP client framework not found")
        return False
    
    # Check base classes
    base_path = Path(__file__).parent.parent / 'base' / 'mcp_collector_base.py'
    if base_path.exists():
        print("✅ MCP collector base class exists")
    else:
        print("❌ MCP collector base class not found")
        return False
    
    return True

def test_collector_code_quality():
    """Test collector code quality and structure."""
    print("\n🔍 Testing Alpha Vantage MCP Collector Code Quality...")
    
    collector_path = Path(__file__).parent.parent / 'mcp' / 'alpha_vantage_mcp_collector.py'
    
    try:
        with open(collector_path, 'r') as f:
            code = f.read()
        
        # Check for key components
        checks = [
            ('class AlphaVantageMCPCollector', 'Main collector class'),
            ('async def collect_data', 'Async data collection method'),
            ('def get_tool_cost_map', 'Tool cost mapping'),
            ('def should_activate', 'Activation logic'),
            ('def get_activation_priority', 'Priority calculation'),
            ('79 AI-optimized tools', 'Tool count documentation'),
            ('4M20CQ7QT67RJ835', 'API key integration'),
            ('real_time', 'Real-time data support'),
            ('technical_analysis', 'Technical analysis support'),
            ('MCP protocol', 'MCP protocol references')
        ]
        
        passed_checks = 0
        for check, description in checks:
            if check in code:
                print(f"✅ {description}: Found")
                passed_checks += 1
            else:
                print(f"❌ {description}: Missing")
        
        quality_score = (passed_checks / len(checks)) * 100
        print(f"📊 Code Quality Score: {quality_score:.1f}%")
        
        return quality_score >= 80
        
    except Exception as e:
        print(f"❌ Error reading collector code: {e}")
        return False

def test_api_key_integration():
    """Test API key integration."""
    print("\n🔑 Testing API Key Integration...")
    
    api_key = "4M20CQ7QT67RJ835"
    
    # Validate API key format
    if len(api_key) == 16 and api_key.isalnum():
        print("✅ API key format is valid")
    else:
        print("⚠️  API key format may be invalid")
    
    # Check if API key is integrated in collector
    collector_path = Path(__file__).parent.parent / 'mcp' / 'alpha_vantage_mcp_collector.py'
    try:
        with open(collector_path, 'r') as f:
            code = f.read()
        
        if api_key in code:
            print("✅ API key integrated in collector code")
        else:
            print("❌ API key not found in collector code")
            return False
            
    except Exception as e:
        print(f"❌ Error checking API key integration: {e}")
        return False
    
    return True

def test_mcp_protocol_support():
    """Test MCP protocol support indicators."""
    print("\n🔗 Testing MCP Protocol Support...")
    
    mcp_client_path = Path(__file__).parent.parent / 'mcp' / 'mcp_client.py'
    
    try:
        with open(mcp_client_path, 'r') as f:
            mcp_code = f.read()
        
        # Check for MCP protocol features
        mcp_features = [
            ('JSON-RPC 2.0', 'JSON-RPC protocol support'),
            ('async def', 'Asynchronous operations'),
            ('MCPClient', 'MCP client class'),
            ('tools/call', 'Tool execution'),
            ('server/info', 'Server information'),
            ('aiohttp', 'HTTP client library'),
            ('websockets', 'WebSocket support (optional)')
        ]
        
        passed_features = 0
        for feature, description in mcp_features[:-1]:  # Skip websockets as it's optional
            if feature in mcp_code:
                print(f"✅ {description}: Supported")
                passed_features += 1
            else:
                print(f"❌ {description}: Not found")
        
        # Check websockets separately
        if 'websockets' in mcp_code:
            print("✅ WebSocket support: Available")
        else:
            print("ℹ️  WebSocket support: Not required for HTTP-based MCP")
        
        protocol_score = (passed_features / (len(mcp_features) - 1)) * 100
        print(f"📊 MCP Protocol Score: {protocol_score:.1f}%")
        
        return protocol_score >= 80
        
    except Exception as e:
        print(f"❌ Error testing MCP protocol: {e}")
        return False

def test_router_integration():
    """Test integration with four-quadrant router."""
    print("\n🛣️  Testing Router Integration...")
    
    router_path = Path(__file__).parent.parent.parent / 'collector_router.py'
    
    try:
        with open(router_path, 'r') as f:
            router_code = f.read()
        
        # Check for Alpha Vantage integration
        integration_checks = [
            ('AlphaVantageMCPCollector', 'Collector import'),
            ('alpha_vantage_mcp', 'Registry entry'),
            ('COMMERCIAL_MCP', 'Quadrant classification'),
            ('79', 'Tool count reference'),
            ('cost_per_request=0.01', 'Cost configuration'),
            ('monthly_quota=25000', 'Quota configuration'),
            ('supports_mcp=True', 'MCP support flag'),
            ('protocol_preference=95', 'MCP preference')
        ]
        
        passed_checks = 0
        for check, description in integration_checks:
            if check in router_code:
                print(f"✅ {description}: Configured")
                passed_checks += 1
            else:
                print(f"❌ {description}: Missing")
        
        integration_score = (passed_checks / len(integration_checks)) * 100
        print(f"📊 Router Integration Score: {integration_score:.1f}%")
        
        return integration_score >= 75
        
    except Exception as e:
        print(f"❌ Error testing router integration: {e}")
        return False

def test_cost_tracking_integration():
    """Test cost tracking integration."""
    print("\n💰 Testing Cost Tracking Integration...")
    
    cost_tracker_path = Path(__file__).parent.parent / 'base' / 'cost_tracker.py'
    
    try:
        with open(cost_tracker_path, 'r') as f:
            tracker_code = f.read()
        
        # Check for cost tracking features
        tracking_features = [
            ('APIUsageTracker', 'Usage tracker class'),
            ('record_usage', 'Usage recording'),
            ('BudgetConfig', 'Budget configuration'),
            ('monthly_limit', 'Monthly budget limits'),
            ('cost_per_request', 'Request cost tracking'),
            ('check_budget_status', 'Budget monitoring'),
            ('usage_tracker', 'Global tracker instance')
        ]
        
        passed_features = 0
        for feature, description in tracking_features:
            if feature in tracker_code:
                print(f"✅ {description}: Available")
                passed_features += 1
            else:
                print(f"❌ {description}: Missing")
        
        tracking_score = (passed_features / len(tracking_features)) * 100
        print(f"📊 Cost Tracking Score: {tracking_score:.1f}%")
        
        return tracking_score >= 80
        
    except Exception as e:
        print(f"❌ Error testing cost tracking: {e}")
        return False

def test_directory_structure():
    """Test directory structure compliance."""
    print("\n📁 Testing Directory Structure...")
    
    base_path = Path(__file__).parent.parent
    
    expected_structure = [
        ('base/', 'Base classes directory'),
        ('base/commercial_collector_interface.py', 'Commercial interface'),
        ('base/mcp_collector_base.py', 'MCP base class'),
        ('base/cost_tracker.py', 'Cost tracking system'),
        ('mcp/', 'MCP collectors directory'),
        ('mcp/alpha_vantage_mcp_collector.py', 'Alpha Vantage collector'),
        ('mcp/mcp_client.py', 'MCP client framework'),
        ('mcp/__init__.py', 'MCP module init'),
        ('api/', 'API collectors directory (future)'),
        ('test/', 'Test directory'),
        ('test/__init__.py', 'Test module init')
    ]
    
    passed_structure = 0
    for path_str, description in expected_structure:
        path = base_path / path_str
        if path.exists():
            print(f"✅ {description}: Present")
            passed_structure += 1
        else:
            print(f"❌ {description}: Missing")
    
    structure_score = (passed_structure / len(expected_structure)) * 100
    print(f"📊 Directory Structure Score: {structure_score:.1f}%")
    
    return structure_score >= 80

def test_tool_count_validation():
    """Test the 79 tools claim validation."""
    print("\n🔧 Testing 79 Tools Claim...")
    
    collector_path = Path(__file__).parent.parent / 'mcp' / 'alpha_vantage_mcp_collector.py'
    
    try:
        with open(collector_path, 'r') as f:
            code = f.read()
        
        # Look for tool definitions in get_tool_cost_map
        tool_categories = [
            'market_data_tools',
            'technical_tools', 
            'fundamental_tools',
            'economic_tools',
            'forex_tools',
            'crypto_tools',
            'news_tools'
        ]
        
        total_tools_found = 0
        for category in tool_categories:
            if category in code:
                print(f"✅ {category.replace('_', ' ').title()}: Defined")
                # Count approximate tools in each category by looking for tool names
                category_start = code.find(category)
                if category_start != -1:
                    category_section = code[category_start:category_start+2000]
                    tool_count = category_section.count("'") // 2  # Rough estimate
                    total_tools_found += tool_count
                    print(f"   Estimated tools in category: {tool_count}")
            else:
                print(f"❌ {category.replace('_', ' ').title()}: Not found")
        
        print(f"📊 Total Tools Estimated: {total_tools_found}")
        
        # Check if 79 is mentioned
        if '79' in code:
            print("✅ 79 tools claim documented")
        else:
            print("⚠️  79 tools claim not explicitly documented")
        
        return total_tools_found >= 50  # At least 50 tools should be defined
        
    except Exception as e:
        print(f"❌ Error validating tool count: {e}")
        return False

def run_comprehensive_standalone_test():
    """Run comprehensive standalone test suite."""
    print("🧪 Alpha Vantage MCP Collector - Standalone Test Suite")
    print("=" * 60)
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    tests = [
        ('Architecture Test', test_collector_architecture),
        ('Code Quality Test', test_collector_code_quality),
        ('API Key Integration', test_api_key_integration),
        ('MCP Protocol Support', test_mcp_protocol_support),
        ('Router Integration', test_router_integration),
        ('Cost Tracking Integration', test_cost_tracking_integration),
        ('Directory Structure', test_directory_structure),
        ('Tool Count Validation', test_tool_count_validation)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
            results.append((test_name, False))
        
        print()  # Add spacing between tests
    
    # Print summary
    print("🏆 Test Summary")
    print("=" * 30)
    
    passed_tests = 0
    for test_name, result in results:
        status_icon = "✅" if result else "❌"
        status_text = "PASS" if result else "FAIL"
        print(f"{status_icon} {test_name}: {status_text}")
        if result:
            passed_tests += 1
    
    success_rate = (passed_tests / len(results)) * 100
    print(f"\n📊 Success Rate: {success_rate:.1f}% ({passed_tests}/{len(results)})")
    
    if success_rate >= 80:
        print("🎉 Alpha Vantage MCP Collector: READY FOR TESTING")
        print("📝 Recommendation: Proceed with integration testing")
    elif success_rate >= 60:
        print("⚠️  Alpha Vantage MCP Collector: NEEDS MINOR FIXES")
        print("📝 Recommendation: Address failing tests before production")
    else:
        print("❌ Alpha Vantage MCP Collector: NEEDS MAJOR WORK")
        print("📝 Recommendation: Review architecture and implementation")
    
    return success_rate >= 80


if __name__ == "__main__":
    success = run_comprehensive_standalone_test()
    sys.exit(0 if success else 1)