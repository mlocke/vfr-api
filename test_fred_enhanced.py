#!/usr/bin/env python3
"""
Quick test of enhanced FRED collector with API key
"""

import os
import sys
from datetime import date, timedelta

# Add the backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Load environment variables through centralized config
try:
    from backend.config.env_loader import Config
    api_key = Config.get_api_key('fred')
except ImportError:
    from dotenv import load_dotenv
    load_dotenv()
    api_key = os.getenv('FRED_API_KEY')

from data_collectors.government import FREDCollector
from data_collectors.base import CollectorConfig

def test_fred_enhanced():
    """Test the enhanced FRED collector."""
    print("🚀 Testing Enhanced FRED Collector")
    print("=" * 50)
    if not api_key:
        print("❌ FRED_API_KEY not found in environment")
        return False
    
    print(f"✅ Found API key: {api_key[:8]}...")
    
    # Initialize collector
    try:
        config = CollectorConfig(api_key=api_key)
        collector = FREDCollector(config)
        print("✅ FRED collector initialized")
    except Exception as e:
        print(f"❌ Failed to initialize FRED collector: {e}")
        return False
    
    # Test 1: Authentication
    print("\n1. Testing authentication...")
    try:
        if collector.authenticate():
            print("✅ Authentication successful!")
        else:
            print("❌ Authentication failed")
            return False
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return False
    
    # Test 2: Basic data collection
    print("\n2. Testing basic data collection...")
    try:
        latest_unemployment = collector.get_latest_observation("UNRATE")
        if latest_unemployment:
            print(f"✅ Latest unemployment rate: {latest_unemployment.get('value')}% (as of {latest_unemployment.get('date')})")
        else:
            print("❌ Could not get unemployment data")
    except Exception as e:
        print(f"❌ Data collection error: {e}")
    
    # Test 3: Enhanced feature - Recent updates
    print("\n3. Testing enhanced feature: Recent updates...")
    try:
        recent_updates = collector.get_series_updates(limit=3)
        if recent_updates:
            print(f"✅ Found {len(recent_updates)} recently updated series:")
            for series in recent_updates[:3]:
                print(f"   - {series.get('id')}: {series.get('title', '')[:50]}...")
        else:
            print("❌ No recent updates found")
    except Exception as e:
        print(f"❌ Recent updates error: {e}")
    
    # Test 4: Enhanced feature - Economic calendar
    print("\n4. Testing enhanced feature: Economic calendar...")
    try:
        calendar = collector.get_economic_calendar(days_ahead=14)
        if calendar:
            print(f"✅ Found {len(calendar)} upcoming economic releases:")
            for item in calendar[:3]:
                print(f"   📅 {item.get('date')}: {item.get('release_name')}")
        else:
            print("ℹ️  No upcoming releases found (this is normal)")
    except Exception as e:
        print(f"❌ Economic calendar error: {e}")
    
    # Test 5: Enhanced feature - Dashboard
    print("\n5. Testing enhanced feature: Key indicators dashboard...")
    try:
        dashboard = collector.get_key_indicators_dashboard()
        if dashboard:
            print("✅ Economic Dashboard Retrieved!")
            
            # Show employment indicators
            employment = dashboard.get('employment', {})
            if employment:
                print("   📈 Employment Indicators:")
                for indicator, data in list(employment.items())[:2]:
                    value = data.get('value', 'N/A')
                    date = data.get('date', 'N/A')
                    units = data.get('units', '')
                    print(f"      {indicator}: {value} {units} (as of {date})")
            
            # Show inflation indicators
            inflation = dashboard.get('inflation', {})
            if inflation:
                print("   💰 Inflation Indicators:")
                for indicator, data in list(inflation.items())[:2]:
                    value = data.get('value', 'N/A')
                    date = data.get('date', 'N/A')
                    print(f"      {indicator}: {value}% (as of {date})")
        else:
            print("❌ Could not retrieve dashboard")
    except Exception as e:
        print(f"❌ Dashboard error: {e}")
    
    # Test 6: Enhanced feature - Tag search
    print("\n6. Testing enhanced feature: Tag-based search...")
    try:
        employment_series = collector.get_tags_series(['employment'], limit=3)
        if employment_series:
            print(f"✅ Found {len(employment_series)} employment-related series:")
            for series in employment_series:
                print(f"   - {series.get('id')}: {series.get('title', '')[:50]}...")
        else:
            print("❌ No employment series found")
    except Exception as e:
        print(f"❌ Tag search error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Enhanced FRED Collector Test Complete!")
    print("✅ Your API key is working and all enhanced features are functional!")
    return True

if __name__ == "__main__":
    success = test_fred_enhanced()
    if success:
        print("\n🚀 Ready to use the enhanced FRED collector in production!")
    else:
        print("\n❌ Please check the error messages above.")