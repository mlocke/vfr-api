"""
Traditional API Commercial Collectors

Direct API integrations for commercial financial data sources.
Provides fallback capabilities and specialized data not available via MCP:

- IEX Cloud: Professional real-time market data
- Polygon.io: Multi-asset class coverage (stocks, options, forex, crypto)
- Yahoo Finance: Free backup data source
- Other commercial APIs as needed

These collectors serve as:
- Primary data sources when MCP unavailable
- Fallback options when MCP quotas exceeded
- Specialized data providers for unique datasets
"""

# Future imports when API collectors are implemented:
# from .iex_cloud_collector import IEXCloudCollector
# from .polygon_collector import PolygonCollector
# from .yahoo_finance_collector import YahooFinanceCollector

__version__ = "1.0.0"

# Placeholder for future API collector exports
__all__ = [
    # 'IEXCloudCollector',
    # 'PolygonCollector', 
    # 'YahooFinanceCollector'
]