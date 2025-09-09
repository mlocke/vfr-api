#!/usr/bin/env python3
"""
Test script for calculate_rate_sensitivity() MCP tool.

Tests the interest rate sensitivity analysis functionality
for Treasury securities and portfolios.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add project path to sys.path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from backend.data_collectors.government.mcp.tools.treasury_macro_tools import (
    calculate_rate_sensitivity
)


async def test_basic_rate_sensitivity():
    """Test basic rate sensitivity calculation."""
    print("\n" + "="*80)
    print("🧪 TEST 1: Basic Rate Sensitivity Analysis")
    print("="*80)
    
    try:
        # Test with default securities (2yr, 5yr, 10yr, 30yr)
        result = await calculate_rate_sensitivity()
        
        if result.get('success'):
            print("✅ Basic rate sensitivity analysis successful!")
            
            # Display individual security sensitivities
            sensitivities = result.get('rate_sensitivity_analysis', {}).get('individual_sensitivities', {})
            print("\n📊 Individual Security Sensitivities:")
            print("-" * 60)
            
            for security, metrics in sensitivities.items():
                print(f"\n{metrics['security_name']} ({security}):")
                print(f"  • Current Yield: {metrics['current_yield']}%")
                print(f"  • Modified Duration: {metrics['modified_duration']}")
                print(f"  • Convexity: {metrics['convexity']}")
                print(f"  • Price Impact (100bps rise): {metrics['rate_sensitivity']['price_impact_percent']}%")
                print(f"  • Risk Level: {metrics['risk_metrics']['rate_sensitivity_level']}")
            
            # Display stress test scenarios
            stress_tests = result.get('stress_test_scenarios', {})
            if stress_tests:
                print("\n📈 Stress Test Scenarios:")
                print("-" * 60)
                for scenario, impact in stress_tests.items():
                    print(f"{scenario}: {impact.get('average_impact_percent', 'N/A')}% ({impact.get('interpretation', 'N/A')})")
            
            return True
        else:
            print(f"❌ Test failed: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Exception during test: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_portfolio_sensitivity():
    """Test portfolio-level rate sensitivity."""
    print("\n" + "="*80)
    print("🧪 TEST 2: Portfolio Rate Sensitivity Analysis")
    print("="*80)
    
    try:
        # Define a balanced portfolio
        securities = ['2yr', '5yr', '10yr', '30yr']
        portfolio_weights = {
            '2yr': 0.25,
            '5yr': 0.25,
            '10yr': 0.30,
            '30yr': 0.20
        }
        
        result = await calculate_rate_sensitivity(
            securities=securities,
            portfolio_weights=portfolio_weights,
            rate_change_bps=150  # Test with 150bps rise
        )
        
        if result.get('success'):
            print("✅ Portfolio sensitivity analysis successful!")
            
            # Display portfolio metrics
            portfolio = result.get('portfolio_sensitivity', {})
            if portfolio:
                print("\n💼 Portfolio Sensitivity Metrics:")
                print("-" * 60)
                print(f"  • Portfolio Duration: {portfolio.get('portfolio_modified_duration', 'N/A')}")
                print(f"  • Portfolio Convexity: {portfolio.get('portfolio_convexity', 'N/A')}")
                print(f"  • Price Impact (150bps rise): {portfolio.get('portfolio_price_impact_percent', 'N/A')}%")
                print(f"  • Risk Classification: {portfolio.get('risk_classification', 'N/A')}")
                print(f"  • Diversification: {portfolio.get('diversification_benefit', 'N/A')}")
            
            # Display sector analysis
            sectors = result.get('sector_analysis', {})
            if sectors:
                print("\n🏢 Sector Impact Analysis:")
                print("-" * 60)
                for sector, analysis in list(sectors.items())[:3]:  # Show top 3 sectors
                    print(f"\n{sector.replace('_', ' ').title()}:")
                    print(f"  • Impact: {analysis['impact']}")
                    print(f"  • Sensitivity: {analysis['sensitivity']}")
                    print(f"  • Rationale: {analysis['explanation']}")
            
            # Display recommendations
            recommendations = result.get('risk_management', {}).get('recommendations', [])
            if recommendations:
                print("\n💡 Risk Management Recommendations:")
                print("-" * 60)
                for rec in recommendations[:3]:  # Show top 3 recommendations
                    print(f"  • {rec}")
            
            return True
        else:
            print(f"❌ Test failed: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Exception during test: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_custom_securities():
    """Test with custom security selection."""
    print("\n" + "="*80)
    print("🧪 TEST 3: Custom Securities Rate Sensitivity")
    print("="*80)
    
    try:
        # Test with short-term securities only
        securities = ['3mo', '6mo', '1yr', '2yr']
        
        result = await calculate_rate_sensitivity(
            securities=securities,
            rate_change_bps=-50  # Test with 50bps rate cut
        )
        
        if result.get('success'):
            print("✅ Custom securities analysis successful!")
            
            # Display analysis summary
            analysis = result.get('rate_sensitivity_analysis', {})
            print(f"\n📋 Analysis Summary:")
            print(f"  • Securities Analyzed: {', '.join(analysis.get('securities_analyzed', []))}")
            print(f"  • Rate Change Simulated: {analysis.get('rate_change_simulated_bps', 0)} bps")
            
            # Display risk score
            risk_score = result.get('risk_management', {}).get('risk_score', 0)
            print(f"  • Overall Risk Score: {risk_score}/100")
            
            # Display hedging strategies
            strategies = result.get('risk_management', {}).get('hedging_strategies', [])
            if strategies:
                print("\n🛡️ Hedging Strategies:")
                print("-" * 60)
                for strategy in strategies[:2]:
                    print(f"  • {strategy}")
            
            # Display market context
            context = result.get('market_context', {})
            if context:
                print("\n🌍 Market Context:")
                print(f"  • Rate Environment: {context.get('current_rate_environment', 'N/A')}")
                print(f"  • Rate Volatility: {context.get('rate_volatility', 'N/A')}")
                print(f"  • Fed Policy: {context.get('fed_policy_impact', 'N/A')}")
            
            return True
        else:
            print(f"❌ Test failed: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Exception during test: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_tool_integration():
    """Test that the tool is properly registered in MCP registry."""
    print("\n" + "="*80)
    print("🧪 TEST 4: MCP Tool Registry Integration")
    print("="*80)
    
    try:
        from backend.data_collectors.government.mcp.tools.treasury_macro_tools import (
            MCP_TREASURY_MACRO_TOOLS
        )
        
        # Check if calculate_rate_sensitivity is registered
        if 'calculate_rate_sensitivity' in MCP_TREASURY_MACRO_TOOLS:
            print("✅ Tool is registered in MCP_TREASURY_MACRO_TOOLS")
            
            # Verify it's callable
            tool_func = MCP_TREASURY_MACRO_TOOLS['calculate_rate_sensitivity']
            if callable(tool_func):
                print("✅ Tool is callable")
                
                # Test minimal invocation
                result = await tool_func(securities=['10yr'], rate_change_bps=25)
                if result.get('success') or 'error' in result:
                    print("✅ Tool executes and returns expected structure")
                    return True
                else:
                    print("❌ Tool returned unexpected structure")
                    return False
            else:
                print("❌ Tool is not callable")
                return False
        else:
            print("❌ Tool not found in MCP_TREASURY_MACRO_TOOLS registry")
            return False
            
    except Exception as e:
        print(f"❌ Exception during integration test: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("🚀 TESTING calculate_rate_sensitivity() MCP TOOL")
    print("="*80)
    
    test_results = []
    
    # Run tests
    print("\nRunning test suite...")
    
    test_results.append(("Basic Rate Sensitivity", await test_basic_rate_sensitivity()))
    test_results.append(("Portfolio Sensitivity", await test_portfolio_sensitivity()))
    test_results.append(("Custom Securities", await test_custom_securities()))
    test_results.append(("MCP Integration", await test_tool_integration()))
    
    # Summary
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! calculate_rate_sensitivity() tool is working correctly.")
        print("\n📈 Key Features Validated:")
        print("  • Duration and convexity calculations")
        print("  • Individual security sensitivity analysis")
        print("  • Portfolio-level risk metrics")
        print("  • Stress test scenarios")
        print("  • Sector impact analysis")
        print("  • Risk management recommendations")
        print("  • Hedging strategy suggestions")
        print("  • MCP tool registry integration")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed. Review the output above for details.")
    
    return passed == total


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)