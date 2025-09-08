#!/usr/bin/env python3
"""
Test Treasury Fiscal Data API authentication requirements

This script tests different authentication methods to determine what the 
Treasury Fiscal Data API actually requires.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta

async def test_treasury_api_auth():
    """Test Treasury API with different authentication methods."""
    print("🧪 Testing Treasury Fiscal Data API Authentication")
    print("=" * 60)
    
    # Test URLs to try
    base_urls = [
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1",
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2"
    ]
    
    endpoints = [
        "/accounting/od/avg_interest_rates",
        "/accounting/od/avg_interest_rates_treasury_securities"  # Alternative endpoint name
    ]
    
    # Different auth methods to test
    auth_methods = [
        ("No Auth", {}),
        ("X-Api-Key", {"X-Api-Key": "LyWprcwghyRCQphUQO5DkamW0Qe3I4FQhjxMdOwo"}),
        ("Api-Key", {"Api-Key": "LyWprcwghyRCQphUQO5DkamW0Qe3I4FQhjxMdOwo"}),
        ("Authorization", {"Authorization": "Bearer LyWprcwghyRCQphUQO5DkamW0Qe3I4FQhjxMdOwo"}),
    ]
    
    # Test parameters
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    
    for base_url in base_urls:
        print(f"\n🏛️ Testing base URL: {base_url}")
        
        for endpoint in endpoints:
            print(f"\n📊 Testing endpoint: {endpoint}")
            
            for auth_name, auth_headers in auth_methods:
                print(f"\n🔑 Testing {auth_name}:")
                
                try:
                    headers = {
                        'User-Agent': 'StockPicker-DataGov-MCP/1.0',
                        'Accept': 'application/json'
                    }
                    headers.update(auth_headers)
                    
                    url = f"{base_url}{endpoint}"
                    params = {
                        'filter': f'record_date:gte:{start_date},record_date:lte:{end_date}',
                        'sort': '-record_date',
                        'page[size]': 5
                    }
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url, headers=headers, params=params, timeout=10) as response:
                            print(f"  Status: {response.status}")
                            
                            if response.status == 200:
                                try:
                                    data = await response.json()
                                    if 'data' in data and len(data['data']) > 0:
                                        print(f"  ✅ SUCCESS! Got {len(data['data'])} records")
                                        print(f"  📅 Sample record date: {data['data'][0].get('record_date', 'N/A')}")
                                        print(f"  📋 Sample fields: {list(data['data'][0].keys())[:5]}...")
                                        return True, base_url, endpoint, auth_headers
                                    else:
                                        print(f"  ⚠️ Empty data response")
                                except json.JSONDecodeError:
                                    print(f"  ❌ Invalid JSON response")
                            elif response.status == 401:
                                print(f"  🔒 Unauthorized - API key may be required")
                            elif response.status == 403:
                                print(f"  🚫 Forbidden - API key may be invalid")
                            elif response.status == 404:
                                print(f"  🔍 Not Found - endpoint may not exist")
                            else:
                                print(f"  ❌ HTTP Error: {response.status}")
                                
                except asyncio.TimeoutError:
                    print(f"  ⏱️ Request timeout")
                except Exception as e:
                    print(f"  💥 Error: {e}")
    
    return False, None, None, None

async def test_alternative_endpoints():
    """Test alternative Treasury data endpoints."""
    print("\n🔄 Testing alternative Treasury endpoints...")
    print("=" * 60)
    
    # Try the datasets that we know exist from search results
    test_urls = [
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/avg_interest_rates",
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates",
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/debt_to_penny",
    ]
    
    for url in test_urls:
        print(f"\n🧪 Testing: {url}")
        
        try:
            headers = {
                'User-Agent': 'StockPicker-DataGov-MCP/1.0',
                'Accept': 'application/json'
            }
            
            params = {
                'page[size]': 1,
                'sort': '-record_date'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params, timeout=10) as response:
                    print(f"  Status: {response.status}")
                    
                    if response.status == 200:
                        try:
                            data = await response.json()
                            if 'data' in data:
                                print(f"  ✅ SUCCESS! Endpoint exists and returns data")
                                print(f"  📊 Data count: {len(data.get('data', []))}")
                                if data.get('data'):
                                    sample = data['data'][0]
                                    print(f"  📋 Sample fields: {list(sample.keys())}")
                            else:
                                print(f"  ⚠️ Response structure: {list(data.keys())}")
                        except json.JSONDecodeError:
                            text = await response.text()
                            print(f"  ❌ Non-JSON response: {text[:100]}...")
                    else:
                        print(f"  ❌ HTTP {response.status}")
                        
        except Exception as e:
            print(f"  💥 Error: {e}")

async def main():
    """Main test function."""
    print("🏛️ TREASURY FISCAL DATA API AUTHENTICATION TEST")
    print("=" * 60)
    print("Testing to determine correct authentication method for Treasury API\n")
    
    # Test main authentication methods
    success, working_url, working_endpoint, working_auth = await test_treasury_api_auth()
    
    if success:
        print(f"\n🎉 FOUND WORKING CONFIGURATION!")
        print(f"URL: {working_url}")
        print(f"Endpoint: {working_endpoint}")
        print(f"Auth: {working_auth}")
    else:
        print(f"\n❌ No working configuration found with provided auth methods")
        
        # Try alternative endpoints
        await test_alternative_endpoints()
    
    print(f"\n📋 SUMMARY:")
    print(f"The Treasury Fiscal Data API authentication requirements are now clear.")
    print(f"Use the working configuration above to fix the yield curve analysis tool.")

if __name__ == "__main__":
    asyncio.run(main())