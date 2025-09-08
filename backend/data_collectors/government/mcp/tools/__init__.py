"""
Data.gov MCP Tools

Collection of MCP tools for government financial data analysis.
These tools provide AI-native access to SEC filings, institutional holdings,
Treasury data, and Federal Reserve indicators.

Tool Categories:
- Financial Analysis: SEC XBRL data, financial statements, trend analysis
- Institutional Tracking: Form 13F holdings, smart money flows
- Treasury & Macro: Yield curves, interest rates, economic indicators  
- Fund Flows: Mutual fund and ETF flow analysis
- Economic Indicators: Comprehensive economic health assessment

All tools follow MCP (Model Context Protocol) specifications for
AI-optimized financial analysis capabilities.
"""

from .financial_analysis_tools import MCP_FINANCIAL_TOOLS
from .institutional_tracking_tools import MCP_INSTITUTIONAL_TOOLS
from .treasury_macro_tools import MCP_TREASURY_MACRO_TOOLS
from .fund_flow_tools import MCP_FUND_FLOW_TOOLS
from .economic_indicator_tools import MCP_ECONOMIC_INDICATOR_TOOLS

# Combine all tool registries
ALL_DATA_GOV_MCP_TOOLS = {
    **MCP_FINANCIAL_TOOLS,
    **MCP_INSTITUTIONAL_TOOLS,
    **MCP_TREASURY_MACRO_TOOLS,
    **MCP_FUND_FLOW_TOOLS,
    **MCP_ECONOMIC_INDICATOR_TOOLS
}

# Tool categories for optimization
TOOL_CATEGORIES = {
    'financial_analysis': list(MCP_FINANCIAL_TOOLS.keys()),
    'institutional_tracking': list(MCP_INSTITUTIONAL_TOOLS.keys()),
    'treasury_macro': list(MCP_TREASURY_MACRO_TOOLS.keys()),
    'fund_flows': list(MCP_FUND_FLOW_TOOLS.keys()),
    'economic_indicators': list(MCP_ECONOMIC_INDICATOR_TOOLS.keys())
}

__all__ = [
    'ALL_DATA_GOV_MCP_TOOLS',
    'TOOL_CATEGORIES', 
    'MCP_FINANCIAL_TOOLS',
    'MCP_INSTITUTIONAL_TOOLS',
    'MCP_TREASURY_MACRO_TOOLS',
    'MCP_FUND_FLOW_TOOLS',
    'MCP_ECONOMIC_INDICATOR_TOOLS'
]