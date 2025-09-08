"""
Commercial MCP Collectors

This module contains MCP-based commercial data collectors that provide
premium financial data through the Model Context Protocol.

Available Collectors:
    AlphaVantageMCPCollector: Premium market data with 79 MCP tools

The collectors in this module represent the cutting edge of financial
data integration, combining MCP protocol efficiency with comprehensive
market data coverage.
"""

from .alpha_vantage_mcp_collector import AlphaVantageMCPCollector
from .mcp_client import (
    MCPClient,
    MCPClientError,
    MCPConnectionError,
    MCPProtocolError,
    MCPTimeoutError,
    MCPRateLimitError
)

__all__ = [
    'AlphaVantageMCPCollector',
    'MCPClient',
    'MCPClientError',
    'MCPConnectionError',
    'MCPProtocolError',
    'MCPTimeoutError',
    'MCPRateLimitError'
]

__version__ = '1.0.0'