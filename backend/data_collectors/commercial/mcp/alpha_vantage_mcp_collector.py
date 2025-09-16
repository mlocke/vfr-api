"""
Alpha Vantage MCP Collector

World's first commercial MCP collector for the Stock Picker platform.
Integrates with Alpha Vantage's MCP server providing 79 AI-optimized tools
for comprehensive financial market analysis and data collection.

Features:
- 79 MCP tools covering stocks, forex, crypto, and technical analysis
- Real-time and historical market data
- Advanced technical indicators and overlays
- Cost tracking and quota management
- MCP-native protocol optimization
- AI-friendly data formatting

This collector represents the cutting edge of financial data integration,
combining the power of MCP protocol with Alpha Vantage's comprehensive
market data coverage.
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import json
import sys
from pathlib import Path

# Add path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

# Import required base classes
try:
    # Try relative imports first
    from ...base.collector_interface import DataCollectorInterface, CollectorConfig
    from ..base.commercial_collector_interface import SubscriptionTier
except ImportError:
    # Fallback to absolute imports
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    from base.collector_interface import DataCollectorInterface, CollectorConfig

    # Define SubscriptionTier locally if needed
    from enum import Enum
    class SubscriptionTier(Enum):
        FREE = "free"
        BASIC = "basic"
        PREMIUM = "premium"
        ENTERPRISE = "enterprise"

# Import MCP client
from .mcp_client import MCPClient, MCPConnectionError, MCPProtocolError, MCPTimeoutError, MCPRateLimitError

logger = logging.getLogger(__name__)


class AlphaVantageMCPCollector(DataCollectorInterface):
    """
    Alpha Vantage MCP Collector - Premium financial data via MCP protocol.
    
    Provides access to 79 AI-optimized tools for comprehensive market analysis:
    - Real-time stock quotes and historical data
    - Advanced technical indicators (RSI, MACD, Bollinger Bands, etc.)
    - Fundamental data (earnings, income statements, balance sheets)
    - Economic indicators and market sentiment
    - Forex and cryptocurrency data
    - News and social sentiment analysis
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None, api_key: Optional[str] = None):
        """
        Initialize Alpha Vantage MCP collector.
        
        Args:
            config: Base collector configuration
            api_key: Alpha Vantage API key
        """
        # Set default config if none provided
        if config is None:
            config = CollectorConfig(
                api_key=api_key or "4M20CQ7QT67RJ835",
                base_url="https://alphavantage-mcp.com",
                timeout=30,
                requests_per_minute=5,
                rate_limit_enabled=True
            )
        
        # Use provided API key or default
        self.alpha_vantage_api_key = api_key or "4M20CQ7QT67RJ835"
        
        # MCP server URL (official Alpha Vantage MCP server)
        mcp_server_url = f"https://mcp.alphavantage.co/mcp?apikey={self.alpha_vantage_api_key}"

        # Initialize MCP client with production configuration
        self.mcp_client_config = {
            'timeout': 30.0,
            'max_retries': 3,
            'backoff_factor': 2.0,
            'pool_size': 5,
            'enable_compression': True
        }
        
        # Initialize base data collector
        super().__init__(config)
        
        # MCP-specific attributes
        self.mcp_server_url = mcp_server_url
        self.api_key = self.alpha_vantage_api_key
        self.connection_established = False
        self.server_info = None
        self.available_tools = []
        self.mcp_client = None
        self.last_health_check = None
        self.connection_retry_count = 0
        self.max_connection_retries = 5
        
        # Alpha Vantage specific configuration
        self._subscription_tier = SubscriptionTier.PREMIUM  # Assume premium with API key
        self._monthly_budget = 100.0  # Default $100 budget
        
        # Tool categories specific to Alpha Vantage
        self.av_tool_categories = {
            'market_data': [],
            'technical_indicators': [],
            'fundamental_data': [],
            'economic_indicators': [],
            'forex': [],
            'crypto': [],
            'news_sentiment': []
        }
        
        # Cost structure (estimated based on Alpha Vantage pricing)
        self.base_cost_per_request = 0.01  # $0.01 per request
        self.premium_multiplier = 1.5      # Premium tools cost 1.5x more
        
        logger.info(f"Initialized Alpha Vantage MCP Collector with API key: {self.alpha_vantage_api_key[:8]}...")
    
    @property
    def cost_per_request(self) -> float:
        """Base cost per request for Alpha Vantage."""
        return self.base_cost_per_request
    
    @property
    def monthly_quota_limit(self) -> Optional[int]:
        """Monthly request quota based on subscription tier."""
        quota_map = {
            SubscriptionTier.FREE: 500,
            SubscriptionTier.BASIC: 5000,
            SubscriptionTier.PREMIUM: 25000,
            SubscriptionTier.ENTERPRISE: None  # Unlimited
        }
        return quota_map.get(self._subscription_tier, 25000)
    
    @property
    def supports_mcp_protocol(self) -> bool:
        """Alpha Vantage MCP collector always supports MCP."""
        return True
    
    def get_tool_cost_map(self) -> Dict[str, float]:
        """
        Get mapping of Alpha Vantage MCP tool names to their costs.
        
        Returns:
            Dictionary mapping tool names to cost per call
        """
        # Base costs for different tool categories
        cost_map = {}
        
        # Market data tools (real-time quotes, historical data)
        market_data_tools = [
            'TIME_SERIES_INTRADAY', 'TIME_SERIES_DAILY', 'TIME_SERIES_WEEKLY',
            'TIME_SERIES_MONTHLY', 'QUOTE_ENDPOINT', 'SEARCH_ENDPOINT',
            'MARKET_STATUS', 'GLOBAL_QUOTE'
        ]
        for tool in market_data_tools:
            cost_map[tool] = self.base_cost_per_request
        
        # Technical indicator tools
        technical_tools = [
            'SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'MAMA',
            'VWAP', 'T3', 'RSI', 'WILLR', 'ADX', 'ADXR', 'APO', 'PPO',
            'MACD', 'MACDEXT', 'STOCH', 'STOCHF', 'STOCHRSI', 'CCI',
            'CMO', 'ROC', 'ROCR', 'AROON', 'AROONOSC', 'MFI', 'TRIX',
            'ULTOSC', 'DX', 'MINUS_DI', 'PLUS_DI', 'MINUS_DM', 'PLUS_DM',
            'BBANDS', 'MIDPOINT', 'MIDPRICE', 'SAR', 'TRANGE', 'ATR',
            'NATR', 'AD', 'ADOSC', 'OBV'
        ]
        for tool in technical_tools:
            cost_map[tool] = self.base_cost_per_request * 1.2  # Slightly higher for technical analysis
        
        # Fundamental data tools (premium pricing)
        fundamental_tools = [
            'OVERVIEW', 'EARNINGS', 'INCOME_STATEMENT', 'BALANCE_SHEET',
            'CASH_FLOW', 'LISTING_STATUS', 'IPO_CALENDAR', 'EARNINGS_CALENDAR'
        ]
        for tool in fundamental_tools:
            cost_map[tool] = self.base_cost_per_request * self.premium_multiplier
        
        # Economic indicators
        economic_tools = [
            'REAL_GDP', 'REAL_GDP_PER_CAPITA', 'TREASURY_YIELD', 'FEDERAL_FUNDS_RATE',
            'CPI', 'INFLATION', 'RETAIL_SALES', 'DURABLES', 'UNEMPLOYMENT',
            'NONFARM_PAYROLL'
        ]
        for tool in economic_tools:
            cost_map[tool] = self.base_cost_per_request * 1.3
        
        # Forex tools
        forex_tools = [
            'FX_INTRADAY', 'FX_DAILY', 'FX_WEEKLY', 'FX_MONTHLY', 'CURRENCY_EXCHANGE_RATE'
        ]
        for tool in forex_tools:
            cost_map[tool] = self.base_cost_per_request * 1.1
        
        # Cryptocurrency tools
        crypto_tools = [
            'CRYPTO_INTRADAY', 'DIGITAL_CURRENCY_DAILY', 'DIGITAL_CURRENCY_WEEKLY',
            'DIGITAL_CURRENCY_MONTHLY', 'CRYPTO_RATING'
        ]
        for tool in crypto_tools:
            cost_map[tool] = self.base_cost_per_request * 1.4
        
        # News and sentiment tools (premium)
        news_tools = [
            'NEWS_SENTIMENT', 'TOP_GAINERS_LOSERS', 'MARKET_NEWS_SENTIMENT'
        ]
        for tool in news_tools:
            cost_map[tool] = self.base_cost_per_request * self.premium_multiplier
        
        return cost_map
    
    def get_subscription_tier_info(self) -> Dict[str, Any]:
        """Get current Alpha Vantage subscription tier details."""
        return {
            'tier': self._subscription_tier.value,
            'monthly_quota': self.monthly_quota_limit,
            'cost_per_request': self.cost_per_request,
            'features': self._get_tier_features(),
            'supports_real_time': True,
            'supports_premium_endpoints': self._subscription_tier in [
                SubscriptionTier.PREMIUM, SubscriptionTier.ENTERPRISE
            ]
        }
    
    def _get_tier_features(self) -> List[str]:
        """Get features available for current subscription tier."""
        feature_map = {
            SubscriptionTier.FREE: [
                '500 requests per month',
                'Basic market data',
                'Limited technical indicators'
            ],
            SubscriptionTier.BASIC: [
                '5,000 requests per month',
                'Real-time quotes',
                'All technical indicators',
                'Basic fundamental data'
            ],
            SubscriptionTier.PREMIUM: [
                '25,000 requests per month',
                'Real-time quotes and news',
                'All technical indicators',
                'Complete fundamental data',
                'Economic indicators',
                'Forex and crypto data',
                'News sentiment analysis'
            ],
            SubscriptionTier.ENTERPRISE: [
                'Unlimited requests',
                'All premium features',
                'Priority support',
                'Custom integrations'
            ]
        }
        return feature_map.get(self._subscription_tier, [])
    
    async def collect_data(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Collect financial data using Alpha Vantage MCP tools with comprehensive error handling.

        Args:
            filters: Data collection filters and parameters

        Returns:
            Collected and processed financial data
        """
        collection_start_time = datetime.now()

        try:
            # Validate filters
            self._validate_collection_filters(filters)

            # Ensure MCP connection is established and healthy
            if not await self._ensure_healthy_connection():
                raise MCPConnectionError("Unable to establish or maintain healthy MCP connection")

            # Analyze filters to determine required tools
            required_tools = self._analyze_filters_for_tools(filters)

            if not required_tools:
                logger.warning("No tools identified for the given filters")
                return self._create_empty_response(filters, "No applicable tools found")

            # Prepare tool calls with validation
            tool_calls = []
            for tool_info in required_tools:
                if await self._validate_tool_availability(tool_info['tool']):
                    tool_calls.append({
                        'tool_name': tool_info['tool'],
                        'arguments': tool_info['params']
                    })
                else:
                    logger.warning(f"Tool {tool_info['tool']} not available, skipping")

            if not tool_calls:
                raise MCPProtocolError("No valid tools available for execution")

            logger.info(f"Executing {len(tool_calls)} Alpha Vantage MCP tools")

            # Execute tools via MCP client with retry logic
            results = await self._execute_tools_with_retry(tool_calls)

            # Process and format results
            processed_data = self._process_alpha_vantage_results(results, filters)

            # Add execution metadata
            execution_time = (datetime.now() - collection_start_time).total_seconds()
            processed_data['execution_metadata'] = {
                'execution_time_seconds': execution_time,
                'tools_requested': len(tool_calls),
                'tools_successful': len([r for r in results if r.get('success')]),
                'connection_health': self.last_health_check,
                'server_info': self.server_info.name if self.server_info else None
            }

            logger.info(f"Data collection completed in {execution_time:.2f}s using {len(tool_calls)} tools")
            return processed_data

        except MCPRateLimitError as e:
            logger.warning(f"Rate limit exceeded: {e}")
            return self._create_error_response(filters, "rate_limit_exceeded", str(e))

        except MCPTimeoutError as e:
            logger.error(f"Request timeout: {e}")
            return self._create_error_response(filters, "timeout", str(e))

        except MCPConnectionError as e:
            logger.error(f"Connection error: {e}")
            return self._create_error_response(filters, "connection_error", str(e))

        except MCPProtocolError as e:
            logger.error(f"Protocol error: {e}")
            return self._create_error_response(filters, "protocol_error", str(e))

        except ValueError as e:
            logger.error(f"Invalid parameters: {e}")
            return self._create_error_response(filters, "invalid_parameters", str(e))

        except Exception as e:
            logger.error(f"Unexpected error during data collection: {e}", exc_info=True)
            return self._create_error_response(filters, "unexpected_error", str(e))
    
    def _analyze_filters_for_tools(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Analyze filters to determine which Alpha Vantage MCP tools to use.
        
        Args:
            filters: Request filters
            
        Returns:
            List of tool configurations
        """
        required_tools = []
        
        # Extract company symbols
        symbols = filters.get('companies', [])
        if isinstance(symbols, str):
            symbols = [symbols]
        
        # Real-time quotes
        if filters.get('real_time', False) and symbols:
            for symbol in symbols:
                required_tools.append({
                    'tool': 'GLOBAL_QUOTE',
                    'params': {
                        'symbol': symbol,
                        'apikey': self.alpha_vantage_api_key
                    }
                })
        
        # Historical time series data
        time_period = filters.get('time_period', 'daily')
        if symbols and not filters.get('real_time', False):
            for symbol in symbols:
                if time_period == 'intraday':
                    required_tools.append({
                        'tool': 'TIME_SERIES_INTRADAY',
                        'params': {
                            'symbol': symbol,
                            'interval': filters.get('interval', '5min'),
                            'apikey': self.alpha_vantage_api_key,
                            'outputsize': filters.get('output_size', 'compact')
                        }
                    })
                elif time_period == 'daily':
                    required_tools.append({
                        'tool': 'TIME_SERIES_DAILY',
                        'params': {
                            'symbol': symbol,
                            'apikey': self.alpha_vantage_api_key,
                            'outputsize': filters.get('output_size', 'compact')
                        }
                    })
        
        # Technical indicators
        if filters.get('analysis_type') == 'technical' and symbols:
            indicators = filters.get('technical_indicators', ['RSI', 'MACD', 'BBANDS'])
            
            for symbol in symbols:
                for indicator in indicators:
                    params = {
                        'symbol': symbol,
                        'interval': filters.get('interval', 'daily'),
                        'apikey': self.alpha_vantage_api_key
                    }
                    
                    # Add indicator-specific parameters
                    if indicator == 'RSI':
                        params['time_period'] = filters.get('rsi_period', 14)
                    elif indicator == 'MACD':
                        params['series_type'] = filters.get('series_type', 'close')
                    elif indicator == 'BBANDS':
                        params['time_period'] = filters.get('bb_period', 20)
                        params['series_type'] = filters.get('series_type', 'close')
                    
                    required_tools.append({
                        'tool': indicator,
                        'params': params
                    })
        
        # Fundamental data
        if filters.get('analysis_type') == 'fundamental' and symbols:
            for symbol in symbols:
                # Company overview
                required_tools.append({
                    'tool': 'OVERVIEW',
                    'params': {
                        'symbol': symbol,
                        'apikey': self.alpha_vantage_api_key
                    }
                })
                
                # Earnings data
                if filters.get('include_earnings', True):
                    required_tools.append({
                        'tool': 'EARNINGS',
                        'params': {
                            'symbol': symbol,
                            'apikey': self.alpha_vantage_api_key
                        }
                    })
        
        # Forex data
        if filters.get('forex_pairs'):
            pairs = filters['forex_pairs']
            if isinstance(pairs, str):
                pairs = [pairs]
            
            for pair in pairs:
                from_symbol, to_symbol = pair.split('/')
                required_tools.append({
                    'tool': 'CURRENCY_EXCHANGE_RATE',
                    'params': {
                        'from_currency': from_symbol,
                        'to_currency': to_symbol,
                        'apikey': self.alpha_vantage_api_key
                    }
                })
        
        # Cryptocurrency data
        if filters.get('crypto_symbols'):
            crypto_symbols = filters['crypto_symbols']
            if isinstance(crypto_symbols, str):
                crypto_symbols = [crypto_symbols]
            
            for crypto in crypto_symbols:
                required_tools.append({
                    'tool': 'DIGITAL_CURRENCY_DAILY',
                    'params': {
                        'symbol': crypto,
                        'market': filters.get('crypto_market', 'USD'),
                        'apikey': self.alpha_vantage_api_key
                    }
                })
        
        # News sentiment
        if filters.get('include_sentiment', False):
            required_tools.append({
                'tool': 'NEWS_SENTIMENT',
                'params': {
                    'tickers': ','.join(symbols) if symbols else None,
                    'topics': filters.get('news_topics', 'earnings'),
                    'time_from': filters.get('news_from', '20240101T0000'),
                    'apikey': self.alpha_vantage_api_key
                }
            })
        
        logger.debug(f"Identified {len(required_tools)} tools for Alpha Vantage MCP request")
        return required_tools
    
    async def establish_connection_async(self) -> bool:
        """Establish async MCP connection to Alpha Vantage server."""
        try:
            if self.connection_established and self.mcp_client:
                # Check if connection is still healthy
                health_check = await self.mcp_client.health_check()
                if health_check.get('healthy', False):
                    return True
                else:
                    logger.warning("Existing connection unhealthy, reconnecting...")
                    await self._cleanup_connection()

            # Create new MCP client with production configuration
            self.mcp_client = MCPClient(
                server_url=self.mcp_server_url,
                api_key=self.api_key,
                **self.mcp_client_config
            )

            # Connect to server with retry logic
            connection_successful = False
            for attempt in range(self.max_connection_retries):
                try:
                    await self.mcp_client.connect()
                    connection_successful = True
                    break
                except MCPConnectionError as e:
                    self.connection_retry_count += 1
                    if attempt < self.max_connection_retries - 1:
                        wait_time = (2 ** attempt) * 1.0  # Exponential backoff
                        logger.warning(f"Connection attempt {attempt + 1} failed: {e}. Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"All connection attempts failed: {e}")
                        raise

            if connection_successful:
                # Get server information
                self.server_info = self.mcp_client.get_server_info()
                if self.server_info:
                    self.connection_established = True

                    # Get available tools
                    tools = self.mcp_client.get_available_tools()
                    self.available_tools = tools
                    logger.info(f"Connected to Alpha Vantage MCP server: {self.server_info.name} with {len(tools)} tools")

                    # Categorize Alpha Vantage tools
                    self._categorize_alpha_vantage_tools(tools)

                    # Perform initial health check
                    self.last_health_check = await self.mcp_client.health_check()

                    return True

            return False

        except Exception as e:
            logger.error(f"Failed to establish Alpha Vantage MCP connection: {e}")
            await self._cleanup_connection()
            return False
    
    async def _execute_mcp_tools_async(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Execute MCP tools asynchronously using real Alpha Vantage MCP server."""
        if not self.connection_established or not self.mcp_client:
            raise MCPConnectionError("MCP connection not established")

        try:
            # Use batch execution for better performance
            results = await self.mcp_client.batch_call_tools(
                tool_calls,
                optimize_order=True
            )

            # Process results and add metadata
            processed_results = []
            for result in results:
                processed_result = {
                    'tool_name': result['tool_name'],
                    'success': result['success'],
                    'timestamp': result.get('timestamp', datetime.now().isoformat())
                }

                if result['success']:
                    processed_result['result'] = result['result']
                else:
                    processed_result['error'] = result.get('error', 'Unknown error')
                    processed_result['error_type'] = result.get('error_type', 'UnknownError')

                    # Log detailed error information
                    logger.warning(f"Tool {result['tool_name']} failed: {result.get('error')}")

                processed_results.append(processed_result)

            return processed_results

        except MCPRateLimitError as e:
            logger.warning(f"Rate limit hit during tool execution: {e}")
            raise
        except MCPTimeoutError as e:
            logger.error(f"Timeout during tool execution: {e}")
            raise
        except MCPConnectionError as e:
            logger.error(f"Connection error during tool execution: {e}")
            # Try to reconnect
            await self.establish_connection_async()
            raise
        except Exception as e:
            logger.error(f"Unexpected error during tool execution: {e}")
            raise
    
    async def _cleanup_connection(self) -> None:
        """Clean up MCP connection resources."""
        self.connection_established = False
        if self.mcp_client:
            try:
                await self.mcp_client.disconnect()
            except Exception as e:
                logger.warning(f"Error during connection cleanup: {e}")
            finally:
                self.mcp_client = None
        self.server_info = None
        self.available_tools = []
        self.last_health_check = None

    async def _validate_connection_health(self) -> bool:
        """Validate MCP connection health."""
        if not self.connection_established or not self.mcp_client:
            return False

        try:
            # Perform health check if it's been a while since last check
            now = datetime.now()
            if (self.last_health_check is None or
                (now - datetime.fromisoformat(self.last_health_check['timestamp'])).total_seconds() > 300):

                self.last_health_check = await self.mcp_client.health_check()

            return self.last_health_check.get('healthy', False)

        except Exception as e:
            logger.warning(f"Health check failed: {e}")
            return False

    async def _simulate_alpha_vantage_tool(self, tool_call: Dict[str, Any]) -> Dict[str, Any]:
        """
        DEPRECATED: This method is kept for backward compatibility only.

        In production, use real MCP tool calls via _execute_mcp_tools_async.
        This simulation is only used as fallback during development/testing.
        """
        logger.warning("Using deprecated simulation method. Switch to real MCP integration in production.")

        # Fallback simulation (keeping original implementation for compatibility)
        tool_name = tool_call['tool_name']
        params = tool_call.get('arguments', {})
        symbol = params.get('symbol', 'AAPL')

        # Simulate processing delay
        await asyncio.sleep(0.1)
        tool_name = tool_call['tool_name']
        params = tool_call.get('arguments', {})
        symbol = params.get('symbol', 'AAPL')
        
        # Simulate processing delay
        await asyncio.sleep(0.1)
        
        if tool_name == 'GLOBAL_QUOTE':
            return {
                "Global Quote": {
                    "01. symbol": symbol,
                    "02. open": "150.00",
                    "03. high": "152.50",
                    "04. low": "149.25",
                    "05. price": "151.75",
                    "06. volume": "45678901",
                    "07. latest trading day": "2025-09-07",
                    "08. previous close": "150.50",
                    "09. change": "1.25",
                    "10. change percent": "0.83%"
                }
            }
        
        elif tool_name == 'TIME_SERIES_DAILY':
            return {
                "Meta Data": {
                    "1. Information": "Daily Prices (open, high, low, close) and Volumes",
                    "2. Symbol": symbol,
                    "3. Last Refreshed": "2025-09-07",
                    "4. Output Size": "Compact",
                    "5. Time Zone": "US/Eastern"
                },
                "Time Series (Daily)": {
                    "2025-09-07": {
                        "1. open": "150.00",
                        "2. high": "152.50",
                        "3. low": "149.25",
                        "4. close": "151.75",
                        "5. volume": "45678901"
                    },
                    "2025-09-06": {
                        "1. open": "149.50",
                        "2. high": "151.00",
                        "3. low": "148.75",
                        "4. close": "150.50",
                        "5. volume": "38456789"
                    }
                }
            }
        
        elif tool_name == 'RSI':
            return {
                "Meta Data": {
                    "1: Symbol": symbol,
                    "2: Indicator": "Relative Strength Index (RSI)",
                    "3: Last Refreshed": "2025-09-07",
                    "4: Interval": params.get('interval', 'daily'),
                    "5: Time Period": params.get('time_period', 14)
                },
                "Technical Analysis: RSI": {
                    "2025-09-07": {"RSI": "62.45"},
                    "2025-09-06": {"RSI": "65.23"},
                    "2025-09-05": {"RSI": "58.91"}
                }
            }
        
        elif tool_name == 'OVERVIEW':
            return {
                "Symbol": symbol,
                "AssetType": "Common Stock",
                "Name": "Apple Inc" if symbol == "AAPL" else f"{symbol} Company",
                "Description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.",
                "CIK": "320193",
                "Exchange": "NASDAQ",
                "Currency": "USD",
                "Country": "USA",
                "Sector": "TECHNOLOGY",
                "Industry": "Consumer Electronics",
                "Address": "One Apple Park Way, Cupertino, CA, United States, 95014",
                "FiscalYearEnd": "September",
                "LatestQuarter": "2025-06-30",
                "MarketCapitalization": "2850000000000",
                "EBITDA": "125000000000",
                "PERatio": "28.5",
                "PEGRatio": "2.1",
                "BookValue": "4.25",
                "DividendPerShare": "0.96",
                "DividendYield": "0.0045",
                "EPS": "6.13",
                "RevenuePerShareTTM": "24.32",
                "ProfitMargin": "0.252",
                "OperatingMarginTTM": "0.298",
                "ReturnOnAssetsTTM": "0.198",
                "ReturnOnEquityTTM": "1.479",
                "RevenueTTM": "394328000000",
                "GrossProfitTTM": "169148000000",
                "DilutedEPSTTM": "6.13",
                "QuarterlyEarningsGrowthYOY": "0.076",
                "QuarterlyRevenueGrowthYOY": "0.049",
                "AnalystTargetPrice": "165.00",
                "TrailingPE": "28.5",
                "ForwardPE": "26.2",
                "PriceToSalesRatioTTM": "7.23",
                "PriceToBookRatio": "35.7",
                "EVToRevenue": "7.45",
                "EVToEBITDA": "22.8",
                "Beta": "1.24",
                "52WeekHigh": "199.62",
                "52WeekLow": "164.08",
                "50DayMovingAverage": "174.23",
                "200DayMovingAverage": "182.45"
            }
        
        else:
            # Generic response for other tools
            return {
                "tool": tool_name,
                "symbol": symbol,
                "timestamp": datetime.now().isoformat(),
                "data": "Simulated response for " + tool_name,
                "note": "This is simulated data - production uses real MCP integration"
            }
    
    def _categorize_alpha_vantage_tools(self, tools: List[str]) -> None:
        """Categorize Alpha Vantage tools for optimization."""
        for tool in tools:
            tool_lower = tool.lower()
            
            if any(term in tool_lower for term in ['time_series', 'quote', 'search']):
                self.av_tool_categories['market_data'].append(tool)
            elif any(term in tool_lower for term in ['rsi', 'macd', 'sma', 'ema', 'bbands']):
                self.av_tool_categories['technical_indicators'].append(tool)
            elif any(term in tool_lower for term in ['overview', 'earnings', 'income', 'balance']):
                self.av_tool_categories['fundamental_data'].append(tool)
            elif any(term in tool_lower for term in ['gdp', 'cpi', 'inflation', 'unemployment']):
                self.av_tool_categories['economic_indicators'].append(tool)
            elif any(term in tool_lower for term in ['fx', 'currency', 'exchange']):
                self.av_tool_categories['forex'].append(tool)
            elif any(term in tool_lower for term in ['crypto', 'digital_currency']):
                self.av_tool_categories['crypto'].append(tool)
            elif any(term in tool_lower for term in ['news', 'sentiment']):
                self.av_tool_categories['news_sentiment'].append(tool)
    
    def _process_alpha_vantage_results(
        self, 
        results: List[Dict[str, Any]], 
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process and format Alpha Vantage MCP results."""
        processed_data = {
            'source': 'Alpha Vantage MCP',
            'timestamp': datetime.now().isoformat(),
            'request_filters': filters,
            'tools_used': len(results),
            'data': {}
        }
        
        # Organize results by data type
        for result in results:
            if not result['success']:
                logger.warning(f"Tool {result['tool_name']} failed: {result.get('error')}")
                continue
            
            tool_name = result['tool_name']
            tool_data = result['result']
            
            # Categorize and store data
            if tool_name in ['GLOBAL_QUOTE', 'TIME_SERIES_DAILY', 'TIME_SERIES_INTRADAY']:
                if 'market_data' not in processed_data['data']:
                    processed_data['data']['market_data'] = {}
                processed_data['data']['market_data'][tool_name] = tool_data
                
            elif tool_name in ['RSI', 'MACD', 'BBANDS', 'SMA', 'EMA']:
                if 'technical_indicators' not in processed_data['data']:
                    processed_data['data']['technical_indicators'] = {}
                processed_data['data']['technical_indicators'][tool_name] = tool_data
                
            elif tool_name in ['OVERVIEW', 'EARNINGS']:
                if 'fundamental_data' not in processed_data['data']:
                    processed_data['data']['fundamental_data'] = {}
                processed_data['data']['fundamental_data'][tool_name] = tool_data
                
            else:
                # Store other data types
                category = self._infer_data_category(tool_name)
                if category not in processed_data['data']:
                    processed_data['data'][category] = {}
                processed_data['data'][category][tool_name] = tool_data
        
        # Add summary statistics
        processed_data['summary'] = {
            'total_tools_executed': len(results),
            'successful_tools': len([r for r in results if r['success']]),
            'failed_tools': len([r for r in results if not r['success']]),
            'data_categories': list(processed_data['data'].keys()),
            'estimated_cost': self._calculate_request_cost(results)
        }
        
        return processed_data
    
    def _infer_data_category(self, tool_name: str) -> str:
        """Infer data category from tool name."""
        tool_lower = tool_name.lower()
        
        if any(term in tool_lower for term in ['fx', 'currency']):
            return 'forex'
        elif any(term in tool_lower for term in ['crypto', 'digital']):
            return 'cryptocurrency'
        elif any(term in tool_lower for term in ['news', 'sentiment']):
            return 'sentiment'
        elif any(term in tool_lower for term in ['gdp', 'cpi', 'economic']):
            return 'economic_indicators'
        else:
            return 'other'
    
    def _calculate_request_cost(self, results: List[Dict[str, Any]]) -> float:
        """Calculate total cost for the request."""
        cost_map = self.get_tool_cost_map()
        total_cost = 0.0
        
        for result in results:
            if result['success']:
                tool_name = result['tool_name']
                tool_cost = cost_map.get(tool_name, self.base_cost_per_request)
                total_cost += tool_cost
        
        return total_cost
    
    # Synchronous wrapper methods for compatibility
    
    def should_activate(self, filters: Dict[str, Any]) -> bool:
        """
        Determine if Alpha Vantage MCP collector should handle this request.
        
        Activates for:
        - Real-time market data requests
        - Technical analysis requirements
        - Premium data needs (earnings, fundamentals with real-time)
        - Forex and crypto data
        - News sentiment analysis
        """
        # Real-time requirements always need Alpha Vantage
        if filters.get('real_time', False):
            return True
        
        # Technical analysis requires premium data
        if filters.get('analysis_type') == 'technical':
            return True
        
        # Intraday data needs commercial source
        if filters.get('time_period') == 'intraday':
            return True
        
        # Forex data
        if filters.get('forex_pairs') or any(
            key in filters for key in ['currency', 'fx_data', 'exchange_rate']
        ):
            return True
        
        # Cryptocurrency data
        if filters.get('crypto_symbols') or any(
            key in filters for key in ['crypto', 'bitcoin', 'ethereum', 'digital_currency']
        ):
            return True
        
        # News sentiment analysis
        if filters.get('include_sentiment', False) or filters.get('news_analysis', False):
            return True
        
        # Premium fundamental data with real-time requirements
        if (filters.get('analysis_type') == 'fundamental' and 
            filters.get('include_earnings', False) and 
            filters.get('real_time', False)):
            return True
        
        # High-frequency or detailed analysis
        if filters.get('analysis_depth') in ['detailed', 'comprehensive', 'premium']:
            return True
        
        return False
    
    def get_activation_priority(self, filters: Dict[str, Any]) -> int:
        """
        Get activation priority for Alpha Vantage MCP collector.
        
        Returns:
            Priority score (0-100, higher = more preferred)
        """
        if not self.should_activate(filters):
            return 0
        
        priority = 70  # Base priority for commercial MCP
        
        # Higher priority for MCP-specific needs
        if self.supports_mcp_protocol:
            priority += 20
        
        # Real-time data gets highest priority
        if filters.get('real_time', False):
            priority += 10
        
        # Technical analysis strongly favors Alpha Vantage
        if filters.get('analysis_type') == 'technical':
            priority += 15
        
        # Premium data requests
        if filters.get('include_sentiment', False):
            priority += 8
        
        # Multiple asset classes (stocks + forex + crypto)
        asset_classes = sum([
            bool(filters.get('companies')),
            bool(filters.get('forex_pairs')),
            bool(filters.get('crypto_symbols'))
        ])
        if asset_classes >= 2:
            priority += 5
        
        return min(priority, 100)  # Cap at 100
    
    # Required abstract method implementations from DataCollectorInterface
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "Alpha Vantage MCP"
    
    @property
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            'stocks', 'forex', 'crypto', 'fundamentals', 'technical_indicators',
            'economic_indicators', 'news_sentiment', 'real_time'
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """Return True if this collector requires an API key."""
        return True
    
    def authenticate(self) -> bool:
        """Authenticate with Alpha Vantage API using MCP connection."""
        try:
            # Test API key through MCP connection
            import asyncio
            return asyncio.run(self._authenticate_async())

        except Exception as e:
            logger.error(f"Alpha Vantage authentication error: {e}")
            return False

    async def _authenticate_async(self) -> bool:
        """Async authentication with Alpha Vantage MCP server."""
        try:
            # Try to establish MCP connection as authentication test
            connection_successful = await self.establish_connection_async()

            if connection_successful:
                # Perform a lightweight test call
                test_call = {
                    'tool_name': 'GLOBAL_QUOTE',
                    'arguments': {
                        'symbol': 'AAPL',
                        'apikey': self.alpha_vantage_api_key
                    }
                }

                result = await self._execute_mcp_tools_async([test_call])

                if result and len(result) > 0 and result[0].get('success'):
                    self._authenticated = True
                    logger.info("Alpha Vantage MCP authentication successful")
                    return True
                else:
                    error_msg = result[0].get('error', 'Unknown error') if result else 'No response'
                    logger.error(f"Alpha Vantage authentication failed: {error_msg}")
                    return False
            else:
                logger.error("Alpha Vantage authentication failed: Unable to establish MCP connection")
                return False

        except Exception as e:
            logger.error(f"Alpha Vantage async authentication error: {e}")
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the MCP connection to Alpha Vantage server."""
        try:
            import asyncio
            return asyncio.run(self._test_connection_async())

        except Exception as e:
            return {
                'status': 'error',
                'error_message': str(e),
                'test_timestamp': datetime.now().isoformat(),
                'connection_type': 'mcp'
            }

    async def _test_connection_async(self) -> Dict[str, Any]:
        """Async test of MCP connection to Alpha Vantage."""
        start_time = datetime.now()

        try:
            # Test MCP connection establishment
            connection_successful = await self.establish_connection_async()

            if not connection_successful:
                return {
                    'status': 'failed',
                    'error_message': 'Unable to establish MCP connection',
                    'response_time': (datetime.now() - start_time).total_seconds(),
                    'test_timestamp': datetime.now().isoformat(),
                    'connection_type': 'mcp'
                }

            # Perform health check
            health_check = await self.mcp_client.health_check()
            response_time = (datetime.now() - start_time).total_seconds()

            if health_check.get('healthy', False):
                # Get connection statistics
                stats = self.mcp_client.get_connection_stats()

                return {
                    'status': 'connected',
                    'response_time': response_time,
                    'api_status': 'active',
                    'subscription_tier': self._subscription_tier.value,
                    'monthly_quota': self.monthly_quota_limit,
                    'mcp_server': self.server_info.name if self.server_info else None,
                    'available_tools': len(self.available_tools),
                    'connection_stats': stats,
                    'health_check': health_check,
                    'test_timestamp': datetime.now().isoformat(),
                    'connection_type': 'mcp'
                }
            else:
                return {
                    'status': 'unhealthy',
                    'error_message': health_check.get('error', 'Health check failed'),
                    'response_time': response_time,
                    'health_check': health_check,
                    'test_timestamp': datetime.now().isoformat(),
                    'connection_type': 'mcp'
                }

        except Exception as e:
            response_time = (datetime.now() - start_time).total_seconds()
            return {
                'status': 'error',
                'error_message': str(e),
                'response_time': response_time,
                'test_timestamp': datetime.now().isoformat(),
                'connection_type': 'mcp'
            }
    
    def collect_batch(
        self,
        symbols: List[str],
        date_range,
        frequency="daily",
        data_type: str = "prices"
    ):
        """Collect historical data for multiple symbols using Alpha Vantage MCP tools."""
        import pandas as pd

        try:
            # Use async collection with real MCP tools
            return asyncio.run(self._collect_batch_async(symbols, date_range, frequency, data_type))
        except Exception as e:
            logger.error(f"Batch collection failed: {e}")
            return pd.DataFrame()

    async def _collect_batch_async(self, symbols: List[str], date_range, frequency: str, data_type: str) -> 'pd.DataFrame':
        """Async batch collection using real MCP tools."""
        import pandas as pd

        if not await self._ensure_healthy_connection():
            logger.error("Cannot perform batch collection without healthy MCP connection")
            return pd.DataFrame()

        results = []

        # Prepare tool calls for all symbols
        tool_calls = []
        for symbol in symbols:
            if data_type == "prices":
                tool_name = 'TIME_SERIES_DAILY' if frequency == 'daily' else 'TIME_SERIES_INTRADAY'
                params = {
                    'symbol': symbol,
                    'apikey': self.alpha_vantage_api_key,
                    'outputsize': 'full'
                }
                if frequency != 'daily':
                    params['interval'] = frequency

                tool_calls.append({
                    'tool_name': tool_name,
                    'arguments': params
                })

        # Execute all tool calls
        mcp_results = await self._execute_tools_with_retry(tool_calls)

        # Process results
        for i, result in enumerate(mcp_results):
            if result.get('success') and i < len(symbols):
                symbol = symbols[i]
                tool_data = result.get('result', {})

                # Extract time series data based on tool type
                time_series_key = None
                if 'Time Series (Daily)' in tool_data:
                    time_series_key = 'Time Series (Daily)'
                elif 'Time Series (5min)' in tool_data:
                    time_series_key = 'Time Series (5min)'
                elif 'Time Series (1min)' in tool_data:
                    time_series_key = 'Time Series (1min)'

                if time_series_key and time_series_key in tool_data:
                    for date_str, values in tool_data[time_series_key].items():
                        try:
                            results.append({
                                'symbol': symbol,
                                'date': pd.to_datetime(date_str).date(),
                                'open': float(values.get('1. open', 0)),
                                'high': float(values.get('2. high', 0)),
                                'low': float(values.get('3. low', 0)),
                                'close': float(values.get('4. close', 0)),
                                'volume': int(values.get('5. volume', 0))
                            })
                        except (ValueError, KeyError) as e:
                            logger.warning(f"Error parsing data for {symbol} on {date_str}: {e}")
            else:
                error_msg = result.get('error', 'Unknown error')
                logger.error(f"Failed to collect data for {symbols[i] if i < len(symbols) else 'unknown'}: {error_msg}")

        if results:
            df = pd.DataFrame(results)
            df.set_index(['symbol', 'date'], inplace=True)
            return df
        else:
            return pd.DataFrame()
    
    def collect_realtime(self, symbols: List[str], data_type: str = "prices"):
        """Collect real-time data for symbols using Alpha Vantage MCP tools."""
        try:
            # Use async collection with real MCP tools
            return asyncio.run(self._collect_realtime_async(symbols, data_type))
        except Exception as e:
            logger.error(f"Real-time collection failed: {e}")
            return []

    async def _collect_realtime_async(self, symbols: List[str], data_type: str) -> List[Dict[str, Any]]:
        """Async real-time collection using real MCP tools."""
        if not await self._ensure_healthy_connection():
            logger.error("Cannot perform real-time collection without healthy MCP connection")
            return []

        results = []

        # Prepare tool calls for all symbols
        tool_calls = []
        for symbol in symbols:
            if data_type == "prices":
                tool_calls.append({
                    'tool_name': 'GLOBAL_QUOTE',
                    'arguments': {
                        'symbol': symbol,
                        'apikey': self.alpha_vantage_api_key
                    }
                })

        # Execute all tool calls
        mcp_results = await self._execute_tools_with_retry(tool_calls)

        # Process results
        for i, result in enumerate(mcp_results):
            if result.get('success') and i < len(symbols):
                symbol = symbols[i]
                tool_data = result.get('result', {})

                if 'Global Quote' in tool_data:
                    quote = tool_data['Global Quote']
                    try:
                        results.append({
                            'symbol': symbol,
                            'timestamp': datetime.now(),
                            'price': float(quote.get('05. price', 0)),
                            'change': float(quote.get('09. change', 0)),
                            'change_percent': quote.get('10. change percent', '0%'),
                            'volume': int(quote.get('06. volume', 0)),
                            'open': float(quote.get('02. open', 0)),
                            'high': float(quote.get('03. high', 0)),
                            'low': float(quote.get('04. low', 0)),
                            'previous_close': float(quote.get('08. previous close', 0)),
                            'data_type': 'quote'
                        })
                    except (ValueError, KeyError) as e:
                        logger.warning(f"Error parsing real-time data for {symbol}: {e}")
            else:
                error_msg = result.get('error', 'Unknown error')
                logger.error(f"Failed to collect real-time data for {symbols[i] if i < len(symbols) else 'unknown'}: {error_msg}")

        return results
    
    def get_available_symbols(self, exchange: Optional[str] = None, sector: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of available symbols from Alpha Vantage."""
        # For now, return a sample of popular symbols
        # In production, this would use Alpha Vantage's symbol search
        sample_symbols = [
            {'symbol': 'AAPL', 'name': 'Apple Inc.', 'exchange': 'NASDAQ', 'sector': 'Technology'},
            {'symbol': 'MSFT', 'name': 'Microsoft Corporation', 'exchange': 'NASDAQ', 'sector': 'Technology'},
            {'symbol': 'GOOGL', 'name': 'Alphabet Inc.', 'exchange': 'NASDAQ', 'sector': 'Technology'},
            {'symbol': 'AMZN', 'name': 'Amazon.com Inc.', 'exchange': 'NASDAQ', 'sector': 'Consumer Services'},
            {'symbol': 'TSLA', 'name': 'Tesla Inc.', 'exchange': 'NASDAQ', 'sector': 'Consumer Goods'},
            {'symbol': 'SPY', 'name': 'SPDR S&P 500 ETF', 'exchange': 'NYSE', 'sector': 'ETF'},
            {'symbol': 'QQQ', 'name': 'Invesco QQQ Trust', 'exchange': 'NASDAQ', 'sector': 'ETF'},
            {'symbol': 'VTI', 'name': 'Vanguard Total Stock Market ETF', 'exchange': 'NYSE', 'sector': 'ETF'}
        ]
        
        # Apply filters if provided
        filtered_symbols = sample_symbols
        if exchange:
            filtered_symbols = [s for s in filtered_symbols if s['exchange'].upper() == exchange.upper()]
        if sector:
            filtered_symbols = [s for s in filtered_symbols if s['sector'].upper() == sector.upper()]
        
        return filtered_symbols
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get current rate limit information."""
        return {
            'requests_per_minute': 5,  # Alpha Vantage free tier
            'requests_per_day': None,
            'requests_per_month': self.monthly_quota_limit,
            'tier': self._subscription_tier.value,
            'cost_per_request': self.cost_per_request
        }
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """Validate if symbols are supported by Alpha Vantage."""
        # For now, assume all symbols are valid - could be enhanced with actual validation
        try:
            # Use MCP connection to validate symbols if available
            if self.connection_established:
                return asyncio.run(self._validate_symbols_async(symbols))
            else:
                # Fallback to assuming all symbols are valid
                logger.warning("Validating symbols without MCP connection - assuming all valid")
                return {symbol: True for symbol in symbols}
        except Exception as e:
            logger.error(f"Symbol validation failed: {e}")
            return {symbol: False for symbol in symbols}

    async def _validate_symbols_async(self, symbols: List[str]) -> Dict[str, bool]:
        """Async symbol validation using MCP search functionality."""
        validation_results = {}

        # Use SEARCH_ENDPOINT tool if available
        if 'SEARCH_ENDPOINT' in self.available_tools:
            for symbol in symbols:
                try:
                    search_result = await self.mcp_client.call_tool(
                        'SEARCH_ENDPOINT',
                        {
                            'keywords': symbol,
                            'apikey': self.alpha_vantage_api_key
                        }
                    )

                    # Check if symbol exists in search results
                    if 'bestMatches' in search_result:
                        matches = search_result['bestMatches']
                        found = any(
                            match.get('1. symbol', '').upper() == symbol.upper()
                            for match in matches
                        )
                        validation_results[symbol] = found
                    else:
                        validation_results[symbol] = False

                except Exception as e:
                    logger.warning(f"Failed to validate symbol {symbol}: {e}")
                    validation_results[symbol] = True  # Assume valid on error
        else:
            # Fallback: assume all symbols are valid
            validation_results = {symbol: True for symbol in symbols}

        return validation_results

    def __str__(self) -> str:
        """String representation of Alpha Vantage MCP collector."""
        connection_status = "connected" if self.connection_established else "disconnected"
        server_name = self.server_info.name if self.server_info else "unknown"
        tool_count = len(self.available_tools) if self.available_tools else 0

        return (f"AlphaVantageMCPCollector(tier={self._subscription_tier.value}, "
                f"quota={self.monthly_quota_limit}, "
                f"server={server_name}, "
                f"tools={tool_count}, "
                f"status={connection_status})")


# Convenience function for testing
async def test_alpha_vantage_mcp_collector():
    """Test function for Alpha Vantage MCP collector with real integration."""
    collector = AlphaVantageMCPCollector()

    print("=== Alpha Vantage MCP Collector Test ===")
    print(f"Collector: {collector}")
    print(f"Supports MCP: {collector.supports_mcp_protocol}")
    print(f"Cost per request: ${collector.cost_per_request}")
    print(f"Monthly quota: {collector.monthly_quota_limit}")
    print(f"MCP Server URL: {collector.mcp_server_url}")

    # Test authentication
    print("\n--- Testing Authentication ---")
    try:
        auth_result = await collector._authenticate_async()
        print(f"Authentication successful: {auth_result}")
    except Exception as e:
        print(f"Authentication failed: {e}")

    # Test connection
    print("\n--- Testing Connection ---")
    try:
        connection_test = await collector._test_connection_async()
        print(f"Connection test result: {connection_test['status']}")
        if connection_test.get('health_check'):
            print(f"Health check: {connection_test['health_check']['healthy']}")
        if connection_test.get('available_tools'):
            print(f"Available tools: {connection_test['available_tools']}")
    except Exception as e:
        print(f"Connection test failed: {e}")

    # Test tool activation logic
    print("\n--- Testing Tool Activation ---")
    test_filters = {
        'companies': ['AAPL', 'MSFT'],
        'real_time': True,
        'analysis_type': 'technical'
    }

    should_activate = collector.should_activate(test_filters)
    priority = collector.get_activation_priority(test_filters)

    print(f"Should activate for real-time technical analysis: {should_activate}")
    print(f"Activation priority: {priority}")

    if should_activate:
        print("\n--- Testing Data Collection ---")
        try:
            # Test with real MCP integration
            data = await collector.collect_data(test_filters)

            print(f"Data collection status: {'Success' if not data.get('error') else 'Error'}")

            if data.get('error'):
                print(f"Error type: {data['error']['type']}")
                print(f"Error message: {data['error']['message']}")
            else:
                print(f"Data categories: {len(data.get('data', {}))}")
                print(f"Tools executed: {data.get('summary', {}).get('total_tools_executed', 0)}")
                print(f"Successful tools: {data.get('summary', {}).get('successful_tools', 0)}")
                print(f"Estimated cost: ${data.get('summary', {}).get('estimated_cost', 0):.2f}")

                if data.get('execution_metadata'):
                    metadata = data['execution_metadata']
                    print(f"Execution time: {metadata.get('execution_time_seconds', 0):.2f}s")
                    print(f"Server: {metadata.get('server_info', 'Unknown')}")

        except Exception as e:
            print(f"Data collection test failed: {e}")
            import traceback
            traceback.print_exc()

    # Cleanup
    print("\n--- Cleanup ---")
    try:
        await collector._cleanup_connection()
        print("Connection cleanup completed")
    except Exception as e:
        print(f"Cleanup error: {e}")

    print("\n=== Test Complete ===")


    # Helper methods for production-ready error handling

    def _validate_collection_filters(self, filters: Dict[str, Any]) -> None:
        """Validate collection filters before processing."""
        if not filters:
            raise ValueError("Filters cannot be empty")

        # Validate required fields based on request type
        if filters.get('real_time') and not filters.get('companies'):
            raise ValueError("Real-time requests require 'companies' field")

        # Validate symbol format
        if 'companies' in filters:
            companies = filters['companies']
            if isinstance(companies, str):
                companies = [companies]

            for symbol in companies:
                if not isinstance(symbol, str) or not symbol.strip():
                    raise ValueError(f"Invalid symbol format: {symbol}")
                if len(symbol) > 10:  # Reasonable symbol length limit
                    raise ValueError(f"Symbol too long: {symbol}")

    async def _ensure_healthy_connection(self) -> bool:
        """Ensure MCP connection is established and healthy."""
        if not self.connection_established:
            return await self.establish_connection_async()

        # Check connection health periodically
        is_healthy = await self._validate_connection_health()
        if not is_healthy:
            logger.info("Connection unhealthy, attempting to reconnect...")
            await self._cleanup_connection()
            return await self.establish_connection_async()

        return True

    async def _validate_tool_availability(self, tool_name: str) -> bool:
        """Validate that a tool is available before calling it."""
        if not self.mcp_client:
            return False

        return tool_name in self.available_tools

    async def _execute_tools_with_retry(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Execute tools with retry logic for handling transient failures."""
        max_retries = 2

        for attempt in range(max_retries + 1):
            try:
                return await self._execute_mcp_tools_async(tool_calls)

            except MCPConnectionError as e:
                if attempt < max_retries:
                    logger.warning(f"Connection error on attempt {attempt + 1}, retrying: {e}")
                    await asyncio.sleep(1.0 * (attempt + 1))  # Progressive backoff
                    # Try to reconnect
                    await self.establish_connection_async()
                else:
                    raise

            except MCPRateLimitError as e:
                if attempt < max_retries:
                    # Extract retry-after information if available
                    wait_time = 60  # Default to 1 minute
                    logger.warning(f"Rate limit hit on attempt {attempt + 1}, waiting {wait_time}s")
                    await asyncio.sleep(wait_time)
                else:
                    raise

    def _create_empty_response(self, filters: Dict[str, Any], reason: str) -> Dict[str, Any]:
        """Create empty response structure."""
        return {
            'source': 'Alpha Vantage MCP',
            'timestamp': datetime.now().isoformat(),
            'request_filters': filters,
            'tools_used': 0,
            'data': {},
            'summary': {
                'total_tools_executed': 0,
                'successful_tools': 0,
                'failed_tools': 0,
                'data_categories': [],
                'estimated_cost': 0.0,
                'reason': reason
            }
        }

    def _create_error_response(self, filters: Dict[str, Any], error_type: str, error_message: str) -> Dict[str, Any]:
        """Create error response structure."""
        return {
            'source': 'Alpha Vantage MCP',
            'timestamp': datetime.now().isoformat(),
            'request_filters': filters,
            'tools_used': 0,
            'data': {},
            'error': {
                'type': error_type,
                'message': error_message,
                'timestamp': datetime.now().isoformat()
            },
            'summary': {
                'total_tools_executed': 0,
                'successful_tools': 0,
                'failed_tools': 0,
                'data_categories': [],
                'estimated_cost': 0.0,
                'error_occurred': True
            }
        }


if __name__ == "__main__":
    # Run test
    asyncio.run(test_alpha_vantage_mcp_collector())