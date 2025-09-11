#!/usr/bin/env python3
"""
Quick FRED Data Test - Show Real Economic Data
"""

import os
import requests
import json
from datetime import datetime

# Import centralized configuration
try:
    from backend.config.env_loader import Config
    FRED_API_KEY = Config.get_api_key('fred') or "your_api_key_here"
except ImportError:
    FRED_API_KEY = os.getenv("FRED_API_KEY", "your_api_key_here")

def test_fred_api():
    """Test FRED API and show real economic data"""
    
    print("🏛️  FRED Economic Data Test")
    print("=" * 50)
    
    if FRED_API_KEY == "your_api_key_here":
        print("❌ No FRED API key found!")
        print("Get a free key at: https://fred.stlouisfed.org/docs/api/api_key.html")
        print("Then set: export FRED_API_KEY='your_key'")
        return
    
    base_url = "https://api.stlouisfed.org/fred"
    
    # Test popular economic indicators
    indicators = {
        "UNRATE": "Unemployment Rate",
        "FEDFUNDS": "Federal Funds Rate", 
        "GDP": "Gross Domestic Product",
        "CPIAUCSL": "Consumer Price Index",
        "DGS10": "10-Year Treasury Rate"
    }
    
    print(f"\n📊 Latest Economic Indicators:")
    print("-" * 50)
    
    for series_id, description in indicators.items():
        try:
            url = f"{base_url}/series/observations"
            params = {
                'series_id': series_id,
                'api_key': FRED_API_KEY,
                'file_type': 'json',
                'limit': 1,
                'sort_order': 'desc'
            }
            
            response = requests.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                observations = data.get('observations', [])
                
                if observations:
                    latest = observations[0]
                    value = latest.get('value', 'N/A')
                    date = latest.get('date', 'N/A')
                    
                    print(f"✅ {series_id}: {value} ({date})")
                    print(f"   📝 {description}")
                else:
                    print(f"❌ {series_id}: No data available")
                    
            elif response.status_code == 400:
                # Check if it's an API key issue
                error_data = response.json()
                if 'api_key' in str(error_data):
                    print(f"❌ {series_id}: Invalid API key")
                else:
                    print(f"❌ {series_id}: API error - {error_data}")
            else:
                print(f"❌ {series_id}: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ {series_id}: Error - {e}")
    
    # Test series search
    print(f"\n🔍 Search Test: 'unemployment'")
    print("-" * 30)
    
    try:
        url = f"{base_url}/series/search"
        params = {
            'search_text': 'unemployment',
            'api_key': FRED_API_KEY,
            'file_type': 'json',
            'limit': 3
        }
        
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            series_list = data.get('seriess', [])  # Note: FRED uses 'seriess' 
            
            if series_list:
                print(f"Found {len(series_list)} unemployment-related series:")
                for series in series_list:
                    series_id = series.get('id', 'N/A')
                    title = series.get('title', 'N/A')
                    print(f"  • {series_id}: {title[:60]}...")
            else:
                print("No series found")
        else:
            print(f"Search failed: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"Search error: {e}")
    
    print(f"\n✨ FRED Database Contains 800,000+ Economic Time Series!")
    print("This is just a tiny sample of what's available.")

if __name__ == "__main__":
    test_fred_data()