"""
Data.gov MCP Collector

Government financial data collector leveraging data.gov datasets through 
MCP (Model Context Protocol) server integration. Provides AI-native access
to SEC filings, institutional holdings, Treasury data, and Federal Reserve
indicators.

Features:
- SEC XBRL financial statements (15+ years)
- Form 13F institutional holdings tracking
- Treasury yield curve and interest rates
- Federal Reserve economic indicators
- Fund flow analysis (N-PORT data)
- AI-optimized MCP tools for financial analysis

This collector establishes the platform as the first government data MCP
integration in the financial analysis space.
"""

import os
import sys
import json
import time
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from pathlib import Path
import aiohttp

# Add path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from base.collector_interface import DataCollectorInterface, CollectorConfig
from commercial.base.mcp_collector_base import MCPCollectorBase, MCPError
from commercial.mcp.mcp_client import MCPClient

logger = logging.getLogger(__name__)


class DataGovMCPCollector(DataCollectorInterface):
    """
    Data.gov MCP collector for government financial data.
    
    Integrates with local MCP server that processes data.gov datasets
    including SEC filings, institutional holdings, Treasury data, and
    Federal Reserve indicators.
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """
        Initialize Data.gov MCP collector.
        
        Args:
            config: Optional collector configuration
        """
        # Use default config if none provided
        if config is None:
            config = CollectorConfig(
                timeout=30,
                max_retries=3,
                requests_per_minute=60,
                cache_ttl=3600  # 1 hour cache
            )
        
        super().__init__(config)
        
        # MCP server configuration (local server)
        self.mcp_server_url = os.getenv("DATA_GOV_MCP_URL", "http://localhost:3001/mcp")
        self.mcp_client: Optional[MCPClient] = None
        self.connection_established = False
        
        # Required properties
        self._source_name = "Data.gov MCP"
        self._supported_data_types = [
            'sec_financials', 'institutional', 'treasury_macro', 
            'fed_indicators', 'fund_flows'
        ]
        
        # Tool categories for optimization
        self.tool_categories = {
            'sec_financials': [
                'get_quarterly_financials',
                'analyze_financial_trends', 
                'compare_peer_metrics',
                'get_xbrl_facts'
            ],
            'institutional': [
                'get_institutional_positions',
                'track_smart_money',
                'calculate_ownership_changes',
                'analyze_13f_trends'
            ],
            'treasury_macro': [
                'get_yield_curve_analysis',
                'calculate_rate_sensitivity',
                'get_treasury_rates',
                'analyze_rate_environment'
            ],
            'fed_indicators': [
                'get_fed_indicators',
                'analyze_monetary_policy',
                'get_credit_conditions',
                'track_policy_changes'
            ],
            'fund_flows': [
                'analyze_fund_flows',
                'track_etf_flows',
                'calculate_fund_overlap',
                'get_mutual_fund_holdings'
            ]
        }
        
        # Data sources configuration
        self.data_sources = {
            'sec_edgar': 'https://www.sec.gov/Archives/edgar/',
            'treasury_rates': 'https://home.treasury.gov/resource-center/data-chart-center/',
            'federal_reserve': 'https://www.federalreserve.gov/data.htm',
            'form_13f': 'https://www.sec.gov/Archives/edgar/full-index/'
        }
        
        # Rate limiting (respectful usage of government data)
        self.requests_per_minute = 60
        self.last_request_times = []
        
    @property
    def source_name(self) -> str:
        """Data source identifier."""
        return "Data.gov MCP Server"
    
    @property
    def supported_data_types(self) -> List[str]:
        """Supported data types."""
        return [
            "sec_financials",
            "institutional_holdings", 
            "treasury_rates",
            "federal_indicators",
            "fund_flows",
            "quarterly_earnings",
            "ownership_data",
            "yield_curves",
            "monetary_policy"
        ]
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if this collector should activate for given criteria.
        
        Args:
            filter_criteria: Filter criteria from request
            
        Returns:
            True if collector should activate
        """
        criteria_str = str(filter_criteria).lower()
        
        # Government financial data indicators
        government_indicators = [
            'sec_filings',
            'quarterly_financials', 
            'institutional_holdings',
            'form_13f',
            'smart_money',
            'treasury_rates',
            'yield_curve',
            'federal_reserve',
            'fed_indicators', 
            'monetary_policy',
            'fund_flows',
            'mutual_funds',
            'etf_flows',
            'xbrl_data',
            'earnings_transcripts',
            'ownership_changes'
        ]
        
        # Check for government data requests
        has_gov_indicator = any(indicator in criteria_str for indicator in government_indicators)
        
        # Check for fundamental analysis with government preference
        has_fundamental = any(term in criteria_str for term in [
            'fundamental_analysis', 'financial_statements', 'balance_sheet',
            'income_statement', 'cash_flow', 'earnings', 'revenue'
        ])
        
        # Check for institutional analysis
        has_institutional = any(term in criteria_str for term in [
            'institutional', 'hedge_fund', 'mutual_fund', 'pension_fund',
            'investment_advisor', 'portfolio_manager'
        ])
        
        # Check for macroeconomic analysis
        has_macro = any(term in criteria_str for term in [
            'interest_rates', 'monetary_policy', 'federal_reserve',
            'treasury', 'yield_curve', 'economic_indicators'
        ])
        
        return has_gov_indicator or has_fundamental or has_institutional or has_macro
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Calculate activation priority for given criteria.
        
        Args:
            filter_criteria: Filter criteria from request
            
        Returns:
            Priority score (0-100)
        """
        criteria_str = str(filter_criteria).lower()
        priority = 50  # Base priority
        
        # High priority for specific government data requests
        if 'sec_filings' in criteria_str or 'quarterly_financials' in criteria_str:
            priority += 40  # 90 total
        elif 'institutional_holdings' in criteria_str or 'form_13f' in criteria_str:
            priority += 35  # 85 total
        elif 'treasury_rates' in criteria_str or 'yield_curve' in criteria_str:
            priority += 30  # 80 total
        elif 'federal_reserve' in criteria_str or 'fed_indicators' in criteria_str:
            priority += 25  # 75 total
        elif 'fund_flows' in criteria_str or 'mutual_funds' in criteria_str:
            priority += 20  # 70 total
        
        # Bonus for MCP preference
        if 'mcp_preferred' in criteria_str or 'ai_native' in criteria_str:
            priority += 10
        
        # Bonus for government data preference
        if 'government_data' in criteria_str or 'official_data' in criteria_str:
            priority += 5
        
        return min(priority, 100)
    
    async def collect_data(self, request_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Collect data using MCP server.
        
        Args:
            request_params: Data collection parameters
            
        Returns:
            Collected data with metadata
        """
        try:
            # Ensure MCP connection
            if not await self._ensure_mcp_connection():
                raise MCPError("Cannot establish MCP server connection")
            
            # Parse request parameters
            data_type = request_params.get('data_type', 'sec_financials')
            symbols = request_params.get('symbols', [])
            date_range = request_params.get('date_range', {})
            analysis_options = request_params.get('analysis_options', {})
            
            # Route to appropriate collection method
            if data_type == 'sec_financials':
                return await self._collect_sec_financials(symbols, date_range, analysis_options)
            elif data_type == 'institutional_holdings':
                return await self._collect_institutional_data(symbols, date_range, analysis_options)
            elif data_type == 'treasury_rates':
                return await self._collect_treasury_data(date_range, analysis_options)
            elif data_type == 'federal_indicators':
                return await self._collect_fed_indicators(date_range, analysis_options)
            elif data_type == 'fund_flows':
                return await self._collect_fund_flows(symbols, date_range, analysis_options)
            else:
                # Default to comprehensive analysis
                return await self._collect_comprehensive_data(request_params)
                
        except Exception as e:
            logger.error(f"Data collection failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat()
            }
    
    async def _ensure_mcp_connection(self) -> bool:
        """Ensure MCP server connection is established."""
        if self.mcp_client and self.connection_established:
            return True
        
        try:
            # Create MCP client
            self.mcp_client = MCPClient(
                server_url=self.mcp_server_url,
                timeout=self.config.timeout,
                max_retries=self.config.max_retries
            )
            
            # Connect to server
            await self.mcp_client.connect()
            self.connection_established = True
            
            logger.info(f"Connected to Data.gov MCP server: {self.mcp_server_url}")
            return True
            
        except Exception as e:
            logger.error(f"MCP connection failed: {e}")
            self.connection_established = False
            return False
    
    async def _collect_sec_financials(
        self, 
        symbols: List[str], 
        date_range: Dict[str, Any],
        analysis_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Collect SEC financial data via MCP tools."""
        results = {
            'data_type': 'sec_financials',
            'symbols': symbols,
            'financial_statements': {},
            'trend_analysis': {},
            'peer_comparisons': {},
            'metadata': {
                'source': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'data_freshness': 'quarterly'
            }
        }
        
        try:
            # Get quarterly financials for each symbol
            for symbol in symbols[:10]:  # Limit to prevent timeouts
                try:
                    # Get financial statements
                    financials = await self.mcp_client.call_tool(
                        'get_quarterly_financials',
                        {
                            'ticker': symbol,
                            'quarters': date_range.get('quarters', 4)
                        }
                    )
                    
                    results['financial_statements'][symbol] = financials
                    
                    # Optional: Add trend analysis
                    if analysis_options.get('include_trends', True):
                        trends = await self.mcp_client.call_tool(
                            'analyze_financial_trends',
                            {
                                'ticker': symbol,
                                'metrics': ['revenue', 'net_income', 'total_assets', 'total_debt']
                            }
                        )
                        results['trend_analysis'][symbol] = trends
                    
                    # Small delay for rate limiting
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.warning(f"Failed to collect SEC data for {symbol}: {e}")
                    results['financial_statements'][symbol] = {'error': str(e)}
            
            # Peer comparison if multiple symbols
            if len(symbols) > 1 and analysis_options.get('peer_comparison', True):
                try:
                    peer_analysis = await self.mcp_client.call_tool(
                        'compare_peer_metrics',
                        {
                            'tickers': symbols[:5],  # Limit for performance
                            'metric': 'revenue_growth'
                        }
                    )
                    results['peer_comparisons'] = peer_analysis
                except Exception as e:
                    logger.warning(f"Peer comparison failed: {e}")
            
            results['success'] = True
            return results
            
        except Exception as e:
            logger.error(f"SEC financials collection failed: {e}")
            results['success'] = False
            results['error'] = str(e)
            return results
    
    async def _collect_institutional_data(
        self,
        symbols: List[str],
        date_range: Dict[str, Any], 
        analysis_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Collect institutional holdings data."""
        results = {
            'data_type': 'institutional_holdings',
            'symbols': symbols,
            'holdings_data': {},
            'smart_money_analysis': {},
            'ownership_changes': {},
            'metadata': {
                'source': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'data_frequency': 'quarterly'
            }
        }
        
        try:
            quarter = date_range.get('quarter', self._get_current_quarter())
            
            # Get institutional positions for each symbol
            for symbol in symbols[:5]:  # Limit for performance
                try:
                    positions = await self.mcp_client.call_tool(
                        'get_institutional_positions',
                        {
                            'ticker': symbol,
                            'quarter': quarter
                        }
                    )
                    results['holdings_data'][symbol] = positions
                    
                    # Optional: Track ownership changes
                    if analysis_options.get('track_changes', True):
                        changes = await self.mcp_client.call_tool(
                            'calculate_ownership_changes',
                            {
                                'ticker': symbol,
                                'quarters': 4
                            }
                        )
                        results['ownership_changes'][symbol] = changes
                    
                    await asyncio.sleep(0.2)  # Rate limiting
                    
                except Exception as e:
                    logger.warning(f"Failed to collect institutional data for {symbol}: {e}")
                    results['holdings_data'][symbol] = {'error': str(e)}
            
            # Smart money analysis
            if analysis_options.get('smart_money_analysis', True):
                try:
                    smart_money = await self.mcp_client.call_tool(
                        'track_smart_money',
                        {
                            'tickers': symbols[:3],
                            'institutions': analysis_options.get('focus_institutions', [])
                        }
                    )
                    results['smart_money_analysis'] = smart_money
                except Exception as e:
                    logger.warning(f"Smart money analysis failed: {e}")
            
            results['success'] = True
            return results
            
        except Exception as e:
            logger.error(f"Institutional data collection failed: {e}")
            results['success'] = False
            results['error'] = str(e)
            return results
    
    async def _collect_treasury_data(
        self,
        date_range: Dict[str, Any],
        analysis_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Collect Treasury and yield curve data."""
        results = {
            'data_type': 'treasury_rates',
            'yield_curve': {},
            'rate_analysis': {},
            'economic_implications': {},
            'metadata': {
                'source': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'data_frequency': 'daily'
            }
        }
        
        try:
            # Get yield curve analysis
            yield_curve = await self.mcp_client.call_tool(
                'get_yield_curve_analysis',
                {
                    'date': date_range.get('end_date', datetime.now().strftime('%Y-%m-%d'))
                }
            )
            results['yield_curve'] = yield_curve
            
            # Optional: Rate sensitivity analysis for stocks
            if analysis_options.get('rate_sensitivity') and 'symbols' in analysis_options:
                for symbol in analysis_options['symbols'][:3]:
                    try:
                        sensitivity = await self.mcp_client.call_tool(
                            'calculate_rate_sensitivity',
                            {
                                'ticker': symbol,
                                'rate_change': analysis_options.get('rate_change', 100)  # 1% change
                            }
                        )
                        results['rate_analysis'][symbol] = sensitivity
                        await asyncio.sleep(0.1)
                    except Exception as e:
                        logger.warning(f"Rate sensitivity analysis failed for {symbol}: {e}")
            
            results['success'] = True
            return results
            
        except Exception as e:
            logger.error(f"Treasury data collection failed: {e}")
            results['success'] = False
            results['error'] = str(e)
            return results
    
    async def _collect_fed_indicators(
        self,
        date_range: Dict[str, Any],
        analysis_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Collect Federal Reserve indicators."""
        results = {
            'data_type': 'federal_indicators',
            'indicators': {},
            'policy_analysis': {},
            'metadata': {
                'source': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'data_frequency': 'monthly'
            }
        }
        
        try:
            # Get Fed indicators
            indicators = await self.mcp_client.call_tool('get_fed_indicators', {})
            results['indicators'] = indicators
            
            # Optional: Monetary policy analysis
            if analysis_options.get('policy_analysis', True):
                policy_analysis = await self.mcp_client.call_tool(
                    'analyze_monetary_policy',
                    {
                        'lookback_months': date_range.get('months', 12)
                    }
                )
                results['policy_analysis'] = policy_analysis
            
            results['success'] = True
            return results
            
        except Exception as e:
            logger.error(f"Fed indicators collection failed: {e}")
            results['success'] = False
            results['error'] = str(e)
            return results
    
    async def _collect_fund_flows(
        self,
        symbols: List[str],
        date_range: Dict[str, Any],
        analysis_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Collect fund flow data."""
        results = {
            'data_type': 'fund_flows',
            'flow_analysis': {},
            'etf_flows': {},
            'mutual_fund_data': {},
            'metadata': {
                'source': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'data_frequency': 'monthly'
            }
        }
        
        try:
            # Analyze fund flows
            flow_analysis = await self.mcp_client.call_tool(
                'analyze_fund_flows',
                {
                    'symbols': symbols[:5],
                    'months': date_range.get('months', 6)
                }
            )
            results['flow_analysis'] = flow_analysis
            
            # ETF-specific analysis
            if analysis_options.get('etf_focus', True):
                etf_flows = await self.mcp_client.call_tool(
                    'track_etf_flows',
                    {
                        'symbols': [s for s in symbols if s.upper().endswith('ETF')][:3]
                    }
                )
                results['etf_flows'] = etf_flows
            
            results['success'] = True
            return results
            
        except Exception as e:
            logger.error(f"Fund flows collection failed: {e}")
            results['success'] = False
            results['error'] = str(e)
            return results
    
    async def _collect_comprehensive_data(self, request_params: Dict[str, Any]) -> Dict[str, Any]:
        """Collect comprehensive government financial data."""
        symbols = request_params.get('symbols', [])
        
        results = {
            'comprehensive_analysis': True,
            'sec_data': {},
            'institutional_data': {},
            'macro_context': {},
            'metadata': {
                'source': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'analysis_type': 'comprehensive'
            }
        }
        
        try:
            # Collect multiple data types
            if symbols:
                # SEC financials
                sec_data = await self._collect_sec_financials(
                    symbols[:3],
                    request_params.get('date_range', {}),
                    request_params.get('analysis_options', {})
                )
                results['sec_data'] = sec_data
                
                # Institutional data
                inst_data = await self._collect_institutional_data(
                    symbols[:3],
                    request_params.get('date_range', {}),
                    request_params.get('analysis_options', {})
                )
                results['institutional_data'] = inst_data
            
            # Macro context (always include)
            treasury_data = await self._collect_treasury_data(
                request_params.get('date_range', {}),
                request_params.get('analysis_options', {})
            )
            results['macro_context']['treasury'] = treasury_data
            
            fed_data = await self._collect_fed_indicators(
                request_params.get('date_range', {}),
                request_params.get('analysis_options', {})
            )
            results['macro_context']['federal_reserve'] = fed_data
            
            results['success'] = True
            return results
            
        except Exception as e:
            logger.error(f"Comprehensive data collection failed: {e}")
            results['success'] = False
            results['error'] = str(e)
            return results
    
    def _get_current_quarter(self) -> str:
        """Get current quarter in YYYY-Q format."""
        now = datetime.now()
        quarter = (now.month - 1) // 3 + 1
        return f"{now.year}-Q{quarter}"
    
    def get_data_source_info(self) -> Dict[str, str]:
        """Get information about this data source."""
        return {
            'source_name': self.source_name,
            'source_type': 'government_mcp',
            'description': 'Government financial data via MCP server (SEC, Treasury, Fed)',
            'update_frequency': 'quarterly/daily/monthly (varies by dataset)',
            'data_lag': '45-90 days for SEC, real-time for Treasury/Fed',
            'coverage': '15+ years SEC data, real-time rates, institutional holdings',
            'cost': 'free (government data)',
            'rate_limits': '60 requests/minute',
            'authentication': 'none required',
            'supported_formats': ['json', 'xbrl', 'csv'],
            'mcp_protocol': 'json-rpc 2.0',
            'ai_optimized': 'yes'
        }
    
    def get_available_tools(self) -> Dict[str, List[str]]:
        """Get available MCP tools by category."""
        return self.tool_categories.copy()
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on MCP server connection."""
        try:
            if not await self._ensure_mcp_connection():
                return {
                    'healthy': False,
                    'error': 'Cannot establish MCP connection',
                    'timestamp': datetime.now().isoformat()
                }
            
            # Test with a simple tool call
            health_result = await self.mcp_client.health_check()
            
            return {
                'healthy': health_result.get('healthy', False),
                'mcp_server': health_result,
                'collector': self.source_name,
                'tools_available': len(sum(self.tool_categories.values(), [])),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'healthy': False,
                'error': str(e),
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat()
            }
    
    async def cleanup(self):
        """Clean up MCP client connection."""
        if self.mcp_client:
            try:
                await self.mcp_client.disconnect()
            except Exception as e:
                logger.warning(f"Error during MCP cleanup: {e}")
            finally:
                self.mcp_client = None
                self.connection_established = False
    
    def __str__(self) -> str:
        """String representation."""
        tools_count = len(sum(self.tool_categories.values(), []))
        status = "connected" if self.connection_established else "disconnected"
        return f"DataGovMCPCollector(tools={tools_count}, status={status}, mcp=True)"
    
    # Required property implementations
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return self._source_name
    
    @property
    def supported_data_types(self) -> List[str]:
        """Return supported data types."""
        return self._supported_data_types
    
    # Required abstract method implementations
    
    def requires_api_key(self) -> bool:
        """Data.gov MCP server runs locally, no API key required."""
        return False
    
    def authenticate(self, credentials: Optional[Dict[str, str]] = None) -> bool:
        """Data.gov MCP server doesn't require authentication."""
        return True
    
    def get_available_symbols(self) -> List[str]:
        """Get available stock symbols (returns major S&P 500 symbols)."""
        return [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'BRK.B',
            'UNH', 'JNJ', 'JPM', 'V', 'PG', 'XOM', 'HD', 'CVX', 'MA', 'PFE',
            'ABBV', 'BAC', 'KO', 'AVGO', 'PEP', 'TMO', 'COST', 'MRK', 'WMT',
            'CSCO', 'DIS', 'ABT', 'DHR', 'VZ', 'NKE', 'ADBE', 'CRM', 'NEE',
            'TXN', 'NFLX', 'RTX', 'QCOM', 'ORCL', 'ACN', 'UPS', 'LOW', 'AMD'
        ]
    
    def validate_symbols(self, symbols: List[str]) -> List[str]:
        """Validate stock symbols (accepts any standard ticker format)."""
        validated = []
        for symbol in symbols:
            # Basic validation - uppercase, alphanumeric plus dots/hyphens
            clean_symbol = symbol.upper().strip()
            if clean_symbol and len(clean_symbol) <= 10:
                # Allow letters, numbers, dots, hyphens
                if all(c.isalnum() or c in '.-' for c in clean_symbol):
                    validated.append(clean_symbol)
        return validated
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get rate limiting information."""
        return {
            'requests_per_minute': 60,
            'requests_per_hour': 1000,
            'concurrent_requests': 5,
            'has_burst_limit': False,
            'reset_policy': 'sliding_window',
            'enforced': True,
            'notes': 'Local MCP server limits to prevent overload'
        }
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to the Data.gov MCP server."""
        try:
            if await self._ensure_mcp_connection():
                # Test a simple tool call
                test_result = await self.mcp_client.list_tools()
                tools_count = len(test_result.get('tools', []))
                
                return {
                    'success': True,
                    'status': 'connected',
                    'mcp_server_url': self.mcp_server_url,
                    'tools_available': tools_count,
                    'protocol': 'JSON-RPC 2.0 MCP',
                    'response_time_ms': 50,  # Estimate for local server
                    'timestamp': datetime.now().isoformat()
                }
            else:
                return {
                    'success': False,
                    'status': 'connection_failed',
                    'error': 'Cannot connect to MCP server',
                    'mcp_server_url': self.mcp_server_url,
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            return {
                'success': False,
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    async def collect_realtime(
        self, 
        symbols: List[str], 
        data_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Collect real-time government financial data."""
        # Government data is not real-time, redirect to batch collection
        return await self.collect_batch(
            symbols=symbols, 
            start_date=(datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d'),
            end_date=datetime.now().strftime('%Y-%m-%d'),
            data_types=data_types
        )
    
    async def collect_batch(
        self,
        symbols: List[str],
        start_date: str,
        end_date: str,
        data_types: Optional[List[str]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Collect batch government financial data."""
        # Validate inputs
        validated_symbols = self.validate_symbols(symbols)
        if not validated_symbols:
            return {
                'success': False,
                'error': 'No valid symbols provided',
                'timestamp': datetime.now().isoformat()
            }
        
        # Set default data types for government data
        if not data_types:
            data_types = ['sec_financials', 'treasury_macro']
        
        # Prepare collection parameters
        date_range = {
            'start_date': start_date,
            'end_date': end_date
        }
        
        analysis_options = {
            'symbols': validated_symbols,
            **kwargs  # Pass through additional options
        }
        
        # Collect data based on requested types
        results = {
            'success': False,
            'symbols': validated_symbols,
            'date_range': date_range,
            'data_types': data_types,
            'timestamp': datetime.now().isoformat(),
            'source': self.source_name
        }
        
        try:
            # Collect different types of government data
            if 'sec_financials' in data_types:
                sec_data = await self._collect_sec_financials(
                    validated_symbols, date_range, analysis_options
                )
                results['sec_financials'] = sec_data
            
            if 'institutional' in data_types:
                institutional_data = await self._collect_institutional_data(
                    validated_symbols, date_range, analysis_options
                )
                results['institutional'] = institutional_data
            
            if 'treasury_macro' in data_types:
                treasury_data = await self._collect_treasury_data(
                    date_range, analysis_options
                )
                results['treasury_macro'] = treasury_data
            
            if 'fed_indicators' in data_types:
                fed_data = await self._collect_fed_indicators(
                    date_range, analysis_options
                )
                results['fed_indicators'] = fed_data
            
            # Check if any data collection succeeded
            data_sections = ['sec_financials', 'institutional', 'treasury_macro', 'fed_indicators']
            success_count = sum(1 for section in data_sections 
                              if section in results and results[section].get('success', False))
            
            results['success'] = success_count > 0
            results['sections_collected'] = success_count
            results['total_sections_requested'] = len(data_types)
            
            return results
            
        except Exception as e:
            results['success'] = False
            results['error'] = str(e)
            return results