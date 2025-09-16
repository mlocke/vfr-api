#!/usr/bin/env python3
"""
Test Alpha Vantage MCP tool calls using tools/call method
"""

import asyncio
import aiohttp
import json
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

async def test_tools_call():
    """Test tools/call method."""

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '4M20CQ7QT67RJ835')
    server_url = f"https://mcp.alphavantage.co/mcp?apikey={api_key}"

    print(f"Testing tools/call method with GLOBAL_QUOTE...")

    try:
        request_payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/call",
            "params": {
                "name": "GLOBAL_QUOTE",
                "arguments": {
                    "symbol": "AAPL"
                }
            }
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                server_url,
                json=request_payload,
                headers={'Content-Type': 'application/json'},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                print(f"Status: {response.status}")
                result = await response.json()

                if 'error' in result:
                    error = result['error']
                    print(f"❌ Error {error.get('code')}: {error.get('message')}")
                else:
                    print("✅ Success!")
                    print(f"Result: {json.dumps(result, indent=2)}")

    except Exception as e:
        print(f"Exception: {e}")


async def test_ping():
    """Test PING tool."""

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '4M20CQ7QT67RJ835')
    server_url = f"https://mcp.alphavantage.co/mcp?apikey={api_key}"

    print(f"\nTesting PING tool directly...")

    try:
        request_payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "PING",
            "params": {}
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                server_url,
                json=request_payload,
                headers={'Content-Type': 'application/json'},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                print(f"Status: {response.status}")
                result = await response.json()

                if 'error' in result:
                    error = result['error']
                    print(f"❌ Error {error.get('code')}: {error.get('message')}")
                else:
                    print("✅ PING Success!")
                    print(f"Result: {json.dumps(result, indent=2)}")

    except Exception as e:
        print(f"Exception: {e}")


if __name__ == "__main__":
    asyncio.run(test_tools_call())
    asyncio.run(test_ping())