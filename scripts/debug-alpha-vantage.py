#!/usr/bin/env python3
"""
Debug script to test Alpha Vantage MCP server directly
"""

import asyncio
import aiohttp
import json
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

async def debug_alpha_vantage():
    """Debug Alpha Vantage MCP server calls."""

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '4M20CQ7QT67RJ835')
    server_url = f"https://mcp.alphavantage.co/mcp?apikey={api_key}"

    print(f"Testing Alpha Vantage MCP server: {server_url}")

    # Test 1: Simple HTTP request to see what we get back
    print("\n=== Test 1: Basic HTTP GET ===")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(server_url) as response:
                print(f"Status: {response.status}")
                print(f"Headers: {dict(response.headers)}")
                text = await response.text()
                print(f"Response: {text[:500]}...")
    except Exception as e:
        print(f"HTTP GET failed: {e}")

    # Test 2: JSON-RPC POST request
    print("\n=== Test 2: JSON-RPC GLOBAL_QUOTE ===")
    try:
        request_payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "GLOBAL_QUOTE",
            "params": {
                "symbol": "AAPL",
                "apikey": api_key
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
                print(f"Headers: {dict(response.headers)}")
                result = await response.json()
                print(f"Response: {json.dumps(result, indent=2)}")

    except Exception as e:
        print(f"JSON-RPC POST failed: {e}")

    # Test 3: Alternative format - direct Alpha Vantage API call for comparison
    print("\n=== Test 3: Direct Alpha Vantage API (for comparison) ===")
    try:
        direct_url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey={api_key}"

        async with aiohttp.ClientSession() as session:
            async with session.get(direct_url) as response:
                print(f"Status: {response.status}")
                result = await response.json()
                print(f"Response: {json.dumps(result, indent=2)}")

    except Exception as e:
        print(f"Direct API call failed: {e}")

    # Test 4: Try different JSON-RPC methods
    print("\n=== Test 4: Try different methods ===")
    methods_to_try = [
        "tools/list",
        "server/info",
        "ping",
        "TIME_SERIES_DAILY",
        "get-stock-quote"  # Based on community implementation
    ]

    for method in methods_to_try:
        try:
            request_payload = {
                "jsonrpc": "2.0",
                "id": str(uuid.uuid4()),
                "method": method,
                "params": {"symbol": "AAPL", "apikey": api_key} if method not in ["ping", "server/info", "tools/list"] else {}
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    server_url,
                    json=request_payload,
                    headers={'Content-Type': 'application/json'},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    result = await response.json()

                    if 'error' not in result:
                        print(f"✅ {method}: Success")
                        print(f"   Result keys: {list(result.get('result', {}).keys()) if 'result' in result else list(result.keys())}")
                    else:
                        error = result['error']
                        print(f"❌ {method}: Error {error.get('code')}: {error.get('message')}")

        except Exception as e:
            print(f"❌ {method}: Exception: {e}")


if __name__ == "__main__":
    asyncio.run(debug_alpha_vantage())