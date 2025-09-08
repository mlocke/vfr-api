"""
Government MCP Collectors

MCP (Model Context Protocol) collectors for government financial data sources.
These collectors leverage AI-native MCP servers to provide enhanced government
data integration with intelligent tool discovery and optimization.

Available Collectors:
- DataGovMCPCollector: Comprehensive data.gov financial datasets
- (Future): SEC MCP, Fed MCP, Treasury MCP when available

Features:
- JSON-RPC 2.0 MCP protocol compliance
- AI-optimized tool discovery and categorization
- Government data transparency and reliability
- Cost-free access to official financial data
- 15+ years of SEC historical data coverage
"""

from .data_gov_mcp_collector import DataGovMCPCollector

__all__ = [
    'DataGovMCPCollector'
]

# Version information
__version__ = '1.0.0'
__author__ = 'Stock Picker Platform'
__description__ = 'Government MCP collectors for financial data'