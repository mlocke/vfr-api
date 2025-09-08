#!/usr/bin/env python3
"""
Simple Polygon MCP Test with proper initialization sequence
"""

import subprocess
import json
import os
import time

def test_polygon_mcp():
    # Set up environment
    env = os.environ.copy()
    env['POLYGON_API_KEY'] = 'ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr'
    env['PATH'] = f"{os.path.expanduser('~')}/.local/bin:{env.get('PATH', '')}"
    
    cmd = ['uvx', '--from', 'git+https://github.com/polygon-io/mcp_polygon@v0.4.0', 'mcp_polygon']
    
    # Start the process
    process = subprocess.Popen(
        cmd,
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=0
    )
    
    try:
        # Step 1: Initialize
        print("1. Initializing MCP server...")
        init_msg = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"roots": {"listChanged": True}},
                "clientInfo": {"name": "polygon-test", "version": "1.0"}
            }
        }
        
        process.stdin.write(json.dumps(init_msg) + '\n')
        process.stdin.flush()
        
        # Read initialization response
        init_response = process.stdout.readline()
        init_data = json.loads(init_response.strip())
        print(f"✅ Initialized: {init_data['result']['serverInfo']['name']} v{init_data['result']['serverInfo']['version']}")
        
        # Step 2: Send initialized notification
        print("2. Sending initialized notification...")
        initialized_msg = {
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        }
        
        process.stdin.write(json.dumps(initialized_msg) + '\n')
        process.stdin.flush()
        
        # Wait a moment for server to be ready
        time.sleep(0.5)
        
        # Step 3: List tools
        print("3. Listing available tools...")
        tools_msg = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        process.stdin.write(json.dumps(tools_msg) + '\n')
        process.stdin.flush()
        
        # Read tools response
        tools_response = process.stdout.readline()
        tools_data = json.loads(tools_response.strip())
        
        if 'result' in tools_data and 'tools' in tools_data['result']:
            tools = tools_data['result']['tools']
            print(f"✅ Found {len(tools)} tools:")
            
            # Group tools by category
            categories = {}
            for tool in tools:
                name = tool['name']
                if 'stock' in name or 'agg' in name or 'trade' in name:
                    cat = 'Stocks'
                elif 'option' in name:
                    cat = 'Options'
                elif 'crypto' in name:
                    cat = 'Crypto'
                elif 'forex' in name:
                    cat = 'Forex'
                elif 'news' in name:
                    cat = 'News'
                elif 'market' in name:
                    cat = 'Market'
                else:
                    cat = 'Other'
                
                if cat not in categories:
                    categories[cat] = []
                categories[cat].append(name)
            
            for category, tool_list in categories.items():
                print(f"   📊 {category}: {len(tool_list)} tools")
                for tool_name in tool_list[:3]:  # Show first 3
                    print(f"      - {tool_name}")
                if len(tool_list) > 3:
                    print(f"      ... and {len(tool_list) - 3} more")
            
            # Test a simple tool call
            print("\n4. Testing market status tool...")
            status_msg = {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "get_market_status",
                    "arguments": {}
                }
            }
            
            process.stdin.write(json.dumps(status_msg) + '\n')
            process.stdin.flush()
            
            status_response = process.stdout.readline()
            status_data = json.loads(status_response.strip())
            
            if 'result' in status_data:
                print("✅ Market status tool call successful")
                content = status_data['result'][0]['content'][0]['text']
                market_data = json.loads(content)
                print(f"   📈 Market: {market_data.get('market', 'unknown')}")
            else:
                print(f"❌ Tool call failed: {status_data.get('error', 'unknown')}")
            
        else:
            print(f"❌ No tools found: {tools_data}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
    finally:
        process.terminate()
        process.wait()

if __name__ == "__main__":
    print("🚀 Simple Polygon MCP Test")
    print("=" * 40)
    test_polygon_mcp()