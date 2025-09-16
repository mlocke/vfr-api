#!/usr/bin/env python3
"""
Test single Alpha Vantage MCP tool call
"""

import asyncio
import aiohttp
import json
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

async def test_single_tool():
    """Test single tool call."""

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '4M20CQ7QT67RJ835')
    server_url = f"https://mcp.alphavantage.co/mcp?apikey={api_key}"

    print(f"Testing single GLOBAL_QUOTE tool call...")

    try:
        request_payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "GLOBAL_QUOTE",
            "params": {
                "symbol": "AAPL"
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


if __name__ == "__main__":
    asyncio.run(test_single_tool())