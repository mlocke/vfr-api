"""
Test Suite for SEC EDGAR MCP Collector

Comprehensive test coverage for SEC EDGAR MCP integration including:
- Connection and authentication testing
- MCP server communication
- Tool discovery and execution
- Filtering guidelines compliance
- Fallback API behavior
- Error handling and edge cases
"""

import unittest
import asyncio
import os
import tempfile
import json
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from datetime import datetime, timedelta

# Import the collector and dependencies
try:
    from .sec_edgar_mcp_collector import SECEdgarMCPCollector, create_sec_edgar_mcp_collector
    from ..sec_edgar_collector import SAMPLE_COMPANIES
    from ...base.collector_interface import CollectorConfig
except ImportError:
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    from government.mcp.sec_edgar_mcp_collector import SECEdgarMCPCollector, create_sec_edgar_mcp_collector
    from government.sec_edgar_collector import SAMPLE_COMPANIES
    from base.collector_interface import CollectorConfig


class TestSECEdgarMCPCollector(unittest.TestCase):
    """Test suite for SEC EDGAR MCP Collector."""
    
    def setUp(self):
        """Set up test environment."""
        self.test_user_agent = "Test Suite (test@example.com)"
        self.collector = SECEdgarMCPCollector(user_agent=self.test_user_agent)
        
        # Mock MCP process for testing
        self.mock_process = Mock()
        self.mock_process.poll.return_value = None
        self.mock_process.stdin = Mock()
        self.mock_process.stdout = Mock()
        self.mock_process.stderr = Mock()
        self.mock_process.stdin.write = Mock()
        self.mock_process.stdin.flush = Mock()
    
    def test_initialization(self):
        """Test collector initialization."""
        self.assertEqual(self.collector.source_name, "SEC_EDGAR_MCP")
        self.assertFalse(self.collector.requires_api_key)
        self.assertEqual(self.collector.cost_per_request, 0.0)
        self.assertIsNone(self.collector.monthly_quota_limit)
        self.assertEqual(self.collector.user_agent, self.test_user_agent)
    
    def test_initialization_with_invalid_user_agent(self):
        """Test initialization fails with invalid user agent."""
        with self.assertRaises(ValueError):
            SECEdgarMCPCollector(user_agent="Invalid User Agent")
    
    def test_initialization_with_config(self):
        """Test initialization with custom config."""
        config = CollectorConfig(
            base_url="https://custom.sec.gov",
            timeout=60,
            requests_per_minute=300
        )
        collector = SECEdgarMCPCollector(config=config, user_agent=self.test_user_agent)
        
        self.assertEqual(collector.config.base_url, "https://custom.sec.gov")
        self.assertEqual(collector.config.timeout, 60)
        self.assertEqual(collector.config.requests_per_minute, 300)
    
    def test_factory_function(self):
        """Test factory function."""
        collector = create_sec_edgar_mcp_collector(self.test_user_agent)
        self.assertIsInstance(collector, SECEdgarMCPCollector)
        self.assertEqual(collector.user_agent, self.test_user_agent)
    
    def test_supported_data_types(self):
        """Test supported data types."""
        expected_types = [
            'filings', 'financial_statements', 'company_facts', 
            'insider_trading', 'fundamental_data', 'business_descriptions'
        ]
        
        for data_type in expected_types:
            self.assertIn(data_type, self.collector.supported_data_types)
    
    def test_tool_cost_map(self):
        """Test tool cost mapping (should be all free)."""
        cost_map = self.collector.get_tool_cost_map()
        
        # All SEC EDGAR tools should be free
        for tool_name, cost in cost_map.items():
            self.assertEqual(cost, 0.0, f"Tool {tool_name} should be free")
    
    def test_subscription_tier_info(self):
        """Test subscription tier information."""
        tier_info = self.collector.get_subscription_tier_info()
        
        self.assertEqual(tier_info['name'], 'Public Access')
        self.assertEqual(tier_info['cost_per_request'], 0.0)
        self.assertIsNone(tier_info['monthly_quota'])
        self.assertTrue(tier_info['real_time_data'])
        self.assertIn('All SEC filings since 1994', tier_info['features'])
    
    def test_quota_status(self):
        """Test quota status (should be unlimited)."""
        status = self.collector.check_quota_status()
        
        self.assertIsNone(status['remaining_requests'])
        self.assertIsNone(status['quota_limit'])
        self.assertEqual(status['usage_percentage'], 0.0)
    
    def test_authentication(self):
        """Test authentication process."""
        result = self.collector.authenticate()
        self.assertTrue(result)
        self.assertTrue(self.collector._authenticated)
    
    def test_authentication_with_invalid_user_agent(self):
        """Test authentication fails with invalid user agent."""
        self.collector.user_agent = "Invalid"
        result = self.collector.authenticate()
        self.assertFalse(result)
    
    @patch('subprocess.Popen')
    def test_mcp_server_startup_docker(self, mock_popen):
        """Test MCP server startup with Docker."""
        mock_popen.return_value = self.mock_process
        self.mock_process.stdout.readline.return_value = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "serverInfo": {"name": "SEC EDGAR MCP Server", "version": "1.0.0"}
            }
        }) + '\n'
        
        # Run the async method
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(self.collector._ensure_mcp_server())
            
            # Verify Docker command was called
            mock_popen.assert_called()
            call_args = mock_popen.call_args[0][0]
            self.assertEqual(call_args[0], 'docker')
            self.assertIn('stefanoamorelli/sec-edgar-mcp:latest', call_args)
        finally:
            loop.close()
    
    @patch('subprocess.Popen')
    def test_get_available_tools(self, mock_popen):
        """Test tool discovery."""
        mock_popen.return_value = self.mock_process
        
        # Mock initialization response
        init_response = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"serverInfo": {"name": "SEC EDGAR MCP Server"}}
        }) + '\n'
        
        # Mock tools list response
        tools_response = json.dumps({
            "jsonrpc": "2.0",
            "id": 2,
            "result": {
                "tools": [
                    {"name": "get_company_facts", "description": "Get company facts"},
                    {"name": "get_recent_filings", "description": "Get recent filings"},
                    {"name": "get_insider_transactions", "description": "Get insider trading data"}
                ]
            }
        }) + '\n'
        
        self.mock_process.stdout.readline.side_effect = [init_response, tools_response]
        
        # Run the async method
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            tools = loop.run_until_complete(self.collector.get_available_tools())
            
            self.assertEqual(len(tools), 3)
            tool_names = [tool['name'] for tool in tools]
            self.assertIn('get_company_facts', tool_names)
            self.assertIn('get_recent_filings', tool_names)
            self.assertIn('get_insider_transactions', tool_names)
        finally:
            loop.close()
    
    @patch('subprocess.Popen')
    def test_mcp_tool_call_success(self, mock_popen):
        """Test successful MCP tool call."""
        mock_popen.return_value = self.mock_process
        
        # Mock responses
        init_response = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"serverInfo": {"name": "SEC EDGAR MCP Server"}}
        }) + '\n'
        
        tool_response = json.dumps({
            "jsonrpc": "2.0",
            "id": 3,
            "result": [{
                "content": [{
                    "text": json.dumps({
                        "company_info": {
                            "name": "Apple Inc.",
                            "cik": "320193"
                        },
                        "financial_metrics": {
                            "Revenue": {"latest_value": 394328000000}
                        }
                    })
                }]
            }]
        }) + '\n'
        
        self.mock_process.stdout.readline.side_effect = [init_response, tool_response]
        
        # Run the async method
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                self.collector.call_mcp_tool("get_company_facts", {"ticker": "AAPL"})
            )
            
            self.assertIn('company_info', result)
            self.assertEqual(result['company_info']['name'], "Apple Inc.")
            self.assertIn('financial_metrics', result)
        finally:
            loop.close()
    
    @patch('subprocess.Popen')
    def test_mcp_tool_call_with_fallback(self, mock_popen):
        """Test MCP tool call with fallback to API."""
        mock_popen.return_value = self.mock_process
        
        # Mock responses - initialization succeeds but tool call fails
        init_response = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"serverInfo": {"name": "SEC EDGAR MCP Server"}}
        }) + '\n'
        
        error_response = json.dumps({
            "jsonrpc": "2.0",
            "id": 3,
            "error": {"code": 500, "message": "Internal server error"}
        }) + '\n'
        
        self.mock_process.stdout.readline.side_effect = [init_response, error_response]
        
        # Mock the fallback API collector
        with patch.object(self.collector, '_api_fallback_collector') as mock_fallback:
            mock_fallback.get_company_facts.return_value = {
                "company_info": {"name": "Apple Inc."},
                "financial_metrics": {"Revenue": {"latest_value": 394328000000}}
            }
            
            # Run the async method
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                result = loop.run_until_complete(
                    self.collector.call_mcp_tool("get_company_facts", {"ticker": "AAPL"})
                )
                
                self.assertIn('company_info', result)
                mock_fallback.get_company_facts.assert_called_once()
            finally:
                loop.close()


