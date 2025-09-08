#!/usr/bin/env python3
"""
Comprehensive Collector Test Suite
Tests all government API collectors, MCP collectors, and routing system
"""

import json
import sys
import os
from datetime import datetime
from typing import Dict, Any, List

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_government_collectors() -> Dict[str, Any]:
    """Test all government API collectors"""
    results = {}
    
    # Test each government collector
    collectors = [
        'sec_edgar', 'fred', 'treasury_direct', 'treasury_fiscal',
        'bea', 'bls', 'eia', 'fdic'
    ]
    
    for collector_name in collectors:
        try:
            if collector_name == 'sec_edgar':
                from government.sec_edgar_collector import SECEdgarCollector
                collector = SECEdgarCollector()
                # Test with a simple company search
                data = collector.get_company_info("AAPL")
                results[collector_name] = {
                    "status": "✅ WORKING" if data else "❌ FAILED",
                    "sample_data": str(data)[:200] if data else None
                }
            elif collector_name == 'fred':
                from government.fred_collector import FREDCollector
                collector = FREDCollector()
                # Test with GDP series
                data = collector.get_series_observations("GDP", limit=1)
                results[collector_name] = {
                    "status": "✅ WORKING" if data else "❌ FAILED",
                    "sample_data": str(data)[:200] if data else None
                }
            elif collector_name == 'treasury_direct':
                from government.treasury_direct_collector import TreasuryDirectCollector
                collector = TreasuryDirectCollector()
                # Test with security search
                data = collector.get_securities_search(type="Bill", days_to_maturity=30)
                results[collector_name] = {
                    "status": "✅ WORKING" if data else "❌ FAILED",
                    "sample_data": str(data)[:200] if data else None
                }
            elif collector_name == 'treasury_fiscal':
                from government.treasury_fiscal_collector import TreasuryFiscalCollector
                collector = TreasuryFiscalCollector()
                # Test with debt to penny
                data = collector.get_debt_to_penny(limit=1)
                results[collector_name] = {
                    "status": "✅ WORKING" if data else "❌ FAILED",
                    "sample_data": str(data)[:200] if data else None
                }
            elif collector_name == 'bea':
                from government.bea_collector import BEACollector
                collector = BEACollector()
                # Test with GDP data
                data = collector.get_gdp_data(frequency="Q", years=1)
                results[collector_name] = {
                    "status": "✅ WORKING" if data else "❌ FAILED",
                    "sample_data": str(data)[:200] if data else None
                }
            elif collector_name == 'bls':
                from government.bls_collector import BLSCollector
                collector = BLSCollector()
                # Test with unemployment rate
                data = collector.get_unemployment_rate(years=1)
                results[collector_name] = {
                    "status": "✅ WORKING" if data else "❌ FAILED",
                    "sample_data": str(data)[:200] if data else None
                }
            elif collector_name == 'eia':
                from government.eia_collector import EIACollector
                collector = EIACollector()
                # Test with petroleum data
                data = collector.get_petroleum_summary()
                results[collector_name] = {
                    "status": "✅ WORKING" if data else "❌ FAILED",
                    "sample_data": str(data)[:200] if data else None
                }
            elif collector_name == 'fdic':
                from government.fdic_collector import FDICCollector
                collector = FDICCollector()
                # Test with bank search
                data = collector.search_institutions(name="Bank of America", limit=1)
                results[collector_name] = {
                    "status": "✅ WORKING" if data else "❌ FAILED",
                    "sample_data": str(data)[:200] if data else None
                }
        except Exception as e:
            results[collector_name] = {
                "status": "❌ ERROR",
                "error": str(e)[:200]
            }
    
    return results

def test_mcp_collectors() -> Dict[str, Any]:
    """Test MCP collectors"""
    results = {}
    
    # Test Alpha Vantage MCP
    try:
        from commercial.test.test_alpha_vantage_standalone import test_standalone_alpha_vantage
        av_result = test_standalone_alpha_vantage()
        results['alpha_vantage_mcp'] = {
            "status": "✅ WORKING" if av_result else "❌ FAILED",
            "details": "79 AI-optimized tools available"
        }
    except Exception as e:
        results['alpha_vantage_mcp'] = {
            "status": "❌ ERROR",
            "error": str(e)[:200]
        }
    
    # Test Data.gov MCP (check if server is running)
    try:
        import requests
        response = requests.post(
            'http://localhost:3001/mcp',
            json={"jsonrpc": "2.0", "id": "1", "method": "server/info", "params": {}},
            timeout=5
        )
        if response.status_code == 200:
            results['data_gov_mcp'] = {
                "status": "✅ RUNNING",
                "details": "Server operational on port 3001"
            }
        else:
            results['data_gov_mcp'] = {
                "status": "❌ NOT RESPONDING",
                "details": f"Status code: {response.status_code}"
            }
    except Exception as e:
        results['data_gov_mcp'] = {
            "status": "⚠️ NOT RUNNING",
            "details": "Start with: python government/mcp/server.py"
        }
    
    return results

