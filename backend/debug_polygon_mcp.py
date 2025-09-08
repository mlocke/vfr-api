#!/usr/bin/env python3
"""
Debug Polygon.io MCP Server Communication
Direct JSON-RPC protocol testing to identify the exact issue
"""

import json
import subprocess
import os
import time
from datetime import datetime

def debug_mcp_communication():
    """Debug MCP server communication step by step"""
    
    # Set up environment
    env = os.environ.copy()
    env['POLYGON_API_KEY'] = 'ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr'
    env['PATH'] = f"{os.path.expanduser('~')}/.local/bin:{env.get('PATH', '')}"
    
    print("🔍 Starting detailed MCP server debugging...")
    
    # Start the MCP server
    cmd = ['uvx', '--from', 'git+https://github.com/polygon-io/mcp_polygon@v0.4.0', 'mcp_polygon']
    
    print(f"📡 Starting server: {' '.join(cmd)}")
    
    try:
        process = subprocess.Popen(
            cmd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0  # Unbuffered
        )
        
        # Give server time to start
        time.sleep(2)
        
        print("✅ Server process started")
        
        # Step 1: Send initialization
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
                    "name": "polygon-debug",
                    "version": "1.0"
                }
            }
        }
        
        message = json.dumps(init_message) + '\n'
        print(f"📤 Sending: {message.strip()}")
        process.stdin.write(message)
        process.stdin.flush()
        
        # Read initialization response
        time.sleep(1)
        init_response = process.stdout.readline()
        print(f"📥 Received: {init_response.strip()}")
        
        try:
            init_data = json.loads(init_response)
            if 'result' in init_data:
                print("✅ Initialization successful")
                server_info = init_data['result']['serverInfo']
                print(f"   Server: {server_info['name']} v{server_info['version']}")
            else:
                print(f"❌ Initialization failed: {init_data}")
                return
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse initialization response: {e}")
            print(f"   Raw response: {init_response}")
            return
        
        # Step 2: Send initialized notification
        print("\n📤 Step 2: Sending initialized notification...")
        initialized_message = {
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        }
        
        message = json.dumps(initialized_message) + '\n'
        print(f"📤 Sending: {message.strip()}")
        process.stdin.write(message)
        process.stdin.flush()
        time.sleep(0.5)
        
        # Step 3: Request tools list
        print("\n📤 Step 3: Requesting tools list...")
        tools_message = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        message = json.dumps(tools_message) + '\n'
        print(f"📤 Sending: {message.strip()}")
        process.stdin.write(message)
        process.stdin.flush()
        
        # Read tools response
        time.sleep(2)
        tools_response = process.stdout.readline()
        print(f"📥 Received: {tools_response.strip()}")
        
        try:
            tools_data = json.loads(tools_response)
            if 'result' in tools_data:
                tools = tools_data['result'].get('tools', [])
                print(f"✅ Tools list received: {len(tools)} tools")
                
                if tools:
                    print("\n🔧 Available tools:")
                    for i, tool in enumerate(tools[:5], 1):  # Show first 5
                        print(f"   {i}. {tool['name']} - {tool.get('description', 'No description')}")
                    if len(tools) > 5:
                        print(f"   ... and {len(tools) - 5} more tools")
                else:
                    print("⚠️ Tools list is empty")
            elif 'error' in tools_data:
                print(f"❌ Tools request error: {tools_data['error']}")
            else:
                print(f"❓ Unexpected response format: {tools_data}")
                
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse tools response: {e}")
            print(f"   Raw response: {tools_response}")
        
        # Step 4: Check for additional output
        print("\n📤 Step 4: Checking for additional server output...")
        time.sleep(1)
        
        # Check if there's more output
        process.stdin.close()
        remaining_stdout = process.stdout.read()
        remaining_stderr = process.stderr.read()
        
        if remaining_stdout:
            print(f"📥 Additional stdout: {remaining_stdout}")
        if remaining_stderr:
            print(f"📥 stderr: {remaining_stderr}")
        
        # Wait for process to finish
        process.wait()
        print(f"✅ Process finished with return code: {process.returncode}")
        
    except Exception as e:
        print(f"❌ Exception during debugging: {e}")
        try:
            process.terminate()
        except:
            pass
    
    print("\n🔍 MCP server debugging complete")

if __name__ == "__main__":
    debug_mcp_communication()