class TestSECEdgarMCPFilteringGuidelines(unittest.TestCase):
    """Test filtering guidelines compliance."""
    
    def setUp(self):
        """Set up test environment."""
        self.collector = SECEdgarMCPCollector(user_agent="Test Suite (test@example.com)")
    
    def test_should_activate_with_specific_companies(self):
        """Test activation with specific company symbols."""
        test_cases = [
            # Should activate
            ({'symbols': ['AAPL']}, True),
            ({'companies': ['AAPL', 'MSFT']}, True),
            ({'tickers': ['GOOGL', 'AMZN', 'TSLA']}, True),
            ({'ciks': ['320193']}, True),
            
            # Should not activate - broad requests
            ({'sector': 'Technology'}, False),
            ({'index': 'SP500'}, False),
            ({'economic_indicator': 'GDP'}, False),
            ({'fred_series': 'GDPC1'}, False),
            
            # Should not activate - market screening without companies
            ({'market_cap': 'large', 'volume': 'high'}, False),
            ({'price_range': [100, 200]}, False),
            
            # Should not activate - too many companies
            ({'symbols': [f'STOCK{i}' for i in range(25)]}, False),
        ]
        
        for filter_criteria, expected in test_cases:
            with self.subTest(filter_criteria=filter_criteria):
                result = self.collector.should_activate(filter_criteria)
                self.assertEqual(result, expected, 
                    f"Filter {filter_criteria} should {'activate' if expected else 'not activate'}")
    
    def test_should_activate_with_sec_specific_requests(self):
        """Test activation with SEC-specific data requests."""
        sec_requests = [
            {'filings': True},
            {'financial_statements': True},
            {'insider_trading': True},
            {'company_facts': True},
            {'10k': True},
            {'10q': True},
            {'8k': True},
            {'form_4': True}
        ]
        
        for filter_criteria in sec_requests:
            with self.subTest(filter_criteria=filter_criteria):
                result = self.collector.should_activate(filter_criteria)
                self.assertTrue(result, f"SEC request {filter_criteria} should activate")
    
    def test_activation_priority(self):
        """Test activation priority scoring."""
        test_cases = [
            # SEC-specific requests get highest priority
            ({'filings': True}, 100),
            ({'insider_trading': True}, 100),
            ({'10k': True}, 100),
            
            # Single company gets very high priority
            ({'symbols': ['AAPL']}, 95),
            
            # Small groups get high priority
            ({'symbols': ['AAPL', 'MSFT', 'GOOGL']}, 85),
            
            # Medium groups get moderate-high priority
            ({'symbols': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META']}, 75),
            
            # Large groups get moderate priority
            ({'symbols': [f'STOCK{i}' for i in range(15)]}, 65),
            
            # Should not activate cases get 0 priority
            ({'sector': 'Technology'}, 0),
            ({'index': 'SP500'}, 0)
        ]
        
        for filter_criteria, expected_priority in test_cases:
            with self.subTest(filter_criteria=filter_criteria):
                priority = self.collector.get_activation_priority(filter_criteria)
                self.assertEqual(priority, expected_priority,
                    f"Filter {filter_criteria} should have priority {expected_priority}")
    
    def test_validate_symbols(self):
        """Test symbol validation."""
        test_symbols = ['AAPL', 'MSFT', 'INVALID_SYMBOL', 'GOOGL']
        validation_results = self.collector.validate_symbols(test_symbols)
        
        self.assertTrue(validation_results['AAPL'])
        self.assertTrue(validation_results['MSFT'])
        self.assertFalse(validation_results['INVALID_SYMBOL'])
        self.assertTrue(validation_results['GOOGL'])
    
    def test_get_available_symbols(self):
        """Test available symbols retrieval."""
        symbols = self.collector.get_available_symbols()
        
        self.assertIsInstance(symbols, list)
        self.assertTrue(len(symbols) > 0)
        
        # Check format of returned symbols
        for symbol_info in symbols[:3]:  # Check first 3
            self.assertIn('symbol', symbol_info)
            self.assertIn('name', symbol_info)
            self.assertIn('cik', symbol_info)
            self.assertIn('data_source', symbol_info)
            self.assertEqual(symbol_info['data_source'], 'SEC EDGAR')


class TestSECEdgarMCPIntegration(unittest.TestCase):
    """Integration tests for SEC EDGAR MCP Collector."""
    
    def setUp(self):
        """Set up test environment."""
        self.collector = SECEdgarMCPCollector(user_agent="Test Suite (test@example.com)")
    
    @patch('subprocess.Popen')
    def test_connection_test(self, mock_popen):
        """Test connection testing functionality."""
        mock_process = Mock()
        mock_process.poll.return_value = None
        mock_process.stdin = Mock()
        mock_process.stdout = Mock()
        mock_process.stderr = Mock()
        
        # Mock successful responses
        mock_process.stdout.readline.side_effect = [
            json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"serverInfo": {"name": "SEC EDGAR MCP"}}}) + '\n',
            json.dumps({"jsonrpc": "2.0", "id": 2, "result": {"tools": [{"name": "get_company_facts"}]}}) + '\n'
        ]
        
        mock_popen.return_value = mock_process
        
        result = self.collector.test_connection()
        
        self.assertEqual(result['status'], 'connected')
        self.assertIn('response_time', result)
        self.assertEqual(result['data_source'], 'SEC EDGAR Official Filings')
        self.assertIn('test_timestamp', result)
    
    def test_rate_limits(self):
        """Test rate limit information."""
        rate_limits = self.collector.get_rate_limits()
        
        self.assertEqual(rate_limits['requests_per_second'], 10)
        self.assertEqual(rate_limits['requests_per_minute'], 600)
        self.assertIsNone(rate_limits['requests_per_day'])
        self.assertIsNone(rate_limits['requests_per_month'])
    
    def test_cleanup(self):
        """Test cleanup functionality."""
        # Mock process
        mock_process = Mock()
        self.collector._mcp_process = mock_process
        
        self.collector.cleanup()
        
        mock_process.terminate.assert_called_once()
        mock_process.wait.assert_called_once()
        self.assertIsNone(self.collector._mcp_process)


