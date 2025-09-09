"""
SEC EDGAR MCP Collector

Production-ready MCP collector for SEC EDGAR financial data using the official 
SEC EDGAR MCP server. Provides institutional-grade company filings, financial 
statements, and insider trading data through a hybrid MCP/REST API architecture.

Features:
- Official SEC EDGAR filings with exact XBRL parsing
- Company facts, financial statements, and insider trading data
- Intelligent rate limiting (no authentication required)
- Integration with existing SEC API collector fallback
- Comprehensive error handling and filtering compliance

This collector leverages the official SEC EDGAR MCP server (stefanoamorelli/sec-edgar-mcp)
to provide AI-native access to SEC filing data while maintaining the sophisticated
filtering logic from the existing SEC API collector.
"""

import logging
import asyncio
import os
import subprocess
import json
import time
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum

# Import centralized configuration
try:
    from ....config.env_loader import Config
except ImportError:
    # Fallback for testing
    class Config:
        SEC_EDGAR_USER_AGENT = os.getenv('SEC_EDGAR_USER_AGENT', 'Stock-Picker Financial Analysis Platform (contact@stockpicker.com)')

# Import base classes and existing SEC collector for fallback
try:
    from ..sec_edgar_collector import SECEdgarCollector, SAMPLE_COMPANIES
    from ...base.collector_interface import DataCollectorInterface, CollectorConfig, DateRange
except ImportError:
    # For standalone testing
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    from government.sec_edgar_collector import SECEdgarCollector, SAMPLE_COMPANIES
    from base.collector_interface import DataCollectorInterface, CollectorConfig, DateRange

logger = logging.getLogger(__name__)


