#!/usr/bin/env python3
"""
Test Polygon.io MCP Server Tool Discovery
Tests the connection and discovers available tools from Polygon MCP server
"""

import json
import subprocess
import os
import sys
from datetime import datetime

def test_polygon_mcp_tools():
    """Test Polygon MCP server and discover available tools"""
    
    # Set up environment
    env = os.environ.copy()
    env['POLYGON_API_KEY'] = 'ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr'
    env['PATH'] = f"{os.path.expanduser('~')}/.local/bin:{env.get('PATH', '')}"
    
    results = {
        'timestamp': datetime.now().isoformat(),
        'server_info': None,
        'tools': [],
        'tool_count': 0,
        'test_status': 'unknown'
    }
    
    try:
        # Test 1: Server initialization
        print("🔍 Testing Polygon MCP server initialization...")
        
        init_message = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"roots": {"listChanged": True}},
                "clientInfo": {"name": "polygon-test", "version": "1.0"}
            }
        }
        
        # Start MCP server and send initialization
        cmd = ['uvx', '--from', 'git+https://github.com/polygon-io/mcp_polygon@v0.4.0', 'mcp_polygon']
        
        process = subprocess.Popen(
            cmd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Send initialization
        init_response, stderr = process.communicate(json.dumps(init_message) + '\n')
        
        if process.returncode != 0:
            print(f"❌ Server initialization failed: {stderr}")
            results['test_status'] = 'failed'
            return results
        
        # Parse initialization response
        try:
            init_data = json.loads(init_response.strip())
            results['server_info'] = init_data.get('result', {})
            print(f"✅ Server initialized: {init_data['result']['serverInfo']['name']} v{init_data['result']['serverInfo']['version']}")
        except json.JSONDecodeError:
            print(f"❌ Failed to parse initialization response: {init_response}")
            results['test_status'] = 'failed'
            return results
        
        # Test 2: Tool discovery
        print("🔧 Discovering available tools...")
        
        tools_message = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        # Create new process for tools list
        process = subprocess.Popen(
            cmd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Send both initialization and tools list
        input_data = json.dumps(init_message) + '\n' + json.dumps(tools_message) + '\n'
        tools_response, stderr = process.communicate(input_data)
        
        if process.returncode != 0:
            print(f"❌ Tools discovery failed: {stderr}")
            results['test_status'] = 'failed'
            return results
        
        # Parse tools response (should be second line)
        response_lines = tools_response.strip().split('\n')
        if len(response_lines) >= 2:
            try:
                tools_data = json.loads(response_lines[1])
                if 'result' in tools_data and 'tools' in tools_data['result']:
                    results['tools'] = tools_data['result']['tools']
                    results['tool_count'] = len(results['tools'])
                    print(f"✅ Discovered {results['tool_count']} tools")
                    
                    # Display tool categories
                    tool_categories = {}
                    for tool in results['tools']:
                        # Categorize tools by name pattern
                        name = tool['name']
                        if name.startswith('get_aggs') or name.startswith('get_trades') or name.startswith('get_last_trade'):
                            category = 'Stock Data'
                        elif 'option' in name.lower():
                            category = 'Options'
                        elif 'crypto' in name.lower():
                            category = 'Crypto'
                        elif 'forex' in name.lower():
                            category = 'Forex'
                        elif 'news' in name.lower() or 'earnings' in name.lower():
                            category = 'News & Fundamentals'
                        elif 'market' in name.lower():
                            category = 'Market Status'
                        else:
                            category = 'Other'
                        
                        if category not in tool_categories:
                            tool_categories[category] = []
                        tool_categories[category].append(name)
                    
                    print("\n📊 Tool Categories:")
                    for category, tools in tool_categories.items():
                        print(f"   {category}: {len(tools)} tools")
                        for tool in tools[:3]:  # Show first 3 tools in each category
                            print(f"      - {tool}")
                        if len(tools) > 3:
                            print(f"      ... and {len(tools) - 3} more")
                    
                else:
                    print("❌ No tools found in response")
                    results['test_status'] = 'failed'
                    return results
                    
            except json.JSONDecodeError:
                print(f"❌ Failed to parse tools response: {response_lines[1] if len(response_lines) > 1 else 'No response'}")
                results['test_status'] = 'failed'
                return results
        else:
            print(f"❌ Insufficient response lines: {len(response_lines)}")
            results['test_status'] = 'failed'
            return results
        
        # Test 3: Test a sample tool call
        print("\n🧪 Testing sample tool call (get_market_status)...")
        
        test_tool_message = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "get_market_status",
                "arguments": {}
            }
        }
        
        # Create new process for tool call test
        process = subprocess.Popen(
            cmd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Send initialization, then tool call
        input_data = json.dumps(init_message) + '\n' + json.dumps(test_tool_message) + '\n'
        tool_response, stderr = process.communicate(input_data)
        
        response_lines = tool_response.strip().split('\n')
        if len(response_lines) >= 2:
            try:
                tool_data = json.loads(response_lines[1])
                if 'result' in tool_data:
                    print("✅ Sample tool call successful")
                    # Parse the market status response
                    content = tool_data['result'][0]['content'][0]['text']
                    market_data = json.loads(content)
                    market_status = market_data.get('market', 'unknown')
                    print(f"   📈 Market Status: {market_status}")
                else:
                    print(f"⚠️ Tool call returned error: {tool_data.get('error', 'unknown')}")
            except (json.JSONDecodeError, KeyError, IndexError) as e:
                print(f"⚠️ Tool call response parsing failed: {e}")
        
        results['test_status'] = 'success'
        print(f"\n🎉 Polygon MCP server test completed successfully!")
        print(f"📊 Summary: {results['tool_count']} tools discovered")
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        results['test_status'] = 'failed'
    
    return results

def main():
    print("🚀 Polygon.io MCP Server Tool Discovery Test")
    print("=" * 50)
    
    results = test_polygon_mcp_tools()
    
    # Save results to file
    output_file = f"polygon_mcp_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n💾 Results saved to: {output_file}")
    
    return 0 if results['test_status'] == 'success' else 1

if __name__ == "__main__":
    sys.exit(main())