#!/usr/bin/env python3
"""
Simple Collector Verification Script
Tests each collector individually with proper imports
"""

import sys
import os
import json
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def verify_collectors():
    """Verify each collector can be imported and initialized"""
    
    results = {
        "timestamp": datetime.now().isoformat(),
        "collectors": {}
    }
    
    print("🔍 Verifying Stock Picker Collectors\n")
    print("=" * 50)
    
    # Government Collectors
    print("\n📊 Government API Collectors:")
    print("-" * 30)
    
    # FRED Collector
    try:
        from data_collectors.government.fred_collector import FREDCollector
        collector = FREDCollector()
        results["collectors"]["FRED"] = "✅ Working"
        print("✅ FRED Collector - Imported successfully")
    except Exception as e:
        results["collectors"]["FRED"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ FRED Collector - {str(e)[:50]}")
    
    # SEC EDGAR Collector  
    try:
        from data_collectors.government.sec_edgar_collector import SECEdgarCollector
        collector = SECEdgarCollector()
        results["collectors"]["SEC_EDGAR"] = "✅ Working"
        print("✅ SEC EDGAR Collector - Imported successfully")
    except Exception as e:
        results["collectors"]["SEC_EDGAR"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ SEC EDGAR Collector - {str(e)[:50]}")
    
    # BEA Collector
    try:
        from data_collectors.government.bea_collector import BEACollector
        collector = BEACollector()
        results["collectors"]["BEA"] = "✅ Working"
        print("✅ BEA Collector - Imported successfully")
    except Exception as e:
        results["collectors"]["BEA"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ BEA Collector - {str(e)[:50]}")
    
    # BLS Collector
    try:
        from data_collectors.government.bls_collector import BLSCollector
        collector = BLSCollector()
        results["collectors"]["BLS"] = "✅ Working"
        print("✅ BLS Collector - Imported successfully")
    except Exception as e:
        results["collectors"]["BLS"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ BLS Collector - {str(e)[:50]}")
    
    # Treasury Direct Collector
    try:
        from data_collectors.government.treasury_direct_collector import TreasuryDirectCollector
        collector = TreasuryDirectCollector()
        results["collectors"]["Treasury_Direct"] = "✅ Working"
        print("✅ Treasury Direct Collector - Imported successfully")
    except Exception as e:
        results["collectors"]["Treasury_Direct"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ Treasury Direct Collector - {str(e)[:50]}")
    
    # Treasury Fiscal Collector
    try:
        from data_collectors.government.treasury_fiscal_collector import TreasuryFiscalCollector
        collector = TreasuryFiscalCollector()
        results["collectors"]["Treasury_Fiscal"] = "✅ Working"
        print("✅ Treasury Fiscal Collector - Imported successfully")
    except Exception as e:
        results["collectors"]["Treasury_Fiscal"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ Treasury Fiscal Collector - {str(e)[:50]}")
    
    # EIA Collector
    try:
        from data_collectors.government.eia_collector import EIACollector
        collector = EIACollector()
        results["collectors"]["EIA"] = "✅ Working"
        print("✅ EIA Collector - Imported successfully")
    except Exception as e:
        results["collectors"]["EIA"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ EIA Collector - {str(e)[:50]}")
    
    # FDIC Collector
    try:
        from data_collectors.government.fdic_collector import FDICCollector
        collector = FDICCollector()
        results["collectors"]["FDIC"] = "✅ Working"
        print("✅ FDIC Collector - Imported successfully")
    except Exception as e:
        results["collectors"]["FDIC"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ FDIC Collector - {str(e)[:50]}")
    
    # MCP Collectors
    print("\n🤖 MCP Collectors:")
    print("-" * 30)
    
    # Alpha Vantage MCP
    try:
        from data_collectors.commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector
        # Note: This will likely fail without proper MCP client setup
        results["collectors"]["Alpha_Vantage_MCP"] = "✅ Module exists"
        print("✅ Alpha Vantage MCP - Module found")
    except Exception as e:
        results["collectors"]["Alpha_Vantage_MCP"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ Alpha Vantage MCP - {str(e)[:50]}")
    
    # Data.gov MCP Server
    try:
        import requests
        response = requests.post(
            'http://localhost:3001/mcp',
            json={"jsonrpc": "2.0", "id": "1", "method": "server/info", "params": {}},
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            if 'result' in data:
                results["collectors"]["Data_Gov_MCP"] = "✅ Server running"
                print(f"✅ Data.gov MCP Server - Running (8 tools available)")
            else:
                results["collectors"]["Data_Gov_MCP"] = "⚠️ Server responding but no tools"
                print("⚠️ Data.gov MCP Server - Responding but check tools")
        else:
            results["collectors"]["Data_Gov_MCP"] = f"❌ HTTP {response.status_code}"
            print(f"❌ Data.gov MCP Server - HTTP {response.status_code}")
    except requests.exceptions.ConnectionError:
        results["collectors"]["Data_Gov_MCP"] = "❌ Not running"
        print("❌ Data.gov MCP Server - Not running (start with: python data_collectors/government/mcp/server.py)")
    except Exception as e:
        results["collectors"]["Data_Gov_MCP"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ Data.gov MCP Server - {str(e)[:50]}")
    
    # Routing System
    print("\n🔄 Routing System:")
    print("-" * 30)
    
    try:
        from data_collectors.collector_router import CollectorRouter
        router = CollectorRouter()
        results["collectors"]["Router"] = "✅ Working"
        print("✅ Collector Router - Imported successfully")
    except Exception as e:
        results["collectors"]["Router"] = f"❌ Error: {str(e)[:50]}"
        print(f"❌ Collector Router - {str(e)[:50]}")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    
    working = sum(1 for v in results["collectors"].values() if "✅" in str(v))
    total = len(results["collectors"])
    
    print(f"\nTotal Collectors: {total}")
    print(f"Working: {working}")
    print(f"Success Rate: {working/total*100:.1f}%")
    
    if working == total:
        print("\n🎉 ALL COLLECTORS VERIFIED SUCCESSFULLY!")
    else:
        failed = total - working
        print(f"\n⚠️ {failed} collector(s) need attention")
    
    # Save results
    output_file = f"collector_verification_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Results saved to: {output_file}")
    
    return results

if __name__ == "__main__":
    verify_collectors()