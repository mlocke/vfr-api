"""
Alpha Vantage Direct MCP Collector

A simplified collector that directly calls Alpha Vantage MCP server
without relying on standard MCP protocol methods.

This implementation works with Alpha Vantage's custom MCP server that
doesn't follow the standard MCP protocol specification.
"""

import logging
import asyncio
import aiohttp
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import sys
from pathlib import Path

# Add path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

# Import required base classes
try:
    from ...base.collector_interface import DataCollectorInterface, CollectorConfig
    from ..base.commercial_collector_interface import SubscriptionTier
except ImportError:
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    from base.collector_interface import DataCollectorInterface, CollectorConfig

    from enum import Enum
    class SubscriptionTier(Enum):
        FREE = "free"
        BASIC = "basic"
        PREMIUM = "premium"
        ENTERPRISE = "enterprise"

logger = logging.getLogger(__name__)


class AlphaVantageDirectCollector(DataCollectorInterface):
    """
    Direct Alpha Vantage MCP collector using HTTP calls.

    This collector bypasses the standard MCP client and makes direct
    HTTP calls to Alpha Vantage's MCP server endpoint.
    """

    def __init__(self, config: Optional[CollectorConfig] = None, api_key: Optional[str] = None):
        """Initialize Alpha Vantage Direct collector."""

        # Set default config if none provided
        if config is None:
            config = CollectorConfig(
                api_key=api_key or "4M20CQ7QT67RJ835",
                base_url="https://mcp.alphavantage.co/mcp",
                timeout=30,
                requests_per_minute=5,
                rate_limit_enabled=True
            )

        # Initialize base data collector
        super().__init__(config)

        # Alpha Vantage specific configuration
        self.alpha_vantage_api_key = api_key or "4M20CQ7QT67RJ835"
        self.mcp_server_url = f"https://mcp.alphavantage.co/mcp?apikey={self.alpha_vantage_api_key}"
        self.server_url = self.mcp_server_url  # Alias for consistency

        # Connection attributes
        self.session: Optional[aiohttp.ClientSession] = None
        self.connection_established = False
        self._subscription_tier = SubscriptionTier.PREMIUM

        # Known Alpha Vantage tools
        self.available_tools = [
            'TIME_SERIES_INTRADAY', 'TIME_SERIES_DAILY', 'TIME_SERIES_WEEKLY',
            'TIME_SERIES_MONTHLY', 'GLOBAL_QUOTE', 'SYMBOL_SEARCH',
            'RSI', 'MACD', 'SMA', 'EMA', 'BBANDS', 'STOCH', 'ADX',
            'OVERVIEW', 'EARNINGS', 'INCOME_STATEMENT', 'BALANCE_SHEET',
            'NEWS_SENTIMENT', 'TOP_GAINERS_LOSERS',
            'FX_INTRADAY', 'FX_DAILY', 'CURRENCY_EXCHANGE_RATE',
            'CRYPTO_INTRADAY', 'DIGITAL_CURRENCY_DAILY'
        ]

        logger.info(f"Initialized Alpha Vantage Direct Collector with {len(self.available_tools)} tools")

    @property
    def source_name(self) -> str:
        return "Alpha Vantage Direct MCP"

    @property
    def supported_data_types(self) -> List[str]:
        return ['stocks', 'forex', 'crypto', 'fundamentals', 'technical_indicators', 'real_time']

    @property
    def requires_api_key(self) -> bool:
        return True

    @property
    def supports_mcp_protocol(self) -> bool:
        return True

    @property
    def cost_per_request(self) -> float:
        return 0.01

    @property
    def monthly_quota_limit(self) -> Optional[int]:
        return 25000

    async def establish_connection_async(self) -> bool:
        """Establish HTTP session for Alpha Vantage calls."""
        try:
            if self.session:
                await self.session.close()

            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'StockPicker-AlphaVantage-Direct/1.0',
                'Accept': 'application/json'
            }

            timeout_config = aiohttp.ClientTimeout(total=30)

            self.session = aiohttp.ClientSession(
                headers=headers,
                timeout=timeout_config,
                raise_for_status=False
            )

            # Test connection with a simple call
            test_result = await self._test_connection()
            self.connection_established = test_result

            if test_result:
                logger.info("Successfully established Alpha Vantage Direct connection")
            else:
                logger.error("Failed to establish Alpha Vantage Direct connection")

            return test_result

        except Exception as e:
            logger.error(f"Failed to establish connection: {e}")
            return False

    async def _test_connection(self) -> bool:
        """Test connection with a simple GLOBAL_QUOTE call."""
        try:
            result = await self._call_alpha_vantage_tool('GLOBAL_QUOTE', {'symbol': 'AAPL'})
            return result is not None and ('Global Quote' in result or 'quote' in str(result).lower())
        except Exception as e:
            logger.debug(f"Connection test failed: {e}")
            return False

    async def _call_alpha_vantage_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make direct HTTP call to Alpha Vantage MCP server using tools/call method."""
        if not self.session:
            await self.establish_connection_async()

        # Prepare JSON-RPC 2.0 request using tools/call method
        request_payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": params
            }
        }

        logger.debug(f"Calling {tool_name} via tools/call with params: {list(params.keys())}")

        async with self.session.post(
            self.mcp_server_url,
            json=request_payload,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:

            if response.status >= 400:
                error_text = await response.text()
                raise Exception(f"HTTP {response.status}: {error_text}")

            result_data = await response.json()

            # Handle JSON-RPC errors
            if 'error' in result_data:
                error_info = result_data['error']
                error_code = error_info.get('code', 0)
                error_message = error_info.get('message', 'Unknown error')

                if error_code == 429:
                    raise Exception(f"Rate limit exceeded: {error_message}")
                else:
                    raise Exception(f"Tool error: {error_message}")

            # Alpha Vantage returns data in content array format
            result = result_data.get('result', {})
            content_data = result.get('content', [])

            if content_data and isinstance(content_data, list) and len(content_data) > 0:
                # Extract text content and parse based on format
                text_content = content_data[0].get('text', '')
                if text_content:
                    return self._parse_response_content(text_content, tool_name)

            # Fallback to raw result if no content found
            return result

    async def collect_data(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Collect data using Alpha Vantage Direct calls."""
        try:
            if not self.connection_established:
                await self.establish_connection_async()

            # Analyze filters to determine required tools
            required_tools = self._analyze_filters_for_tools(filters)

            if not required_tools:
                return self._create_empty_response(filters, "No applicable tools found")

            # Execute tools
            results = []
            for tool_info in required_tools:
                try:
                    result = await self._call_alpha_vantage_tool(
                        tool_info['tool'],
                        tool_info['params']
                    )

                    results.append({
                        'tool_name': tool_info['tool'],
                        'success': True,
                        'result': result,
                        'timestamp': datetime.now().isoformat()
                    })

                except Exception as e:
                    results.append({
                        'tool_name': tool_info['tool'],
                        'success': False,
                        'error': str(e),
                        'timestamp': datetime.now().isoformat()
                    })

            # Process results
            processed_data = self._process_results(results, filters)

            logger.info(f"Successfully collected data using {len(required_tools)} Alpha Vantage tools")
            return processed_data

        except Exception as e:
            logger.error(f"Data collection failed: {e}")
            return self._create_error_response(filters, "collection_error", str(e))

    def _analyze_filters_for_tools(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze filters to determine which tools to use."""
        required_tools = []

        symbols = filters.get('companies', [])
        if isinstance(symbols, str):
            symbols = [symbols]

        # Real-time quotes
        if filters.get('real_time', False) and symbols:
            for symbol in symbols:
                required_tools.append({
                    'tool': 'GLOBAL_QUOTE',
                    'params': {'symbol': symbol}
                })

        # Historical time series
        elif symbols and not filters.get('real_time', False):
            for symbol in symbols:
                time_period = filters.get('time_period', 'daily')
                if time_period == 'daily':
                    required_tools.append({
                        'tool': 'TIME_SERIES_DAILY',
                        'params': {
                            'symbol': symbol,
                            'outputsize': filters.get('output_size', 'compact')
                        }
                    })

        # Technical indicators
        if filters.get('analysis_type') == 'technical' and symbols:
            indicators = filters.get('technical_indicators', ['RSI'])
            for symbol in symbols:
                for indicator in indicators:
                    params = {
                        'symbol': symbol,
                        'interval': filters.get('interval', 'daily')
                    }

                    if indicator == 'RSI':
                        params['time_period'] = filters.get('rsi_period', 14)

                    required_tools.append({
                        'tool': indicator,
                        'params': params
                    })

        # Fundamental data
        if filters.get('analysis_type') == 'fundamental' and symbols:
            for symbol in symbols:
                required_tools.append({
                    'tool': 'OVERVIEW',
                    'params': {'symbol': symbol}
                })

        return required_tools

    def _process_results(self, results: List[Dict[str, Any]], filters: Dict[str, Any]) -> Dict[str, Any]:
        """Process and format results."""
        processed_data = {
            'source': 'Alpha Vantage Direct MCP',
            'timestamp': datetime.now().isoformat(),
            'request_filters': filters,
            'tools_used': len(results),
            'data': {}
        }

        # Organize results by category
        for result in results:
            if result['success']:
                tool_name = result['tool_name']
                tool_data = result['result']

                # Categorize data
                if tool_name in ['GLOBAL_QUOTE', 'TIME_SERIES_DAILY']:
                    if 'market_data' not in processed_data['data']:
                        processed_data['data']['market_data'] = {}
                    processed_data['data']['market_data'][tool_name] = tool_data

                elif tool_name in ['RSI', 'MACD', 'SMA', 'EMA']:
                    if 'technical_indicators' not in processed_data['data']:
                        processed_data['data']['technical_indicators'] = {}
                    processed_data['data']['technical_indicators'][tool_name] = tool_data

                elif tool_name in ['COMPANY_OVERVIEW', 'EARNINGS']:
                    if 'fundamental_data' not in processed_data['data']:
                        processed_data['data']['fundamental_data'] = {}
                    processed_data['data']['fundamental_data'][tool_name] = tool_data

        # Add summary
        processed_data['summary'] = {
            'total_tools_executed': len(results),
            'successful_tools': len([r for r in results if r['success']]),
            'failed_tools': len([r for r in results if not r['success']]),
            'data_categories': list(processed_data['data'].keys()),
            'estimated_cost': len([r for r in results if r['success']]) * self.cost_per_request
        }

        return processed_data

    def _parse_response_content(self, content: str, tool_name: str) -> Dict[str, Any]:
        """Parse response content based on tool type and format."""
        try:
            # Try JSON first
            if content.strip().startswith('{') or content.strip().startswith('['):
                return json.loads(content)

            # Parse CSV format (common for many Alpha Vantage tools)
            if ',' in content and ('\r\n' in content or '\n' in content):
                return self._parse_csv_response(content, tool_name)

            # Return as text if can't parse
            return {'raw_text': content}

        except Exception as e:
            logger.error(f"Error parsing response content for {tool_name}: {e}")
            return {'raw_text': content, 'parse_error': str(e)}

    def _parse_csv_response(self, csv_text: str, tool_name: str) -> Dict[str, Any]:
        """Parse CSV response from Alpha Vantage."""
        try:
            # Handle different line endings - use actual newline characters, not escaped strings
            lines = csv_text.strip().replace('\r\n', '\n').split('\n')
            if len(lines) < 2:
                return {'raw_text': csv_text}

            logger.debug(f"Parsing CSV for {tool_name}: {len(lines)} lines found")

            headers = [h.strip() for h in lines[0].split(',')]

            # Handle different tool response formats
            if tool_name == 'GLOBAL_QUOTE':
                # Single row response format: symbol,open,high,low,price,volume,latestDay,previousClose,change,changePercent
                if len(lines) >= 2 and lines[1].strip():
                    data_row = [d.strip() for d in lines[1].split(',')]
                    if len(headers) == len(data_row):
                        # Create Alpha Vantage standard format
                        quote_data = {
                            '01. symbol': data_row[0] if len(data_row) > 0 else '',
                            '02. open': data_row[1] if len(data_row) > 1 else '',
                            '03. high': data_row[2] if len(data_row) > 2 else '',
                            '04. low': data_row[3] if len(data_row) > 3 else '',
                            '05. price': data_row[4] if len(data_row) > 4 else '',
                            '06. volume': data_row[5] if len(data_row) > 5 else '',
                            '07. latest trading day': data_row[6] if len(data_row) > 6 else '',
                            '08. previous close': data_row[7] if len(data_row) > 7 else '',
                            '09. change': data_row[8] if len(data_row) > 8 else '',
                            '10. change percent': data_row[9] if len(data_row) > 9 else ''
                        }
                        return {'Global Quote': quote_data}

            elif tool_name in ['TIME_SERIES_DAILY', 'TIME_SERIES_INTRADAY']:
                # Multi-row time series data
                time_series = {}
                for line in lines[1:]:
                    if line.strip():
                        data_row = [d.strip() for d in line.split(',')]
                        if len(data_row) >= 5:  # Expect at least date + OHLC
                            date_key = data_row[0]
                            time_series[date_key] = {
                                '1. open': data_row[1] if len(data_row) > 1 else '',
                                '2. high': data_row[2] if len(data_row) > 2 else '',
                                '3. low': data_row[3] if len(data_row) > 3 else '',
                                '4. close': data_row[4] if len(data_row) > 4 else '',
                                '5. volume': data_row[5] if len(data_row) > 5 else ''
                            }

                series_key = f'Time Series ({tool_name.split("_")[2].title()})'
                return {series_key: time_series}

            elif tool_name == 'COMPANY_OVERVIEW':
                # Company overview data - typically key-value pairs or structured data
                overview_data = {}
                if len(lines) >= 2 and lines[1].strip():
                    data_values = [d.strip() for d in lines[1].split(',')]
                    # Map headers to values
                    for i, header in enumerate(headers):
                        if i < len(data_values):
                            overview_data[header] = data_values[i]
                return overview_data

            # Generic parsing for other tools
            parsed_data = []
            for line in lines[1:]:
                if line.strip():
                    data_row = [d.strip() for d in line.split(',')]
                    if len(headers) == len(data_row):
                        parsed_data.append(dict(zip(headers, data_row)))

            return {'data': parsed_data} if parsed_data else {'raw_text': csv_text}

        except Exception as e:
            logger.error(f"Error parsing CSV response for {tool_name}: {e}")
            return {'raw_text': csv_text, 'parse_error': str(e)}

    def _create_empty_response(self, filters: Dict[str, Any], reason: str) -> Dict[str, Any]:
        """Create empty response."""
        return {
            'source': 'Alpha Vantage Direct MCP',
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
        """Create error response."""
        return {
            'source': 'Alpha Vantage Direct MCP',
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

    def should_activate(self, filters: Dict[str, Any]) -> bool:
        """Determine if this collector should handle the request."""
        if filters.get('real_time', False):
            return True
        if filters.get('analysis_type') == 'technical':
            return True
        if filters.get('time_period') == 'intraday':
            return True
        return bool(filters.get('companies'))

    def get_activation_priority(self, filters: Dict[str, Any]) -> int:
        """Get activation priority."""
        if not self.should_activate(filters):
            return 0

        priority = 80  # High priority for direct connection

        if filters.get('real_time', False):
            priority += 10
        if filters.get('analysis_type') == 'technical':
            priority += 10

        return min(priority, 100)

    def authenticate(self) -> bool:
        """Test authentication."""
        try:
            return asyncio.run(self._test_connection())
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return False

    def test_connection(self) -> Dict[str, Any]:
        """Test connection."""
        try:
            success = asyncio.run(self._test_connection())
            return {
                'status': 'connected' if success else 'failed',
                'connection_type': 'direct_http',
                'test_timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'status': 'error',
                'error_message': str(e),
                'connection_type': 'direct_http',
                'test_timestamp': datetime.now().isoformat()
            }

    async def cleanup(self):
        """Cleanup resources."""
        if self.session:
            await self.session.close()
            self.session = None
        self.connection_established = False

    def collect_batch(self, symbols, date_range, frequency="daily", data_type="prices"):
        """Collect batch data synchronously."""
        try:
            return asyncio.run(self._collect_batch_async(symbols, date_range, frequency, data_type))
        except Exception as e:
            logger.error(f"Batch collection failed: {e}")
            return None

    async def _collect_batch_async(self, symbols, date_range, frequency, data_type):
        """Async batch collection."""
        filters = {
            'companies': symbols,
            'time_period': frequency
        }

        data = await self.collect_data(filters)

        if data.get('error'):
            return None

        # Convert to simple format for compatibility
        return data.get('data', {})

    def collect_realtime(self, symbols, data_type="prices"):
        """Collect real-time data synchronously."""
        try:
            return asyncio.run(self._collect_realtime_async(symbols, data_type))
        except Exception as e:
            logger.error(f"Real-time collection failed: {e}")
            return []

    async def _collect_realtime_async(self, symbols, data_type):
        """Async real-time collection."""
        filters = {
            'companies': symbols,
            'real_time': True
        }

        data = await self.collect_data(filters)

        if data.get('error'):
            return []

        # Convert to simple format
        results = []
        market_data = data.get('data', {}).get('market_data', {})

        if 'GLOBAL_QUOTE' in market_data:
            quote_data = market_data['GLOBAL_QUOTE']
            if 'Global Quote' in quote_data:
                quote = quote_data['Global Quote']
                results.append({
                    'symbol': quote.get('01. symbol', 'Unknown'),
                    'price': float(quote.get('05. price', 0)),
                    'timestamp': datetime.now(),
                    'data_type': 'quote'
                })

        return results

    def get_available_symbols(self, exchange=None, sector=None):
        """Get list of available symbols."""
        # Return sample symbols for compatibility
        symbols = [
            {'symbol': 'AAPL', 'name': 'Apple Inc.', 'exchange': 'NASDAQ'},
            {'symbol': 'MSFT', 'name': 'Microsoft Corporation', 'exchange': 'NASDAQ'},
            {'symbol': 'GOOGL', 'name': 'Alphabet Inc.', 'exchange': 'NASDAQ'},
            {'symbol': 'AMZN', 'name': 'Amazon.com Inc.', 'exchange': 'NASDAQ'},
            {'symbol': 'TSLA', 'name': 'Tesla Inc.', 'exchange': 'NASDAQ'},
        ]

        # Apply filters if provided
        if exchange:
            symbols = [s for s in symbols if s['exchange'].upper() == exchange.upper()]

        return symbols

    def get_rate_limits(self):
        """Get rate limit information."""
        return {
            'requests_per_minute': 5,
            'requests_per_day': None,
            'requests_per_month': self.monthly_quota_limit,
            'tier': 'premium',
            'cost_per_request': self.cost_per_request
        }

    def validate_symbols(self, symbols):
        """Validate symbols."""
        # For simplicity, assume all symbols are valid
        # In production, this could use SYMBOL_SEARCH tool
        return {symbol: True for symbol in symbols}

    def __str__(self) -> str:
        """String representation."""
        status = "connected" if self.connection_established else "disconnected"
        return f"AlphaVantageDirectCollector(tools={len(self.available_tools)}, status={status})"


# Test function
async def test_alpha_vantage_direct():
    """Test Alpha Vantage Direct collector."""
    collector = AlphaVantageDirectCollector()

    print(f"Testing {collector}")

    # Test connection
    conn_result = await collector.establish_connection_async()
    print(f"Connection established: {conn_result}")

    if conn_result:
        # Test data collection
        filters = {
            'companies': ['AAPL'],
            'real_time': True
        }

        data = await collector.collect_data(filters)
        print(f"Data collection result: {data.get('summary', {})}")

        # Cleanup
        await collector.cleanup()


if __name__ == "__main__":
    asyncio.run(test_alpha_vantage_direct())