#!/usr/bin/env python3
"""
Get list of available tools from Alpha Vantage MCP server
"""

import asyncio
import aiohttp
import json
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

async def get_tools():
    """Get available tools from Alpha Vantage MCP server."""

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '4M20CQ7QT67RJ835')
    server_url = f"https://mcp.alphavantage.co/mcp?apikey={api_key}"

    print(f"Getting tools from Alpha Vantage MCP server...")

    try:
        request_payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/list",
            "params": {}
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                server_url,
                json=request_payload,
                headers={'Content-Type': 'application/json'},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                result = await response.json()

                if 'result' in result and 'tools' in result['result']:
                    tools = result['result']['tools']
                    print(f"\nFound {len(tools)} tools:")
                    print("=" * 50)

                    for i, tool in enumerate(tools, 1):
                        name = tool.get('name', 'Unknown')
                        description = tool.get('description', 'No description')

                        print(f"{i:2d}. {name}")
                        print(f"    Description: {description}")

                        # Show input schema if available
                        if 'inputSchema' in tool:
                            schema = tool['inputSchema']
                            if 'properties' in schema:
                                props = list(schema['properties'].keys())
                                print(f"    Parameters: {', '.join(props)}")

                        print()

                else:
                    print("No tools found in response")
                    print(f"Full response: {json.dumps(result, indent=2)}")

    except Exception as e:
        print(f"Error getting tools: {e}")

if __name__ == "__main__":
    asyncio.run(get_tools())