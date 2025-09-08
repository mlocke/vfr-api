#!/usr/bin/env python3
"""
Test script for SimplePolygonCollector - Week 1 validation
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from simple_polygon_collector import SimplePolygonCollector
import json

def test_polygon_collector():
    """Test the SimplePolygonCollector functionality"""
    print("🧪 Testing SimplePolygonCollector - Week 1 Validation")
    print("=" * 50)
    
    try:
        # Initialize collector
        collector = SimplePolygonCollector()
        print(f"✅ Collector initialized with API key: {collector.api_key[:8]}...")
        
        # Test market status
        print("\n📊 Testing market status...")
        market_status = collector.get_market_status()
        if "error" in market_status:
            print(f"❌ Market status error: {market_status['error']}")
        else:
            print(f"✅ Market status: {json.dumps(market_status, indent=2)}")
        
        # Test stock quote
        print("\n📈 Testing stock quote for AAPL...")
        stock_quote = collector.get_stock_quote("AAPL")
        if "error" in stock_quote:
            print(f"❌ Stock quote error: {stock_quote['error']}")
        else:
            print(f"✅ AAPL data retrieved successfully")
            if "results" in stock_quote and stock_quote["results"]:
                result = stock_quote["results"][0]
                print(f"   Close: ${result.get('c', 'N/A')}")
                print(f"   Volume: {result.get('v', 'N/A'):,}")
        
        # Test stock details
        print("\n🏢 Testing stock details for AAPL...")
        stock_details = collector.get_stock_details("AAPL")
        if "error" in stock_details:
            print(f"❌ Stock details error: {stock_details['error']}")
        else:
            print(f"✅ AAPL details retrieved")
            if "results" in stock_details:
                result = stock_details["results"]
                print(f"   Name: {result.get('name', 'N/A')}")
                print(f"   Market: {result.get('market', 'N/A')}")
        
        # Test rate limiting status
        print("\n⏱️ Testing rate limit status...")
        rate_status = collector.get_rate_limit_status()
        print(f"✅ Rate limit status:")
        print(f"   Tier: {rate_status['tier']}")
        print(f"   Limit: {rate_status['limit']}")
        print(f"   Calls in last minute: {rate_status['calls_in_last_minute']}")
        print(f"   Can make call: {rate_status['can_make_call']}")
        
        print("\n🎉 Simple collector test completed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    success = test_polygon_collector()
    exit(0 if success else 1)