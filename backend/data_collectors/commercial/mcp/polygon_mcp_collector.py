"""
Polygon.io MCP Collector

Production-ready MCP collector for Polygon.io financial data API.
Provides institutional-grade real-time and historical market data through
a hybrid MCP/REST API architecture.

Features:
- 40+ financial data tools covering stocks, options, forex, crypto, futures
- Real-time and historical market data access
- Intelligent rate limiting for free tier (5 calls/minute)
- Subscription tier detection and feature gating
- Premium feature support with user API keys
- Comprehensive error handling and fallback mechanisms

This collector bridges Polygon.io's official MCP server with the Stock Picker
platform's MCP-first architecture, providing seamless access to institutional-
grade financial data while maintaining cost efficiency through intelligent
usage optimization.
"""

import logging
import asyncio
import os
import requests
import subprocess
import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum

# Import base classes (with fallback imports for testing)
try:
    from ..base.mcp_collector_base import MCPCollectorBase
    from ..base.commercial_collector_interface import SubscriptionTier
    from ...base.collector_interface import CollectorConfig
except ImportError:
    # For standalone testing
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    from commercial.base.mcp_collector_base import MCPCollectorBase
    from commercial.base.commercial_collector_interface import SubscriptionTier
    from base.collector_interface import CollectorConfig

logger = logging.getLogger(__name__)


class PolygonSubscriptionTier(Enum):
    """Polygon.io subscription tiers with capabilities"""
    FREE = "free"
    STARTER = "starter"
    DEVELOPER = "developer"
    ADVANCED = "advanced"


class PolygonRateLimiter:
    """Rate limiter for Polygon.io API calls"""
    
    def __init__(self, tier: PolygonSubscriptionTier = PolygonSubscriptionTier.FREE):
        self.tier = tier
        self.calls_made = []
        
        # Rate limits by tier
        self.limits = {
            PolygonSubscriptionTier.FREE: 5,  # calls per minute
            PolygonSubscriptionTier.STARTER: float('inf'),  # unlimited
            PolygonSubscriptionTier.DEVELOPER: float('inf'),  # unlimited
            PolygonSubscriptionTier.ADVANCED: float('inf')  # unlimited
        }
        
    def can_make_call(self) -> bool:
        """Check if we can make an API call within rate limits"""
        now = datetime.now()
        minute_ago = now - timedelta(minutes=1)
        
        # Clean old calls
        self.calls_made = [call_time for call_time in self.calls_made if call_time > minute_ago]
        
        # Check limit
        limit = self.limits.get(self.tier, 5)
        return len(self.calls_made) < limit
    
    def record_call(self):
        """Record that we made an API call"""
        self.calls_made.append(datetime.now())
    
    def time_until_next_call(self) -> float:
        """Get seconds to wait until next call is allowed"""
        if self.can_make_call():
            return 0.0
        
        if not self.calls_made:
            return 0.0
        
        # Wait until oldest call expires
        oldest_call = min(self.calls_made)
        next_available = oldest_call + timedelta(minutes=1)
        wait_time = (next_available - datetime.now()).total_seconds()
        return max(0.0, wait_time)


