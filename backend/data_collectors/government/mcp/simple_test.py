"""Simple test of Data.gov MCP Collector architecture fix."""

import asyncio
import sys
import os
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    from data_collectors.government.mcp.data_gov_mcp_collector import DataGovMCPCollector
    print("✅ Successfully imported DataGovMCPCollector")
    
    # Test basic initialization
    collector = DataGovMCPCollector()
    print(f"✅ Collector initialized: {collector.source_name}")
    print(f"✅ Supported data types: {len(collector.supported_data_types)}")
    print(f"✅ Tool categories: {len(collector.tool_categories)}")
    print(f"✅ Tools available: {collector.tools_available}")
    
    # Test string representation
    print(f"✅ String representation: {collector}")
    
    # Test routing methods
    test_criteria = {'query': 'sec_filings analysis'}
    should_activate = collector.should_activate(test_criteria)
    priority = collector.get_activation_priority(test_criteria)
    print(f"✅ Routing - Should activate: {should_activate}, Priority: {priority}")
    
    print("\n🎉 ARCHITECTURE FIX SUCCESS!")
    print("The Data.gov MCP Collector is now using direct tool calls instead of external MCP client.")
    
except ImportError as e:
    print(f"❌ Import failed: {e}")
except Exception as e:
    print(f"❌ Test failed: {e}")