#!/usr/bin/env python3
"""
Simple test of FRED collector with API key
"""

import requests
import json

def test_fred_api_key():
    """Test FRED API key directly."""
    print("🚀 Testing FRED API Key Directly")
    print("=" * 40)
    
    api_key = "e093a281de7f0d224ed51ad0842fc393"
    
    # Test basic FRED API call
    url = "https://api.stlouisfed.org/fred/category"
    params = {
        'api_key': api_key,
        'file_type': 'json',
        'category_id': 0
    }
    
    try:
        print("📡 Making direct API call to FRED...")
        response = requests.get(url, params=params, timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ FRED API Key is VALID!")
            print(f"   Response: {json.dumps(data, indent=2)[:200]}...")
            
            # Test getting unemployment rate
            print("\n📊 Testing unemployment rate retrieval...")
            
            url2 = "https://api.stlouisfed.org/fred/series/observations"
            params2 = {
                'api_key': api_key,
                'file_type': 'json',
                'series_id': 'UNRATE',
                'limit': 1,
                'sort_order': 'desc'
            }
            
            response2 = requests.get(url2, params=params2, timeout=10)
            if response2.status_code == 200:
                data2 = response2.json()
                observations = data2.get('observations', [])
                if observations:
                    latest = observations[0]
                    print(f"✅ Latest unemployment rate: {latest.get('value')}% (as of {latest.get('date')})")
                else:
                    print("❌ No unemployment data found")
            else:
                print(f"❌ Unemployment data request failed: {response2.status_code}")
        
        elif response.status_code == 400:
            print("❌ API Key is INVALID - Got 400 Bad Request")
            print(f"   Response: {response.text}")
        else:
            print(f"❌ API request failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            
    except requests.RequestException as e:
        print(f"❌ Network error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False
    
    return response.status_code == 200

if __name__ == "__main__":
    success = test_fred_api_key()
    if success:
        print("\n🎉 Your FRED API key is working perfectly!")
        print("✅ Ready to use with the enhanced FRED collector!")
    else:
        print("\n❌ There was an issue with the API key or connection.")