class TestSECEdgarMCPConvenienceMethods(unittest.TestCase):
    """Test high-level convenience methods."""
    
    def setUp(self):
        """Set up test environment."""
        self.collector = SECEdgarMCPCollector(user_agent="Test Suite (test@example.com)")
    
    @patch.object(SECEdgarMCPCollector, 'call_mcp_tool')
    def test_get_company_fundamentals(self, mock_call_tool):
        """Test get_company_fundamentals convenience method."""
        mock_call_tool.return_value = {
            "company_info": {"name": "Apple Inc."},
            "financial_metrics": {"Revenue": {"latest_value": 394328000000}}
        }
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                self.collector.get_company_fundamentals("AAPL")
            )
            
            mock_call_tool.assert_called_once_with("get_company_facts", {"ticker": "AAPL"})
            self.assertIn('company_info', result)
            self.assertIn('financial_metrics', result)
        finally:
            loop.close()
    
    @patch.object(SECEdgarMCPCollector, 'call_mcp_tool')
    def test_get_recent_filings(self, mock_call_tool):
        """Test get_recent_filings convenience method."""
        mock_call_tool.return_value = {
            "recent_filings": [
                {"form": "10-K", "filingDate": "2024-01-15"},
                {"form": "10-Q", "filingDate": "2024-04-15"}
            ]
        }
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                self.collector.get_recent_filings("AAPL", ["10-K", "10-Q"])
            )
            
            mock_call_tool.assert_called_once_with("get_recent_filings", {
                "ticker": "AAPL",
                "form_types": ["10-K", "10-Q"]
            })
            self.assertIn('recent_filings', result)
        finally:
            loop.close()
    
    @patch.object(SECEdgarMCPCollector, 'call_mcp_tool')
    def test_analyze_insider_trading(self, mock_call_tool):
        """Test analyze_insider_trading convenience method."""
        mock_call_tool.return_value = {
            "insider_transactions": [
                {"transactionDate": "2024-01-10", "transactionType": "Purchase"}
            ]
        }
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                self.collector.analyze_insider_trading("AAPL", days=30)
            )
            
            mock_call_tool.assert_called_once_with("get_insider_transactions", {
                "ticker": "AAPL",
                "days": 30
            })
            self.assertIn('insider_transactions', result)
        finally:
            loop.close()


if __name__ == '__main__':
    # Set environment variable for testing
    os.environ['SEC_EDGAR_USER_AGENT'] = 'Test Suite (test@example.com)'
    
    # Run the tests
    unittest.main(verbosity=2)