def test_routing_system() -> Dict[str, Any]:
    """Test the four-quadrant routing system"""
    try:
        from collector_router import CollectorRouter
        router = CollectorRouter()
        
        # Test various routing scenarios
        test_cases = [
            {"query": "AAPL stock price", "expected": "commercial"},
            {"query": "unemployment rate", "expected": "government"},
            {"query": "SEC filings for MSFT", "expected": "government"},
            {"query": "forex USD/EUR", "expected": "commercial"}
        ]
        
        results = []
        for test in test_cases:
            route = router.route_request(test["query"])
            results.append({
                "query": test["query"],
                "routed_to": route.get("quadrant", "unknown"),
                "correct": route.get("quadrant", "").startswith(test["expected"])
            })
        
        success_rate = sum(1 for r in results if r["correct"]) / len(results) * 100
        
        return {
            "status": f"✅ {success_rate:.0f}% accurate",
            "test_results": results
        }
    except Exception as e:
        return {
            "status": "❌ ERROR",
            "error": str(e)[:200]
        }

def generate_status_report(results: Dict[str, Any]) -> str:
    """Generate a comprehensive status report"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    report = f"""
# 📊 Stock Picker Platform - Collector Status Report
**Generated**: {timestamp}

## 🏛️ Government API Collectors (8 total)
"""
    
    gov_results = results.get('government', {})
    working = sum(1 for v in gov_results.values() if "WORKING" in v.get("status", ""))
    
    report += f"\n**Overall Status**: {working}/8 collectors operational\n\n"
    
    for collector, status in gov_results.items():
        report += f"- **{collector.upper()}**: {status.get('status', 'Unknown')}\n"
    
    report += "\n## 🤖 MCP Collectors\n\n"
    
    mcp_results = results.get('mcp', {})
    for collector, status in mcp_results.items():
        report += f"- **{collector.replace('_', ' ').title()}**: {status.get('status', 'Unknown')}\n"
        if 'details' in status:
            report += f"  - {status['details']}\n"
    
    report += "\n## 🔄 Routing System\n\n"
    
    routing = results.get('routing', {})
    report += f"- **Status**: {routing.get('status', 'Unknown')}\n"
    
    report += "\n## 📈 Summary\n\n"
    
    total_collectors = 8 + 2  # 8 government + 2 MCP
    total_working = working + sum(1 for v in mcp_results.values() if "WORKING" in v.get("status", "") or "RUNNING" in v.get("status", ""))
    
    report += f"- **Total Collectors**: {total_collectors}\n"
    report += f"- **Operational**: {total_working}\n"
    report += f"- **Success Rate**: {total_working/total_collectors*100:.1f}%\n"
    
    if total_working == total_collectors:
        report += "\n✅ **ALL SYSTEMS OPERATIONAL** - Ready for production!\n"
    else:
        report += f"\n⚠️ **{total_collectors - total_working} collectors need attention**\n"
    
    return report

def main():
    print("🔍 Testing all Stock Picker collectors...\n")
    
    results = {}
    
    # Test government collectors
    print("Testing government API collectors...")
    results['government'] = test_government_collectors()
    
    # Test MCP collectors
    print("Testing MCP collectors...")
    results['mcp'] = test_mcp_collectors()
    
    # Test routing system
    print("Testing routing system...")
    results['routing'] = test_routing_system()
    
    # Generate report
    report = generate_status_report(results)
    
    # Save results
    output_file = f"collector_status_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    with open(output_file, 'w') as f:
        f.write(report)
    
    # Save JSON results
    json_file = f"collector_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(json_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(report)
    print(f"\n📄 Report saved to: {output_file}")
    print(f"📊 JSON results saved to: {json_file}")
    
    return results

if __name__ == "__main__":
    main()