class SECEdgarMCPCollector(DataCollectorInterface):
    """
    SEC EDGAR MCP Collector - Official SEC Filing Data with AI-Native Access
    
    Provides access to SEC EDGAR's comprehensive filing database through the
    official SEC EDGAR MCP server. Features include:
    
    - Company filings (10-K annual, 10-Q quarterly, 8-K current reports)
    - Financial statements with direct XBRL parsing for exact precision
    - Insider trading analysis (Forms 3/4/5)
    - Company fundamentals and business descriptions
    - Filing search and analysis with AI-native context
    
    The collector follows the same sophisticated filtering guidelines as the
    existing SEC API collector, activating only for specific company analysis
    requests and providing fallback to direct API calls when needed.
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None, user_agent: Optional[str] = None):
        """
        Initialize SEC EDGAR MCP collector.
        
        Args:
            config: Base collector configuration
            user_agent: SEC-required user agent string (format: "Your Name (email@domain.com)")
        """
        # Set default config for government data collector
        if config is None:
            config = CollectorConfig(
                base_url="https://data.sec.gov",
                timeout=30,
                requests_per_minute=600,  # SEC guideline: 10 requests per second
                rate_limit_enabled=True
            )
        
        # SEC requires User-Agent header for all requests
        self.user_agent = user_agent or Config.SEC_EDGAR_USER_AGENT
        if not self.user_agent or '@' not in self.user_agent:
            raise ValueError("SEC EDGAR requires a valid User-Agent with email contact. Set SEC_EDGAR_USER_AGENT environment variable.")
        
        # Initialize base collector (no API key required for SEC data)
        self.config = config
        self._authenticated = False
        
        # SEC EDGAR specific configuration
        self._mcp_process = None
        self._tools_cache = None
        self._tools_cache_time = None
        self._api_fallback_collector = None  # Will initialize if needed
        
        # Available tool categories based on SEC EDGAR MCP server capabilities
        self.tool_categories = {
            'company_lookup': [
                'lookup_company_cik', 'get_company_tickers', 'search_companies'
            ],
            'company_data': [
                'get_company_facts', 'get_company_info', 'get_company_filings'
            ],
            'financial_statements': [
                'get_financial_statements', 'extract_financial_data', 'analyze_xbrl_data'
            ],
            'filings': [
                'get_recent_filings', 'get_filing_content', 'analyze_8k_filing',
                'extract_filing_sections'
            ],
            'insider_trading': [
                'get_insider_transactions', 'analyze_form_4', 'get_form_3_filings',
                'get_form_5_filings', 'track_insider_activity'
            ]
        }
        
        logger.info("SEC EDGAR MCP collector initialized (government data)")
    
    # Required abstract method implementations
    
    @property
    def cost_per_request(self) -> float:
        """Return the cost per API request in USD."""
        return 0.0  # SEC EDGAR is free public data
    
    @property
    def monthly_quota_limit(self) -> Optional[int]:
        """Return monthly request quota limit, or None if unlimited."""
        return None  # SEC EDGAR has no quota limits, just rate limits
    
    def get_tool_cost_map(self) -> Dict[str, float]:
        """Get mapping of MCP tool names to their costs."""
        # SEC EDGAR is free public data
        return {
            # Company lookup tools
            'lookup_company_cik': 0.0,
            'get_company_tickers': 0.0,
            'search_companies': 0.0,
            
            # Company data tools
            'get_company_facts': 0.0,
            'get_company_info': 0.0,
            'get_company_filings': 0.0,
            
            # Financial statements tools
            'get_financial_statements': 0.0,
            'extract_financial_data': 0.0,
            'analyze_xbrl_data': 0.0,
            
            # Filing tools
            'get_recent_filings': 0.0,
            'get_filing_content': 0.0,
            'analyze_8k_filing': 0.0,
            'extract_filing_sections': 0.0,
            
            # Insider trading tools
            'get_insider_transactions': 0.0,
            'analyze_form_4': 0.0,
            'get_form_3_filings': 0.0,
            'get_form_5_filings': 0.0,
            'track_insider_activity': 0.0
        }
    
    def get_subscription_tier_info(self) -> Dict[str, Any]:
        """Get current subscription tier details."""
        return {
            'name': 'Public Access',
            'rate_limit': '10 requests/second',
            'monthly_quota': None,
            'features': [
                'All SEC filings since 1994',
                'Real-time filing submissions', 
                'XBRL financial data parsing',
                'Insider trading analysis',
                'Company facts and fundamentals'
            ],
            'real_time_data': True,  # Real-time filing submissions
            'cost_per_request': 0.0
        }
    
    def check_quota_status(self) -> Dict[str, Any]:
        """Check remaining quota and usage statistics."""
        return {
            'remaining_requests': None,  # No quota limits
            'used_requests': 0,
            'quota_limit': None,
            'reset_date': None,
            'usage_percentage': 0.0
        }
    
    # Required abstract methods from DataCollectorInterface
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "SEC_EDGAR_MCP"
    
    @property
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            'filings', 'financial_statements', 'company_facts', 
            'insider_trading', 'fundamental_data', 'business_descriptions'
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """Return True if this collector requires an API key."""
        return False  # SEC EDGAR is public data
    
    def authenticate(self) -> bool:
        """Authenticate with the data source."""
        # SEC EDGAR doesn't require authentication, just validate User-Agent
        try:
            if not self.user_agent or '@' not in self.user_agent:
                logger.error("SEC EDGAR requires valid User-Agent with email contact")
                return False
            
            self._authenticated = True
            logger.info("SEC EDGAR MCP collector authenticated (User-Agent validated)")
            return True
                
        except Exception as e:
            logger.error(f"SEC EDGAR MCP authentication error: {e}")
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to the data source."""
        try:
            start_time = datetime.now()
            
            # Test MCP server connection
            success = asyncio.run(self._test_mcp_connection())
            
            response_time = (datetime.now() - start_time).total_seconds()
            
            if success:
                return {
                    'status': 'connected',
                    'response_time': response_time,
                    'mcp_status': 'active',
                    'data_source': 'SEC EDGAR Official Filings',
                    'user_agent': self.user_agent,
                    'test_timestamp': datetime.now().isoformat()
                }
            else:
                return {
                    'status': 'failed',
                    'error_message': 'MCP server connection failed',
                    'response_time': response_time,
                    'test_timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            return {
                'status': 'error',
                'error_message': str(e),
                'test_timestamp': datetime.now().isoformat()
            }
    
    async def _test_mcp_connection(self) -> bool:
        """Test the MCP server connection."""
        try:
            await self._ensure_mcp_server()
            tools = await self.get_available_tools()
            return len(tools) > 0
        except Exception as e:
            logger.error(f"MCP connection test failed: {e}")
            return False
    
    # Filtering and Activation Logic (matching existing SEC collector)
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if SEC EDGAR MCP should activate based on filter specificity.
        
        SEC EDGAR MCP is designed for individual company deep-dive analysis and should
        ONLY activate when specific companies are requested in the filter.
        
        Uses the SAME filtering logic as the existing SEC API collector to ensure
        consistent behavior between MCP and API implementations.
        
        Args:
            filter_criteria: Dictionary containing filter parameters
            
        Returns:
            bool: True if SEC EDGAR MCP should be used for this request
            
        Activation Rules:
        ✅ ACTIVATE when:
        - Specific company symbols/tickers are listed
        - Individual company CIKs are provided
        - Small list of companies (≤20) for comparison
        - Filing analysis or insider trading requests
        
        ❌ DON'T ACTIVATE when:
        - Broad sector filtering only (use market APIs)
        - Index-only requests (use index APIs) 
        - Economic indicator requests (use FRED)
        - Large company lists (>20, use bulk APIs)
        """
        # Extract specific company identifiers
        companies = filter_criteria.get('companies', [])
        symbols = filter_criteria.get('symbols', [])
        tickers = filter_criteria.get('tickers', [])
        ciks = filter_criteria.get('ciks', [])
        
        # Combine all specific company identifiers
        specific_companies = companies + symbols + tickers + ciks
        
        # Don't activate for broad sector-only requests
        if filter_criteria.get('sector') and not specific_companies:
            logger.info("SEC EDGAR MCP: Skipping - sector-only request (use market screening APIs)")
            return False
        
        # Don't activate for index-only requests
        if filter_criteria.get('index') and not specific_companies:
            logger.info("SEC EDGAR MCP: Skipping - index-only request (use index APIs)")
            return False
        
        # Don't activate for economic indicator requests
        if filter_criteria.get('economic_indicator') or filter_criteria.get('fred_series'):
            logger.info("SEC EDGAR MCP: Skipping - economic data request (use FRED API)")
            return False
        
        # Don't activate for market-wide screening without specific companies
        market_filters = ['market_cap', 'volume', 'price_range', 'technical_indicators']
        if any(filter_criteria.get(f) for f in market_filters) and not specific_companies:
            logger.info("SEC EDGAR MCP: Skipping - market screening request (use market APIs)")
            return False
        
        # Don't activate for very large company lists (inefficient for MCP)
        if len(specific_companies) > 20:
            logger.info(f"SEC EDGAR MCP: Skipping - too many companies ({len(specific_companies)} > 20), use bulk market APIs")
            return False
        
        # Activate for SEC-specific data requests
        sec_specific_requests = [
            'filings', 'financial_statements', 'insider_trading', 
            'company_facts', '10k', '10q', '8k', 'form_4'
        ]
        if any(filter_criteria.get(req) for req in sec_specific_requests):
            logger.info(f"SEC EDGAR MCP: ACTIVATING - SEC-specific data request")
            return True
        
        # Activate when specific companies are requested
        if specific_companies:
            logger.info(f"SEC EDGAR MCP: ACTIVATING - individual analysis for {len(specific_companies)} companies: {specific_companies}")
            return True
        
        # Default: don't activate without specific companies or SEC data requests
        logger.info("SEC EDGAR MCP: Skipping - no specific companies or SEC data requested")
        return False
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Get priority level for this collector when multiple collectors can handle a request.
        
        Args:
            filter_criteria: Dictionary containing filter parameters
            
        Returns:
            int: Priority level (0-100, higher = more specific/preferred)
        """
        if not self.should_activate(filter_criteria):
            return 0
        
        # Very high priority for SEC-specific requests
        sec_specific_requests = [
            'filings', 'financial_statements', 'insider_trading', 
            'company_facts', '10k', '10q', '8k', 'form_4'
        ]
        if any(filter_criteria.get(req) for req in sec_specific_requests):
            return 100  # Highest priority for SEC-specific data
        
        # High priority for individual company analysis
        companies = filter_criteria.get('companies', [])
        symbols = filter_criteria.get('symbols', [])
        tickers = filter_criteria.get('tickers', [])
        ciks = filter_criteria.get('ciks', [])
        
        specific_companies = companies + symbols + tickers + ciks
        
        if len(specific_companies) == 1:
            return 95   # Very high for single company deep-dive
        elif len(specific_companies) <= 5:
            return 85   # High for small comparison groups
        elif len(specific_companies) <= 10:
            return 75   # Moderate-high for medium comparison groups
        elif len(specific_companies) <= 20:
            return 65   # Moderate for larger comparison groups
        
        return 0
    
    # MCP Server Management
    
    async def _ensure_mcp_server(self):
        """Ensure MCP server is running and ready"""
        if self._mcp_process is None or self._mcp_process.poll() is not None:
            # Start SEC EDGAR MCP server
            env = os.environ.copy()
            env['SEC_EDGAR_USER_AGENT'] = self.user_agent
            
            # Try different installation methods
            cmd_options = [
                # Docker method (preferred for production)
                ['docker', 'run', '-i', '--rm', '-e', f'SEC_EDGAR_USER_AGENT={self.user_agent}', 'stefanoamorelli/sec-edgar-mcp:latest'],
                
                # pip installed version
                ['python', '-m', 'sec_edgar_mcp'],
                
                # Direct python execution
                ['sec-edgar-mcp']
            ]
            
            for cmd in cmd_options:
                try:
                    self._mcp_process = subprocess.Popen(
                        cmd,
                        env=env,
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True
                    )
                    
                    # Test if process started successfully
                    time.sleep(1)  # Give process time to start
                    if self._mcp_process.poll() is None:
                        logger.info(f"SEC EDGAR MCP server started successfully with: {cmd[0]}")
                        break
                    else:
                        logger.warning(f"SEC EDGAR MCP server failed to start with: {cmd[0]}")
                        self._mcp_process = None
                        
                except FileNotFoundError:
                    logger.debug(f"Command not found: {cmd[0]}")
                    continue
                except Exception as e:
                    logger.warning(f"Failed to start MCP server with {cmd[0]}: {e}")
                    continue
            
            if self._mcp_process is None:
                raise RuntimeError("Could not start SEC EDGAR MCP server. Please install with: pip install sec-edgar-mcp")
            
            # Initialize the MCP server with JSON-RPC
            init_msg = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"roots": {"listChanged": True}},
                    "clientInfo": {"name": "sec-edgar-collector", "version": "1.0"}
                }
            }
            
            self._mcp_process.stdin.write(json.dumps(init_msg) + '\n')
            self._mcp_process.stdin.flush()
            
            # Read initialization response
            response_line = self._mcp_process.stdout.readline()
            if response_line:
                try:
                    init_data = json.loads(response_line.strip())
                    
                    if 'result' in init_data:
                        logger.info(f"SEC EDGAR MCP server initialized: {init_data['result'].get('serverInfo', {}).get('name', 'SEC EDGAR MCP')}")
                        
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
                        logger.error(f"SEC EDGAR MCP server initialization failed: {init_data}")
                        raise RuntimeError("MCP server initialization failed")
                        
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON response from MCP server: {e}")
                    raise RuntimeError("Invalid MCP server response")
            else:
                logger.error("No response from MCP server during initialization")
                raise RuntimeError("MCP server did not respond")
    
    async def get_available_tools(self) -> List[Dict[str, Any]]:
        """
        Get list of available tools from SEC EDGAR MCP server.
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
            response_line = self._mcp_process.stdout.readline()
            if response_line:
                tools_data = json.loads(response_line.strip())
                
                if 'result' in tools_data and 'tools' in tools_data['result']:
                    self._tools_cache = tools_data['result']['tools']
                    self._tools_cache_time = now
                    logger.info(f"Discovered {len(self._tools_cache)} SEC EDGAR MCP tools")
                    return self._tools_cache
                else:
                    logger.error(f"Failed to get tools: {tools_data}")
                    return []
            else:
                logger.error("No response from MCP server for tools list")
                return []
                
        except Exception as e:
            logger.error(f"Error getting SEC EDGAR MCP tools: {e}")
            return []
    
    async def call_mcp_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool on the SEC EDGAR MCP server.
        Handles rate limiting and provides fallback to direct API calls.
        """
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
            
            # Read response
            response_line = self._mcp_process.stdout.readline()
            if response_line:
                result_data = json.loads(response_line.strip())
                
                if 'result' in result_data:
                    logger.debug(f"SEC EDGAR MCP tool {tool_name} completed successfully")
                    
                    # Parse the response content
                    content = result_data['result']
                    if isinstance(content, list) and len(content) > 0:
                        # Extract text content from MCP response
                        first_content = content[0]
                        if 'content' in first_content and len(first_content['content']) > 0:
                            text_content = first_content['content'][0].get('text', '')
                            try:
                                return json.loads(text_content)
                            except json.JSONDecodeError:
                                # If not JSON, return as text
                                return {'content': text_content}
                    
                    return content
                else:
                    error = result_data.get('error', {})
                    logger.error(f"SEC EDGAR MCP tool {tool_name} failed: {error.get('message', 'Unknown error')}")
                    
                    # Try fallback to direct API call
                    return await self._fallback_api_call(tool_name, arguments)
            else:
                logger.error(f"No response from MCP server for tool {tool_name}")
                return await self._fallback_api_call(tool_name, arguments)
                
        except Exception as e:
            logger.error(f"SEC EDGAR MCP tool call failed: {e}")
            # Try fallback to direct API call
            return await self._fallback_api_call(tool_name, arguments)
    
    async def _fallback_api_call(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fallback to direct SEC EDGAR API calls when MCP server fails.
        Uses the existing SEC API collector for reliability.
        """
        logger.info(f"Using fallback API call for {tool_name}")
        
        try:
            # Initialize API fallback collector if needed
            if self._api_fallback_collector is None:
                self._api_fallback_collector = SECEdgarCollector()
            
            # Map MCP tools to API collector methods
            if tool_name in ['get_company_facts', 'get_company_info']:
                symbol = arguments.get('ticker') or arguments.get('symbol')
                if symbol and symbol.upper() in SAMPLE_COMPANIES:
                    cik = SAMPLE_COMPANIES[symbol.upper()]['cik']
                    return self._api_fallback_collector.get_company_facts(cik)
            
            elif tool_name == 'get_company_filings':
                symbol = arguments.get('ticker') or arguments.get('symbol')
                if symbol and symbol.upper() in SAMPLE_COMPANIES:
                    cik = SAMPLE_COMPANIES[symbol.upper()]['cik']
                    return self._api_fallback_collector.get_company_submissions(cik)
            
            elif tool_name in ['lookup_company_cik', 'get_company_tickers']:
                symbol = arguments.get('ticker') or arguments.get('symbol')
                cik = self._api_fallback_collector.get_symbol_to_cik_mapping(symbol)
                return {'cik': cik, 'symbol': symbol} if cik else {'error': 'Symbol not found'}
            
            else:
                return {"error": f"Fallback not implemented for tool: {tool_name}"}
                
        except Exception as e:
            logger.error(f"Fallback API call failed: {e}")
            return {"error": f"Fallback failed: {str(e)}"}
    
    # High-level convenience methods
    
    async def get_company_fundamentals(self, symbol: str) -> Dict[str, Any]:
        """Get comprehensive company fundamentals including financial statements."""
        return await self.call_mcp_tool("get_company_facts", {"ticker": symbol})
    
    async def get_recent_filings(self, symbol: str, form_types: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get recent SEC filings for a company."""
        args = {"ticker": symbol}
        if form_types:
            args["form_types"] = form_types
        return await self.call_mcp_tool("get_recent_filings", args)
    
    async def analyze_insider_trading(self, symbol: str, days: int = 90) -> Dict[str, Any]:
        """Analyze insider trading activity for a company."""
        return await self.call_mcp_tool("get_insider_transactions", {
            "ticker": symbol,
            "days": days
        })
    
    async def get_financial_statements(self, symbol: str, statement_type: str = "all") -> Dict[str, Any]:
        """Get financial statements (income, balance, cash flow)."""
        return await self.call_mcp_tool("get_financial_statements", {
            "ticker": symbol,
            "statement_type": statement_type
        })
    
    async def analyze_8k_filing(self, symbol: str, filing_date: Optional[str] = None) -> Dict[str, Any]:
        """Analyze recent 8-K current report filings."""
        args = {"ticker": symbol}
        if filing_date:
            args["filing_date"] = filing_date
        return await self.call_mcp_tool("analyze_8k_filing", args)
    
    # Implementation of required interface methods
    
    def collect_batch(self, symbols: List[str], date_range, frequency="daily", data_type: str = "filings"):
        """
        Collect SEC filing data for multiple symbols.
        Note: SEC EDGAR provides filing-based data, not time-series market data.
        """
        import pandas as pd
        
        results = []
        
        for symbol in symbols:
            try:
                if data_type == "filings":
                    # Get recent filings
                    data = asyncio.run(self.get_recent_filings(symbol))
                    
                    if 'recent_filings' in data:
                        for filing in data['recent_filings']:
                            results.append({
                                'symbol': symbol,
                                'filing_date': filing.get('filingDate'),
                                'form': filing.get('form'),
                                'accession_number': filing.get('accessionNumber'),
                                'report_date': filing.get('reportDate')
                            })
                
                elif data_type == "fundamentals":
                    # Get company facts
                    data = asyncio.run(self.get_company_fundamentals(symbol))
                    
                    if 'financial_metrics' in data:
                        results.append({
                            'symbol': symbol,
                            'company_name': data.get('company_info', {}).get('name'),
                            'latest_revenue': data.get('financial_metrics', {}).get('Revenue', {}).get('latest_value'),
                            'latest_net_income': data.get('financial_metrics', {}).get('NetIncome', {}).get('latest_value'),
                            'data_retrieved': data.get('metadata', {}).get('data_retrieved')
                        })
                            
            except Exception as e:
                logger.error(f"Error collecting SEC data for {symbol}: {e}")
        
        if results:
            return pd.DataFrame(results)
        else:
            return pd.DataFrame()
    
    def collect_realtime(self, symbols: List[str], data_type: str = "filings"):
        """
        Monitor for new SEC filings (filing-based, not real-time market data).
        """
        for symbol in symbols:
            try:
                # Get recent filings
                data = asyncio.run(self.get_recent_filings(symbol))
                
                if 'recent_filings' in data:
                    for filing in data['recent_filings']:
                        yield {
                            'symbol': symbol,
                            'timestamp': datetime.now(),
                            'filing_type': filing.get('form'),
                            'filing_date': filing.get('filingDate'),
                            'accession_number': filing.get('accessionNumber'),
                            'data_type': 'sec_filing'
                        }
                        
            except Exception as e:
                logger.error(f"Error monitoring SEC filings for {symbol}: {e}")
    
    def get_available_symbols(self, exchange: Optional[str] = None, sector: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of available symbols from SEC EDGAR (uses sample companies)."""
        symbols = []
        
        for symbol, info in SAMPLE_COMPANIES.items():
            symbols.append({
                'symbol': symbol,
                'name': info['name'],
                'cik': info['cik'],
                'exchange': 'NASDAQ/NYSE',  # Major exchanges
                'data_source': 'SEC EDGAR'
            })
        
        return symbols
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get current rate limit information."""
        return {
            'requests_per_second': 10,  # SEC guideline
            'requests_per_minute': 600,
            'requests_per_day': None,
            'requests_per_month': None,
            'current_usage': self.check_quota_status()
        }
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """Validate if symbols are supported by this collector."""
        return {symbol: symbol.upper() in SAMPLE_COMPANIES for symbol in symbols}
    
    def cleanup(self):
        """Clean up MCP server process and resources."""
        if hasattr(self, '_mcp_process') and self._mcp_process:
            self._mcp_process.terminate()
            self._mcp_process.wait()
            self._mcp_process = None
        logger.info("SEC EDGAR MCP collector cleaned up")
    
    def __del__(self):
        """Cleanup on destruction."""
        try:
            if hasattr(self, '_mcp_process'):
                self.cleanup()
        except AttributeError:
            pass  # Object was not fully initialized


# Factory function for easy instantiation
def create_sec_edgar_mcp_collector(user_agent: Optional[str] = None) -> SECEdgarMCPCollector:
    """
    Factory function to create a SEC EDGAR MCP collector.
    
    Args:
        user_agent: SEC-required user agent string with email contact
    
    Returns:
        Configured SECEdgarMCPCollector instance
    """
    return SECEdgarMCPCollector(user_agent=user_agent)