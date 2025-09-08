#!/usr/bin/env python3
"""
Fixed Polygon.io MCP Server Communication
Implements proper MCP protocol sequence based on diagnostic findings
"""

import json
import subprocess
import os
import time
from datetime import datetime

def fixed_mcp_communication():
    """Fixed MCP server communication with proper protocol sequence"""
    
    # Set up environment
    env = os.environ.copy()
    env['POLYGON_API_KEY'] = 'ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr'
    env['PATH'] = f"{os.path.expanduser('~')}/.local/bin:{env.get('PATH', '')}"
    
    print("🔧 Starting FIXED MCP server communication...")
    
    cmd = ['uvx', '--from', 'git+https://github.com/polygon-io/mcp_polygon@v0.4.0', 'mcp_polygon']
    
    try:
        process = subprocess.Popen(
            cmd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0
        )
        
        time.sleep(2)
        print("✅ Server process started")
        
        # Step 1: Proper initialization
        print("\n📤 Step 1: Sending initialization...")
        init_message = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "roots": {"listChanged": True}
                },
                "clientInfo": {
                    "name": "polygon-fixed",
                    "version": "1.0"
                }
            }
        }
        
        message = json.dumps(init_message) + '\n'
        process.stdin.write(message)
        process.stdin.flush()
        
        # Read initialization response
        time.sleep(1)
        init_response = process.stdout.readline()
        print(f"📥 Init response: {init_response.strip()}")
        
        init_data = json.loads(init_response)
        if 'result' not in init_data:
            print("❌ Initialization failed")
            return
        
        print("✅ Initialization successful")
        
        # Step 2: Send PROPER initialized notification
        print("\n📤 Step 2: Sending CORRECTED initialized notification...")
        initialized_message = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",  # FIXED: Proper method name
            "params": {}
        }
        
        message = json.dumps(initialized_message) + '\n'
        process.stdin.write(message)
        process.stdin.flush()
        time.sleep(1)
        
        # Step 3: NOW request tools list (after proper initialization)
        print("\n📤 Step 3: Requesting tools list (after proper initialization)...")
        tools_message = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        message = json.dumps(tools_message) + '\n'
        process.stdin.write(message)
        process.stdin.flush()
        
        # Read tools response
        time.sleep(2)
        tools_response = process.stdout.readline()
        print(f"📥 Tools response: {tools_response.strip()}")
        
        try:
            tools_data = json.loads(tools_response)
            if 'result' in tools_data:
                tools = tools_data['result'].get('tools', [])
                print(f"🎉 SUCCESS! Tools list received: {len(tools)} tools")
                
                if tools:
                    print("\n🔧 Available tools:")
                    tool_categories = {}
                    for tool in tools:
                        name = tool['name']
                        desc = tool.get('description', 'No description')
                        
                        # Categorize tools
                        if 'agg' in name or 'trade' in name or 'quote' in name:
                            category = 'Stock Data'
                        elif 'option' in name.lower():
                            category = 'Options'
                        elif 'crypto' in name.lower():
                            category = 'Crypto'
                        elif 'forex' in name.lower():
                            category = 'Forex'
                        elif 'news' in name.lower() or 'earnings' in name.lower():
                            category = 'News & Events'
                        elif 'market' in name.lower():
                            category = 'Market Info'
                        else:
                            category = 'Other'
                        
                        if category not in tool_categories:
                            tool_categories[category] = []
                        tool_categories[category].append(f"{name}: {desc}")
                    
                    print(f"\n📊 Tool Summary ({len(tools)} total):")
                    for category, tools_list in tool_categories.items():
                        print(f"   {category}: {len(tools_list)} tools")
                        for i, tool_info in enumerate(tools_list[:2], 1):  # Show first 2 in each category
                            print(f"      {i}. {tool_info}")
                        if len(tools_list) > 2:
                            print(f"      ... and {len(tools_list) - 2} more")
                    
                    # Test a tool call
                    print(f"\n🧪 Testing a tool call...")
                    test_tool = tools[0]['name']  # Use first available tool
                    
                    tool_call_message = {
                        "jsonrpc": "2.0",
                        "id": 3,
                        "method": "tools/call",
                        "params": {
                            "name": test_tool,
                            "arguments": {}
                        }
                    }
                    
                    message = json.dumps(tool_call_message) + '\n'
                    process.stdin.write(message)
                    process.stdin.flush()
                    
                    time.sleep(2)
                    call_response = process.stdout.readline()
                    print(f"📥 Tool call response: {call_response.strip()[:200]}...")  # First 200 chars
                    
                    try:
                        call_data = json.loads(call_response)
                        if 'result' in call_data:
                            print(f"✅ Tool call successful: {test_tool}")
                        else:
                            print(f"⚠️ Tool call failed: {call_data.get('error', 'Unknown error')}")
                    except:
                        print("⚠️ Tool call response parsing failed")
                
                return len(tools)
                
            elif 'error' in tools_data:
                print(f"❌ Tools request still failed: {tools_data['error']}")
                return 0
                
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse tools response: {e}")
            return 0
        
    except Exception as e:
        print(f"❌ Exception during fixed communication: {e}")
        return 0
    
    finally:
        try:
            process.terminate()
            process.wait()
        except:
            pass

if __name__ == "__main__":
    tool_count = fixed_mcp_communication()
    if tool_count > 0:
        print(f"\n🎉 SUCCESS: MCP server is working! {tool_count} tools discovered")
        exit(0)
    else:
        print(f"\n❌ FAILED: MCP server issues persist")
        exit(1)