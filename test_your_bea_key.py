#!/usr/bin/env python3

"""
Test BEA API with Your Personal Key

This script tests the BEA API connection with your personal API key.
Please replace YOUR_ACTUAL_API_KEY_HERE with the key you received from BEA.
"""

import requests
import json

def test_bea_api_key(api_key):
    """Test BEA API with the provided key."""
    
    print("🚀 Testing BEA API with Your Personal Key")
    print("=" * 60)
    print(f"Using API Key: {api_key[:8]}...{api_key[-8:] if len(api_key) > 16 else api_key}")
    
    # BEA API endpoint
    base_url = "https://apps.bea.gov/api/data/"
    
    # Test 1: Get Dataset List (basic authentication test)
    print("\n🔄 Test 1: GetDataSetList (Authentication Test)")
    params = {
        'UserID': api_key,
        'method': 'GetDataSetList', 
        'ResultFormat': 'JSON'
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for API errors
            if 'BEAAPI' in data and 'Results' in data['BEAAPI']:
                results = data['BEAAPI']['Results']
                
                if 'Error' in results:
                    error = results['Error']
                    print(f"❌ API Error: {error.get('@APIErrorDescription', 'Unknown error')}")
                    print(f"Error Code: {error.get('@APIErrorCode', 'Unknown')}")
                    return False
                
                elif 'Dataset' in results:
                    datasets = results['Dataset']
                    print(f"✅ Authentication successful!")
                    print(f"✅ Found {len(datasets)} available datasets:")
                    
                    for dataset in datasets[:5]:  # Show first 5
                        name = dataset.get('@DatasetName', 'Unknown')
                        desc = dataset.get('@DatasetDescription', 'No description')
                        print(f"   • {name}: {desc}")
                    
                    if len(datasets) > 5:
                        print(f"   ... and {len(datasets) - 5} more datasets")
                    
                    return True
                else:
                    print(f"❌ Unexpected response format: {data}")
                    return False
            else:
                print(f"❌ Invalid response format: {data}")
                return False
        else:
            print(f"❌ HTTP Error {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

def test_gdp_data_request(api_key):
    """Test actual GDP data request."""
    
    print("\n🔄 Test 2: Get GDP Data (Real Data Test)")
    base_url = "https://apps.bea.gov/api/data/"
    
    params = {
        'UserID': api_key,
        'method': 'GetData',
        'datasetname': 'NIPA',
        'TableName': 'T10101',  # GDP Summary table
        'Frequency': 'Q',       # Quarterly
        'Year': '2024',
        'ResultFormat': 'JSON'
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=15)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'BEAAPI' in data and 'Results' in data['BEAAPI']:
                results = data['BEAAPI']['Results']
                
                if 'Error' in results:
                    error = results['Error']
                    print(f"❌ API Error: {error.get('@APIErrorDescription', 'Unknown error')}")
                    return False
                
                elif 'Data' in results:
                    gdp_data = results['Data']
                    print(f"✅ GDP data retrieved successfully!")
                    print(f"✅ Found {len(gdp_data)} data points")
                    
                    # Show sample data
                    print("\n📊 Sample GDP Data:")
                    for record in gdp_data[:3]:  # Show first 3 records
                        period = record.get('TimePeriod', 'N/A')
                        value = record.get('DataValue', 'N/A')
                        desc = record.get('LineDescription', 'N/A')
                        print(f"   • {period}: {desc} = ${value}")
                    
                    return True
                else:
                    print(f"❌ No data in response: {results.keys()}")
                    return False
            else:
                print(f"❌ Invalid response format")
                return False
        else:
            print(f"❌ HTTP Error {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

def main():
    """Main test function."""
    
    # IMPORTANT: Replace this with your actual API key from the BEA registration email
    # The key should be a 36-character string like: "12345678-1234-1234-1234-123456789abc"
    
    # Default key from implementation (might not be your personal key)
    default_key = "e168db38c47449c8a41e031171deeb19"
    
    print("🎯 BEA API Key Testing")
    print("=" * 60)
    print("❗ IMPORTANT: Make sure you're using YOUR personal API key from the BEA email")
    print("❗ The default key in the code might not be your activated key")
    print("=" * 60)
    
    # Test with default key first
    print(f"\n🔄 Testing with default key from code...")
    auth_success = test_bea_api_key(default_key)
    
    if auth_success:
        print(f"\n✅ Default key works! Testing GDP data...")
        data_success = test_gdp_data_request(default_key)
        
        if data_success:
            print(f"\n🎉 SUCCESS! BEA API is fully functional with default key")
            print(f"🎯 The BEA collector should now work perfectly")
        else:
            print(f"\n⚠️ Authentication works but data request failed")
    else:
        print(f"\n❌ Default key authentication failed")
        print(f"\n📝 NEXT STEPS:")
        print(f"1. Check your BEA registration email for your personal API key")
        print(f"2. The key should be 36 characters long (like a UUID)")
        print(f"3. Replace 'YOUR_ACTUAL_API_KEY_HERE' in this script with your key")
        print(f"4. Run this script again: python3 test_your_bea_key.py")
        
        # Instructions for manual testing
        print(f"\n🔧 MANUAL TEST INSTRUCTIONS:")
        print(f"Replace the default key with YOUR key and test:")
        print(f"")
        print(f"# Option 1: Edit this file and replace default_key value")
        print(f"# Option 2: Test directly in terminal:")
        print(f"python3 -c \"")
        print(f"import requests")
        print(f"response = requests.get('https://apps.bea.gov/api/data/', params={{")
        print(f"    'UserID': 'YOUR_API_KEY_HERE',")
        print(f"    'method': 'GetDataSetList',")
        print(f"    'ResultFormat': 'JSON'")
        print(f"}})") 
        print(f"print(response.json())")
        print(f"\"")

if __name__ == "__main__":
    main()