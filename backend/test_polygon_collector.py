#!/usr/bin/env python3
"""
Test Polygon.io MCP Collector Implementation
"""

import asyncio
import sys
import os
from datetime import datetime

# Add path for imports
sys.path.append('.')

async def test_polygon_collector():
    """Test the Polygon MCP collector"""
    
    print("🚀 Testing Polygon.io MCP Collector")
    print("=" * 50)
    
    try:
        # Import the collector
        from data_collectors.commercial.mcp.polygon_mcp_collector import PolygonMCPCollector
        
        print("✅ Collector imported successfully")
        
        # Initialize collector
        print("🔧 Initializing collector...")
        collector = PolygonMCPCollector(api_key="ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr")
        
        print(f"✅ Collector initialized with {collector.subscription_tier.value} tier")
        print(f"📊 Rate limiter: {collector.rate_limiter.limits[collector.subscription_tier]} calls/minute")
        
        # Test 1: Market Status (using fallback API)
        print("\n🧪 Test 1: Market Status")
        market_status = await collector.get_market_status()
        
        if 'error' not in market_status:
            print(f"✅ Market Status: {market_status.get('market', 'unknown')}")
        else:
            print(f"⚠️ Market Status Error: {market_status['error']}")
        
        # Test 2: Stock Quote (using fallback API) 
        print("\n🧪 Test 2: Stock Quote (AAPL)")
        stock_quote = await collector.get_stock_quote("AAPL")
        
        if 'error' not in stock_quote:
            print("✅ Stock Quote retrieved successfully")
            if 'results' in stock_quote:
                results = stock_quote['results'][0] if stock_quote['results'] else {}
                print(f"   💰 Price: ${results.get('c', 'N/A')}")
                print(f"   📈 Volume: {results.get('v', 'N/A'):,}")
        else:
            print(f"⚠️ Stock Quote Error: {stock_quote['error']}")
        
        # Test 3: Rate Limiting Check
        print(f"\n🧪 Test 3: Rate Limiting")
        print(f"   Can make call: {collector.rate_limiter.can_make_call()}")
        print(f"   Calls made: {len(collector.rate_limiter.calls_made)}")
        print(f"   Wait time: {collector.rate_limiter.time_until_next_call():.1f}s")
        
        # Test 4: Available Tools Discovery (might fail, but that's OK)
        print(f"\n🧪 Test 4: Tool Discovery")
        try:
            tools = await collector.get_available_tools()
            print(f"✅ Discovered {len(tools)} tools")
            
            # Group tools by category
            categories = {}
            for tool in tools:
                name = tool.get('name', 'unknown')
                if 'stock' in name or 'agg' in name:
                    cat = 'Stock Data'
                elif 'option' in name:
                    cat = 'Options'
                elif 'market' in name:
                    cat = 'Market'
                else:
                    cat = 'Other'
                
                if cat not in categories:
                    categories[cat] = 0
                categories[cat] += 1
            
            for category, count in categories.items():
                print(f"   📊 {category}: {count} tools")
                
        except Exception as e:
            print(f"⚠️ Tool discovery failed (expected): {e}")
        
        # Cleanup
        collector.cleanup()
        print(f"\n✅ All tests completed!")
        
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        print("   Make sure you're running from the correct directory")
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

async def main():
    await test_polygon_collector()

if __name__ == "__main__":
    asyncio.run(main())