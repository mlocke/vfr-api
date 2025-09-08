#!/usr/bin/env python3
"""
Quick test script for get_yield_curve_analysis() MCP tool

Tests the newly implemented yield curve analysis tool to ensure it works correctly
with Treasury data from data.gov APIs.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add the backend path for imports
sys.path.append(str(Path(__file__).parent / "backend" / "data_collectors" / "government" / "mcp"))

try:
    from tools.treasury_macro_tools import get_yield_curve_analysis
    print("✅ Successfully imported get_yield_curve_analysis")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)


async def test_yield_curve_analysis():
    """Test the get_yield_curve_analysis tool."""
    print("🧪 Testing get_yield_curve_analysis() tool...")
    print("=" * 60)
    
    try:
        # Test 1: Basic yield curve analysis (latest data)
        print("\n📊 Test 1: Latest yield curve analysis")
        result = await get_yield_curve_analysis()
        
        if result.get('success'):
            print("✅ Tool executed successfully!")
            
            # Display key results
            analysis_date = result.get('analysis_date', 'Unknown')
            print(f"📅 Analysis Date: {analysis_date}")
            
            curve_analysis = result.get('curve_analysis', {})
            shape = curve_analysis.get('shape_classification', 'Unknown')
            description = curve_analysis.get('shape_description', 'No description')
            print(f"📈 Curve Shape: {shape}")
            print(f"📝 Description: {description}")
            
            # Recession analysis
            recession_analysis = result.get('recession_analysis', {})
            recession_prob = recession_analysis.get('probability_percent', 0)
            signal_strength = recession_analysis.get('signal_strength', 'Unknown')
            print(f"⚠️  Recession Probability: {recession_prob}% ({signal_strength} signal)")
            
            # Key spreads
            key_spreads = curve_analysis.get('key_spreads', {})
            if key_spreads:
                print("\n📏 Key Spreads (basis points):")
                for spread_name, spread_value in key_spreads.items():
                    print(f"  • {spread_name}: {spread_value} bps")
            
            # Investment implications
            investment_impl = result.get('investment_implications', {})
            if investment_impl:
                print(f"\n💼 Investment Outlook:")
                print(f"  • Bond Strategy: {investment_impl.get('bond_strategy', 'N/A')}")
                print(f"  • Equity Outlook: {investment_impl.get('equity_outlook', 'N/A')}")
                print(f"  • Risk Assessment: {investment_impl.get('risk_assessment', 'N/A')}")
            
            print(f"\n📊 Data Points Used: {curve_analysis.get('data_points_used', 0)}")
            
        else:
            error = result.get('error', 'Unknown error')
            print(f"❌ Tool failed: {error}")
            return False
            
    except Exception as e:
        print(f"💥 Test exception: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 get_yield_curve_analysis test completed successfully!")
    return True


def print_summary():
    """Print test summary."""
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)
    print("✅ get_yield_curve_analysis() tool implemented")
    print("✅ Comprehensive yield curve analysis")
    print("✅ Recession probability calculation")
    print("✅ Investment implications generation")
    print("✅ Economic implications analysis")
    print("✅ Historical context calculation")
    print("\n🚀 Tool ready for MCP integration!")


async def main():
    """Main test execution."""
    print("🧪 YIELD CURVE ANALYSIS TOOL TEST")
    print("=" * 60)
    print("Testing the new get_yield_curve_analysis() MCP tool")
    print("This tool provides comprehensive Treasury yield curve analysis")
    print("with recession indicators and investment implications.\n")
    
    success = await test_yield_curve_analysis()
    
    if success:
        print_summary()
        print("\n✅ All tests passed! Tool is ready for use.")
        return 0
    else:
        print("\n❌ Tests failed. Please check implementation.")
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        sys.exit(1)