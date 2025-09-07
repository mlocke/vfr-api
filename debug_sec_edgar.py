#!/usr/bin/env python3
"""
Debug SEC EDGAR API Response
Investigate the actual structure of SEC EDGAR API responses.
"""

import json
import requests
from pathlib import Path

# SEC API configuration
BASE_URL = "https://data.sec.gov"
HEADERS = {
    'User-Agent': 'Stock-Picker Financial Analysis Platform contact@stockpicker.com',
    'Accept': 'application/json',
    'Host': 'data.sec.gov'
}

def debug_company_facts():
    """Debug the actual structure of company facts API response."""
    print("🔄 Debugging SEC Company Facts API response structure...")
    
    # Test with Apple Inc.
    cik = '320193'
    url = f"{BASE_URL}/api/xbrl/companyfacts/CIK{cik.zfill(10)}.json"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        if response.status_code == 200:
            data = response.json()
            
            print(f"✅ Successfully retrieved data for {data.get('entityName', 'Unknown')}")
            print(f"📊 Main keys: {list(data.keys())}")
            
            if 'facts' in data:
                facts = data['facts']
                print(f"📈 Facts keys: {list(facts.keys())}")
                
                if 'us-gaap' in facts:
                    us_gaap = facts['us-gaap']
                    print(f"🏦 US-GAAP concepts count: {len(us_gaap)}")
                    
                    # Look for revenue specifically
                    revenue_concepts = [key for key in us_gaap.keys() if 'revenue' in key.lower() or 'sales' in key.lower()]
                    print(f"💰 Revenue-related concepts: {revenue_concepts[:5]}")
                    
                    # Check a specific concept structure
                    if 'us-gaap:Revenues' in us_gaap:
                        revenue_data = us_gaap['us-gaap:Revenues']
                        print(f"📊 Revenue concept structure: {list(revenue_data.keys())}")
                        
                        if 'units' in revenue_data:
                            print(f"💵 Revenue units available: {list(revenue_data['units'].keys())}")
                            
                            # Check USD unit structure
                            if 'USD' in revenue_data['units']:
                                usd_data = revenue_data['units']['USD']
                                print(f"💰 USD entries count: {len(usd_data)}")
                                
                                # Show first few entries
                                for i, entry in enumerate(usd_data[:3]):
                                    print(f"  Entry {i+1}: {entry}")
                    
                    # Look for assets 
                    if 'us-gaap:Assets' in us_gaap:
                        assets_data = us_gaap['us-gaap:Assets']
                        print(f"🏦 Assets concept structure: {list(assets_data.keys())}")
                        
                        if 'units' in assets_data and 'USD' in assets_data['units']:
                            usd_data = assets_data['units']['USD']
                            print(f"🏦 Assets USD entries count: {len(usd_data)}")
                            
                            # Show most recent entries
                            recent_entries = sorted(usd_data, key=lambda x: x.get('end', ''), reverse=True)[:3]
                            for i, entry in enumerate(recent_entries):
                                print(f"  Recent Asset Entry {i+1}:")
                                print(f"    Value: ${entry.get('val', 0):,}")
                                print(f"    Date: {entry.get('end')}")
                                print(f"    Form: {entry.get('form')}")
                                print(f"    Filed: {entry.get('filed')}")
            
            # Save raw data for inspection
            debug_dir = Path("docs/project/test_output/SEC_EDGAR")
            debug_dir.mkdir(parents=True, exist_ok=True)
            
            with open(debug_dir / "raw_apple_data_debug.json", 'w') as f:
                json.dump(data, f, indent=2, default=str)
            
            print(f"📄 Raw data saved to: {debug_dir / 'raw_apple_data_debug.json'}")
            
        else:
            print(f"❌ API request failed with status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Debug failed: {e}")

if __name__ == "__main__":
    debug_company_facts()