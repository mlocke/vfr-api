"""
Commercial Data Collectors Package

This package contains collectors for commercial financial data APIs and MCP servers.
Organized into quadrants for optimal data source management:

- api/: Traditional API collectors (IEX Cloud, Polygon.io, Yahoo Finance)  
- mcp/: MCP-based collectors (Alpha Vantage MCP, Financial Modeling Prep MCP)
- base/: Shared interfaces and utilities for commercial collectors
- test/: Test suites for commercial collector functionality

The commercial collectors extend the base DataCollectorInterface with additional
capabilities for cost tracking, quota management, and subscription tier handling.
"""

from .base import (
    CommercialCollectorInterface,
    MCPCollectorBase,
    APIUsageTracker
)

__version__ = "1.0.0"
__author__ = "Stock Picker Platform"

# Export key classes for easy import
__all__ = [
    'CommercialCollectorInterface',
    'MCPCollectorBase', 
    'APIUsageTracker'
]