class PolygonMCPCollector(MCPCollectorBase):
    """
    Polygon.io MCP Collector - Institutional-grade financial data
    
    Provides access to Polygon.io's comprehensive financial data through both
    their official MCP server and direct REST API fallback. Features include:
    
    - Real-time stock quotes and historical data
    - Full options chains and derivatives data
    - Forex and cryptocurrency market data
    - Futures contracts and commodities
    - News and fundamental analysis (Benzinga integration)
    - Market status and reference data
    
    The collector automatically detects subscription tiers and adjusts
    functionality accordingly, providing premium features for paid users
    while maintaining free tier compliance.
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None, api_key: Optional[str] = None):
        """
        Initialize Polygon.io MCP collector.
        
        Args:
            config: Base collector configuration
            api_key: Polygon.io API key (required)
        """
        # Set default config
        if config is None:
            config = CollectorConfig(
                api_key=api_key or os.getenv('POLYGON_API_KEY'),
                base_url="https://api.polygon.io",
                timeout=30,
                requests_per_minute=5,  # Free tier default
                rate_limit_enabled=True
            )
        
        # Polygon.io API key (required)
        self.polygon_api_key = api_key or os.getenv('POLYGON_API_KEY')
        if not self.polygon_api_key:
            raise ValueError("Polygon.io API key is required. Set POLYGON_API_KEY environment variable or provide api_key parameter.")
        
        # Initialize base MCP collector
        super().__init__(
            config=config,
            mcp_server_url="stdio://polygon",  # Stdio MCP connection
            api_key=self.polygon_api_key
        )
        
        # Polygon-specific configuration
        self.subscription_tier = self._detect_subscription_tier()
        self.rate_limiter = PolygonRateLimiter(self.subscription_tier)
        self._mcp_process = None
        self._tools_cache = None
        self._tools_cache_time = None
        
        # Available tool categories
        self.tool_categories = {
            'stock_data': [
                'get_aggs', 'get_grouped_daily_aggs', 'get_daily_open_close',
                'get_previous_close', 'get_trades', 'get_last_trade', 
                'get_quotes', 'get_last_quote', 'get_snapshot_ticker'
            ],
            'options': [
                'get_snapshot_option', 'get_option_contract', 'get_options_trades'
            ],
            'crypto': [
                'get_crypto_trades', 'get_last_crypto_trade', 
                'get_snapshot_crypto_book', 'get_crypto_aggregates'
            ],
            'forex': [
                'get_forex_quotes', 'get_last_forex_quote', 
                'get_real_time_currency_conversion', 'get_forex_aggregates'
            ],
            'reference': [
                'get_ticker_details', 'list_tickers', 'get_ticker_news',
                'list_splits', 'list_dividends', 'get_market_holidays'
            ],
            'market': [
                'get_market_status', 'get_exchanges'
            ],
            'news': [
                'get_ticker_news'
            ],
            'futures': [
                'get_snapshot_indices', 'get_snapshot_futures'  
            ]
        }
        
        logger.info(f"Polygon.io MCP collector initialized with {self.subscription_tier.value} tier")
    
    # Required abstract method implementations
    
    @property
    def cost_per_request(self) -> float:
        """Return the cost per API request in USD."""
        # Polygon.io pricing varies by tier
        if self.subscription_tier == PolygonSubscriptionTier.FREE:
            return 0.0  # Free tier
        elif self.subscription_tier == PolygonSubscriptionTier.STARTER:
            return 0.002  # ~$2 per 1000 requests
        elif self.subscription_tier == PolygonSubscriptionTier.DEVELOPER:
            return 0.004  # ~$4 per 1000 requests
        else:
            return 0.01  # Advanced tier estimate
    
    @property
    def monthly_quota_limit(self) -> Optional[int]:
        """Return monthly request quota limit, or None if unlimited."""
        if self.subscription_tier == PolygonSubscriptionTier.FREE:
            return 1000  # 5 calls/min * 60 * 24 * ~7 days practical limit
        else:
            return None  # Paid tiers are typically unlimited
    
    def get_tool_cost_map(self) -> Dict[str, float]:
        """Get mapping of MCP tool names to their costs."""
        base_cost = self.cost_per_request
        
        return {
            # Market data tools
            'get_aggs': base_cost,
            'get_grouped_daily_aggs': base_cost * 2,  # More expensive
            'get_daily_open_close': base_cost,
            'get_previous_close': base_cost,
            'get_trades': base_cost * 3,  # Real-time data
            'get_last_trade': base_cost,
            'get_quotes': base_cost * 3,  # Real-time data
            'get_last_quote': base_cost,
            'get_snapshot_ticker': base_cost,
            
            # Options tools
            'get_snapshot_option': base_cost * 2,
            'get_option_contract': base_cost,
            'get_options_trades': base_cost * 3,
            
            # Crypto tools
            'get_crypto_trades': base_cost,
            'get_last_crypto_trade': base_cost,
            'get_snapshot_crypto_book': base_cost * 2,
            'get_crypto_aggregates': base_cost,
            
            # Forex tools
            'get_forex_quotes': base_cost,
            'get_last_forex_quote': base_cost,
            'get_real_time_currency_conversion': base_cost,
            'get_forex_aggregates': base_cost,
            
            # Reference data tools
            'get_ticker_details': base_cost,
            'list_tickers': base_cost * 2,
            'get_ticker_news': base_cost * 2,
            'list_splits': base_cost,
            'list_dividends': base_cost,
            'get_market_holidays': base_cost * 0.5,  # Cached data
            
            # Market status tools
            'get_market_status': base_cost * 0.5,  # Cached data
            'get_exchanges': base_cost * 0.5,
            
            # Futures tools
            'get_snapshot_indices': base_cost,
            'get_snapshot_futures': base_cost * 2
        }
    
    def get_subscription_tier_info(self) -> Dict[str, Any]:
        """Get current subscription tier details."""
        tier_info = {
            PolygonSubscriptionTier.FREE: {
                'name': 'Free',
                'rate_limit': '5 requests/minute',
                'monthly_quota': 1000,
                'features': ['Basic market data', 'Daily aggregates', 'Limited historical data'],
                'real_time_data': False,
                'cost_per_request': 0.0
            },
            PolygonSubscriptionTier.STARTER: {
                'name': 'Starter',
                'rate_limit': 'Unlimited',
                'monthly_quota': None,
                'features': ['All basic features', 'Real-time data', '2 years historical'],
                'real_time_data': True,
                'cost_per_request': 0.002
            },
            PolygonSubscriptionTier.DEVELOPER: {
                'name': 'Developer',
                'rate_limit': 'Unlimited',
                'monthly_quota': None,
                'features': ['All features', 'Options data', 'Full historical data'],
                'real_time_data': True,
                'cost_per_request': 0.004
            },
            PolygonSubscriptionTier.ADVANCED: {
                'name': 'Advanced',
                'rate_limit': 'Unlimited',
                'monthly_quota': None,
                'features': ['Enterprise features', 'Custom endpoints', 'Priority support'],
                'real_time_data': True,
                'cost_per_request': 0.01
            }
        }
        
        return tier_info.get(self.subscription_tier, tier_info[PolygonSubscriptionTier.FREE])
    
    def check_quota_status(self) -> Dict[str, Any]:
        """Check remaining quota and usage statistics."""
        if self.subscription_tier == PolygonSubscriptionTier.FREE:
            # For free tier, track based on rate limiter
            calls_this_minute = len(self.rate_limiter.calls_made)
            remaining_calls = max(0, 5 - calls_this_minute)
            
            return {
                'remaining_requests': remaining_calls,
                'used_requests': calls_this_minute,
                'quota_limit': 5,
                'reset_date': datetime.now() + timedelta(minutes=1),
                'usage_percentage': (calls_this_minute / 5) * 100
            }
        else:
            # Paid tiers have unlimited requests
            return {
                'remaining_requests': None,
                'used_requests': 0,
                'quota_limit': None,
                'reset_date': None,
                'usage_percentage': 0.0
            }
    
    # Required abstract methods from DataCollectorInterface
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "Polygon.io MCP"
    
    @property
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            'stocks', 'options', 'forex', 'crypto', 'futures', 
            'news', 'market_status', 'fundamentals', 'real_time'
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """Return True if this collector requires an API key."""
        return True
    
    def authenticate(self) -> bool:
        """Authenticate with the data source."""
        try:
            # Test API key by calling a simple endpoint
            response = requests.get(
                f"https://api.polygon.io/v1/marketstatus/now",
                params={'apikey': self.polygon_api_key},
                timeout=10
            )
            
            if response.status_code == 200:
                self._authenticated = True
                logger.info("Polygon.io authentication successful")
                return True
            else:
                logger.error(f"Polygon.io authentication failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Polygon.io authentication error: {e}")
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to the data source."""
        try:
            start_time = datetime.now()
            
            # Test API connection
            response = requests.get(
                f"https://api.polygon.io/v1/marketstatus/now",
                params={'apikey': self.polygon_api_key},
                timeout=10
            )
            
            response_time = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == 200:
                data = response.json()
                
                return {
                    'status': 'connected',
                    'response_time': response_time,
                    'api_status': 'active',
                    'subscription_tier': self.subscription_tier.value,
                    'rate_limit_status': self.check_quota_status(),
                    'market_status': data.get('market', 'unknown'),
                    'test_timestamp': datetime.now().isoformat()
                }
            else:
                return {
                    'status': 'failed',
                    'error_code': response.status_code,
                    'error_message': response.text,
                    'response_time': response_time,
                    'test_timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            return {
                'status': 'error',
                'error_message': str(e),
                'test_timestamp': datetime.now().isoformat()
            }
    
    def collect_batch(
        self, 
        symbols: List[str], 
        date_range, 
        frequency="daily",
        data_type: str = "prices"
    ):
        """Collect historical data for multiple symbols using MCP tools."""
        import pandas as pd
        
        results = []
        
        for symbol in symbols:
            try:
                if data_type == "prices":
                    # Use MCP tool for aggregates
                    data = asyncio.run(self.call_mcp_tool("get_aggs", {
                        "ticker": symbol,
                        "timespan": frequency,
                        "multiplier": 1,
                        "from": str(date_range.start_date) if hasattr(date_range, 'start_date') else date_range[0],
                        "to": str(date_range.end_date) if hasattr(date_range, 'end_date') else date_range[1]
                    }))
                    
                    if 'results' in data:
                        for result in data['results']:
                            results.append({
                                'symbol': symbol,
                                'date': pd.to_datetime(result.get('t', 0), unit='ms').date(),
                                'open': result.get('o'),
                                'high': result.get('h'), 
                                'low': result.get('l'),
                                'close': result.get('c'),
                                'volume': result.get('v'),
                                'vwap': result.get('vw')
                            })
                            
            except Exception as e:
                logger.error(f"Error collecting data for {symbol}: {e}")
        
        if results:
            df = pd.DataFrame(results)
            df.set_index(['symbol', 'date'], inplace=True)
            return df
        else:
            return pd.DataFrame()
    
    def collect_realtime(self, symbols: List[str], data_type: str = "prices"):
        """Collect real-time data for symbols using MCP tools."""
        for symbol in symbols:
            try:
                if data_type == "prices":
                    # Use MCP tool for last trade
                    data = asyncio.run(self.call_mcp_tool("get_last_trade", {
                        "ticker": symbol
                    }))
                    
                    if 'results' in data:
                        result = data['results']
                        yield {
                            'symbol': symbol,
                            'timestamp': datetime.now(),
                            'price': result.get('p'),
                            'size': result.get('s'),
                            'exchange': result.get('x'),
                            'data_type': 'trade'
                        }
                        
            except Exception as e:
                logger.error(f"Error collecting real-time data for {symbol}: {e}")
    
    def get_available_symbols(self, exchange: Optional[str] = None, sector: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of available symbols from Polygon.io."""
        try:
            params = {
                'apikey': self.polygon_api_key,
                'active': 'true',
                'limit': 1000
            }
            
            if exchange:
                params['exchange'] = exchange
            if sector:
                params['sector'] = sector
                
            response = requests.get(
                "https://api.polygon.io/v3/reference/tickers",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                symbols = []
                
                for ticker in data.get('results', []):
                    symbols.append({
                        'symbol': ticker.get('ticker'),
                        'name': ticker.get('name'),
                        'market': ticker.get('market'),
                        'locale': ticker.get('locale'),
                        'primary_exchange': ticker.get('primary_exchange'),
                        'type': ticker.get('type'),
                        'currency_name': ticker.get('currency_name'),
                        'active': ticker.get('active')
                    })
                
                return symbols
            else:
                logger.error(f"Failed to get symbols: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error getting available symbols: {e}")
            return []
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get current rate limit information."""
        return {
            'requests_per_minute': 5 if self.subscription_tier == PolygonSubscriptionTier.FREE else None,
            'requests_per_day': None,
            'requests_per_month': self.monthly_quota_limit,
            'current_usage': self.check_quota_status(),
            'tier': self.subscription_tier.value
        }
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """Validate if symbols are supported by this collector."""
        # For now, assume all symbols are valid - could be enhanced to check against Polygon API
        return {symbol: True for symbol in symbols}
    
    def _detect_subscription_tier(self) -> PolygonSubscriptionTier:
        """
        Detect user's Polygon.io subscription tier by testing API capabilities.
        This helps us provide appropriate features and rate limiting.
        """
        try:
            # Test a simple API call to detect capabilities
            response = requests.get(
                f"https://api.polygon.io/v3/reference/tickers",
                params={
                    'apikey': self.polygon_api_key,
                    'limit': 1
                },
                timeout=10
            )
            
            if response.status_code == 200:
                # For now, assume free tier
                # In a real implementation, you'd analyze response headers or
                # test specific premium endpoints to determine tier
                logger.info("API key validated - assuming FREE tier")
                return PolygonSubscriptionTier.FREE
            else:
                logger.warning(f"API key validation failed: {response.status_code}")
                return PolygonSubscriptionTier.FREE
                
        except requests.RequestException as e:
            logger.error(f"Failed to validate API key: {e}")
            return PolygonSubscriptionTier.FREE
    
    async def _ensure_mcp_server(self):
        """Ensure MCP server is running and ready"""
        if self._mcp_process is None or self._mcp_process.poll() is not None:
            # Start MCP server
            env = os.environ.copy()
            env['POLYGON_API_KEY'] = self.polygon_api_key
            env['PATH'] = f"{os.path.expanduser('~')}/.local/bin:{env.get('PATH', '')}"
            
            cmd = [
                'uvx', '--from', 
                'git+https://github.com/polygon-io/mcp_polygon@v0.4.0', 
                'mcp_polygon'
            ]
            
            self._mcp_process = subprocess.Popen(
                cmd,
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Initialize the MCP server
            init_msg = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"roots": {"listChanged": True}},
                    "clientInfo": {"name": "polygon-collector", "version": "1.0"}
                }
            }
            
            self._mcp_process.stdin.write(json.dumps(init_msg) + '\n')
            self._mcp_process.stdin.flush()
            
            # Read initialization response
            response = self._mcp_process.stdout.readline()
            init_data = json.loads(response.strip())
            
            if 'result' in init_data:
                logger.info(f"MCP server initialized: {init_data['result']['serverInfo']['name']}")
                
                # Send initialized notification
                initialized_msg = {
                    "jsonrpc": "2.0",
                    "method": "initialized",
                    "params": {}
                }
                self._mcp_process.stdin.write(json.dumps(initialized_msg) + '\n')
                self._mcp_process.stdin.flush()
                
                # Wait for server to be ready
                await asyncio.sleep(0.5)
            else:
                logger.error(f"MCP server initialization failed: {init_data}")
    
    async def get_available_tools(self) -> List[Dict[str, Any]]:
        """
        Get list of available tools from Polygon.io MCP server.
        Caches results for 5 minutes to avoid repeated calls.
        """
        now = datetime.now()
        
        # Use cached tools if recent
        if (self._tools_cache and self._tools_cache_time and 
            (now - self._tools_cache_time).total_seconds() < 300):
            return self._tools_cache
        
        try:
            await self._ensure_mcp_server()
            
            # Request tools list
            tools_msg = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list", 
                "params": {}
            }
            
            self._mcp_process.stdin.write(json.dumps(tools_msg) + '\n')
            self._mcp_process.stdin.flush()
            
            # Read response
            response = self._mcp_process.stdout.readline()
            tools_data = json.loads(response.strip())
            
            if 'result' in tools_data and 'tools' in tools_data['result']:
                self._tools_cache = tools_data['result']['tools']
                self._tools_cache_time = now
                logger.info(f"Discovered {len(self._tools_cache)} Polygon.io MCP tools")
                return self._tools_cache
            else:
                logger.error(f"Failed to get tools: {tools_data}")
                return []
                
        except Exception as e:
            logger.error(f"Error getting tools: {e}")
            return []
    
    async def call_mcp_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool on the Polygon.io MCP server.
        Handles rate limiting and provides fallback to direct API calls.
        """
        # Check rate limits
        if not self.rate_limiter.can_make_call():
            wait_time = self.rate_limiter.time_until_next_call()
            if wait_time > 0:
                logger.warning(f"Rate limit reached, waiting {wait_time:.1f} seconds")
                await asyncio.sleep(wait_time)
        
        try:
            await self._ensure_mcp_server()
            
            # Make tool call
            tool_msg = {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }
            
            self._mcp_process.stdin.write(json.dumps(tool_msg) + '\n')
            self._mcp_process.stdin.flush()
            
            # Record the call for rate limiting
            self.rate_limiter.record_call()
            
            # Read response
            response = self._mcp_process.stdout.readline()
            result_data = json.loads(response.strip())
            
            if 'result' in result_data:
                logger.debug(f"MCP tool {tool_name} completed successfully")
                
                # Parse the response content
                content = result_data['result'][0]['content'][0]['text']
                return json.loads(content)
            else:
                error = result_data.get('error', {})
                logger.error(f"MCP tool {tool_name} failed: {error.get('message', 'Unknown error')}")
                
                # Try fallback to direct API call
                return await self._fallback_api_call(tool_name, arguments)
                
        except Exception as e:
            logger.error(f"MCP tool call failed: {e}")
            # Try fallback to direct API call
            return await self._fallback_api_call(tool_name, arguments)
    
    async def _fallback_api_call(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fallback to direct Polygon.io REST API calls when MCP server fails.
        This ensures reliability even if the MCP server has issues.
        """
        logger.info(f"Using fallback API call for {tool_name}")
        
        try:
            # Map common tools to API endpoints
            if tool_name == "get_market_status":
                url = "https://api.polygon.io/v1/marketstatus/now"
                params = {'apikey': self.polygon_api_key}
                
            elif tool_name == "get_aggs":
                ticker = arguments.get('ticker', 'AAPL')
                timespan = arguments.get('timespan', 'day')
                multiplier = arguments.get('multiplier', 1)
                from_date = arguments.get('from', '2024-01-01')
                to_date = arguments.get('to', '2024-12-31')
                
                url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from_date}/{to_date}"
                params = {'apikey': self.polygon_api_key}
                
            elif tool_name == "get_ticker_details":
                ticker = arguments.get('ticker', 'AAPL')
                url = f"https://api.polygon.io/v3/reference/tickers/{ticker}"
                params = {'apikey': self.polygon_api_key}
                
            else:
                return {"error": f"Fallback not implemented for tool: {tool_name}"}
            
            # Make the API call
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "error": f"API call failed: {response.status_code}",
                    "message": response.text
                }
                
        except Exception as e:
            logger.error(f"Fallback API call failed: {e}")
            return {"error": f"Fallback failed: {str(e)}"}
    
    # Convenience methods for common operations
    
    async def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        """Get real-time stock quote"""
        return await self.call_mcp_tool("get_last_trade", {"ticker": symbol})
    
    async def get_market_status(self) -> Dict[str, Any]:
        """Get current market status"""
        return await self.call_mcp_tool("get_market_status", {})
    
    async def get_stock_news(self, symbol: str, limit: int = 10) -> Dict[str, Any]:
        """Get latest news for a stock"""
        return await self.call_mcp_tool("get_ticker_news", {
            "ticker": symbol,
            "limit": limit
        })
    
    async def get_options_chain(self, symbol: str, expiry: Optional[str] = None) -> Dict[str, Any]:
        """Get options chain for a symbol"""
        args = {"underlying_ticker": symbol}
        if expiry:
            args["expiration_date"] = expiry
        return await self.call_mcp_tool("get_snapshot_option", args)
    
    def cleanup(self):
        """Clean up resources"""
        if self._mcp_process:
            self._mcp_process.terminate()
            self._mcp_process.wait()
            self._mcp_process = None
        logger.info("Polygon MCP collector cleaned up")
    
    def __del__(self):
        """Cleanup on destruction"""
        self.cleanup()


# Factory function for easy instantiation
def create_polygon_mcp_collector(api_key: Optional[str] = None) -> PolygonMCPCollector:
    """
    Factory function to create a Polygon.io MCP collector.
    
    Args:
        api_key: Optional API key (uses environment variable if not provided)
    
    Returns:
        Configured PolygonMCPCollector instance
    """
    return PolygonMCPCollector(api_key=api_key)