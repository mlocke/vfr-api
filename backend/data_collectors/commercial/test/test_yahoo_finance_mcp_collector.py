"""
Unit Tests for Yahoo Finance MCP Collector

Comprehensive test suite for the Yahoo Finance MCP collector,
validating all 10 tools and integration with the MCP base class.
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import json
from datetime import datetime
from pathlib import Path
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from commercial.mcp.yahoo_finance_mcp_collector import (
    YahooFinanceMCPCollector,
    FinancialStatementType,
    HolderInfoType,
    RecommendationType
)
from commercial.base.commercial_collector_interface import SubscriptionTier
from base.collector_interface import CollectorConfig


class TestYahooFinanceMCPCollector(unittest.TestCase):
    """Test suite for Yahoo Finance MCP Collector."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.config = CollectorConfig(
            api_key=None,
            base_url="http://localhost:3000",
            timeout=30,
            requests_per_minute=60,
            rate_limit_enabled=False
        )
        
        self.collector = YahooFinanceMCPCollector(self.config)
        
        # Mock the MCP server check
        self.collector._check_server_running = Mock(return_value=True)
        self.collector.connection_established = True
        self.collector._populate_available_tools()
    
    def test_initialization(self):
        """Test collector initialization."""
        self.assertEqual(self.collector.name, "Yahoo Finance MCP Collector")
        self.assertEqual(self.collector.source_name, "yahoo_finance")
        self.assertEqual(self.collector.subscription_tier, SubscriptionTier.FREE)
        self.assertEqual(self.collector.cost_per_request, 0.0)
        self.assertIsNone(self.collector.monthly_quota_limit)
    
    def test_available_tools(self):
        """Test that all Yahoo Finance tools are available."""
        expected_tools = [
            "get_historical_stock_prices",
            "get_stock_info",
            "get_yahoo_finance_news",
            "get_stock_actions",
            "get_financial_statement",
            "get_holder_info",
            "get_option_expiration_dates",
            "get_option_chain",
            "get_recommendations"
        ]
        
        available_tools = list(self.collector.available_tools.keys())
        for tool in expected_tools:
            self.assertIn(tool, available_tools)
        
        self.assertEqual(len(self.collector.available_tools), len(expected_tools))
    
    def test_tool_categorization(self):
        """Test tool categorization."""
        self.collector._categorize_tools()
        
        # Check that categories exist
        self.assertIn("market_data", self.collector.tool_categories)
        self.assertIn("fundamentals", self.collector.tool_categories)
        self.assertIn("options", self.collector.tool_categories)
        self.assertIn("news_sentiment", self.collector.tool_categories)
        
        # Check specific tool categorizations
        self.assertIn("get_historical_stock_prices", self.collector.tool_categories["market_data"])
        self.assertIn("get_financial_statement", self.collector.tool_categories["fundamentals"])
        self.assertIn("get_option_chain", self.collector.tool_categories["options"])
    
    def test_tool_cost_map(self):
        """Test that all tools have zero cost."""
        cost_map = self.collector.get_tool_cost_map()
        
        # All Yahoo Finance tools should be free
        for tool, cost in cost_map.items():
            self.assertEqual(cost, 0.0, f"Tool {tool} should have zero cost")
    
    def test_get_historical_prices(self):
        """Test historical price data retrieval."""
        # Mock the MCP tool call
        self.collector.call_mcp_tool = Mock(return_value={
            "data": [
                {"Date": "2024-01-01", "Open": 145.0, "High": 150.0, "Low": 144.0, "Close": 149.0, "Volume": 50000000}
            ]
        })
        
        result = self.collector.get_historical_prices("AAPL", period="1mo", interval="1d")
        
        self.assertIsNotNone(result)
        self.assertIn("data", result)
        self.collector.call_mcp_tool.assert_called_once_with(
            "get_historical_stock_prices",
            {"ticker": "AAPL", "period": "1mo", "interval": "1d"}
        )
    
    def test_get_stock_info(self):
        """Test stock information retrieval."""
        self.collector.call_mcp_tool = Mock(return_value={
            "symbol": "AAPL",
            "longName": "Apple Inc.",
            "currentPrice": 150.00,
            "marketCap": 2500000000000
        })
        
        result = self.collector.get_stock_info("AAPL")
        
        self.assertIsNotNone(result)
        self.assertEqual(result["symbol"], "AAPL")
        self.collector.call_mcp_tool.assert_called_once_with(
            "get_stock_info",
            {"ticker": "AAPL"}
        )
    
    def test_get_financial_statement(self):
        """Test financial statement retrieval."""
        self.collector.call_mcp_tool = Mock(return_value={
            "income_statement": {"revenue": 100000000}
        })
        
        # Test with enum
        result = self.collector.get_financial_statement(
            "AAPL",
            FinancialStatementType.INCOME_STMT
        )
        
        self.assertIsNotNone(result)
        self.collector.call_mcp_tool.assert_called_with(
            "get_financial_statement",
            {"ticker": "AAPL", "financial_type": "income_stmt"}
        )
        
        # Test with string
        result = self.collector.get_financial_statement(
            "AAPL",
            "balance_sheet"
        )
        
        self.collector.call_mcp_tool.assert_called_with(
            "get_financial_statement",
            {"ticker": "AAPL", "financial_type": "balance_sheet"}
        )
    
    def test_get_holder_info(self):
        """Test holder information retrieval."""
        self.collector.call_mcp_tool = Mock(return_value={
            "major_holders": {"insiders": 0.05, "institutions": 0.60}
        })
        
        # Test with enum
        result = self.collector.get_holder_info(
            "AAPL",
            HolderInfoType.MAJOR_HOLDERS
        )
        
        self.assertIsNotNone(result)
        self.collector.call_mcp_tool.assert_called_with(
            "get_holder_info",
            {"ticker": "AAPL", "holder_type": "major_holders"}
        )
    
    def test_get_option_chain(self):
        """Test options chain retrieval."""
        self.collector.call_mcp_tool = Mock(return_value={
            "calls": [{"strike": 150, "bid": 5.0, "ask": 5.1}]
        })
        
        result = self.collector.get_option_chain(
            "AAPL",
            "2024-01-19",
            "calls"
        )
        
        self.assertIsNotNone(result)
        self.collector.call_mcp_tool.assert_called_once_with(
            "get_option_chain",
            {"ticker": "AAPL", "expiration_date": "2024-01-19", "option_type": "calls"}
        )
    
    def test_get_recommendations(self):
        """Test recommendations retrieval."""
        self.collector.call_mcp_tool = Mock(return_value={
            "recommendations": [{"firm": "Morgan Stanley", "rating": "Buy"}]
        })
        
        # Test with enum
        result = self.collector.get_recommendations(
            "AAPL",
            RecommendationType.RECOMMENDATIONS
        )
        
        self.assertIsNotNone(result)
        self.collector.call_mcp_tool.assert_called_with(
            "get_recommendations",
            {"ticker": "AAPL", "recommendation_type": "recommendations"}
        )
        
        # Test upgrades/downgrades with months_back
        result = self.collector.get_recommendations(
            "AAPL",
            "upgrades_downgrades",
            months_back=6
        )
        
        self.collector.call_mcp_tool.assert_called_with(
            "get_recommendations",
            {"ticker": "AAPL", "recommendation_type": "upgrades_downgrades", "months_back": 6}
        )
    
    def test_subscription_tier(self):
        """Test subscription tier is always FREE."""
        self.assertEqual(self.collector.get_subscription_tier(), SubscriptionTier.FREE)
    
    def test_quota_status(self):
        """Test quota status shows unlimited."""
        status = self.collector.check_quota_status()
        
        self.assertIsNone(status['remaining_requests'])
        self.assertIsNone(status['quota_limit'])
        self.assertEqual(status['tier'], 'FREE')
        self.assertEqual(status['status'], 'unlimited')
        self.assertEqual(status['usage_percentage'], 0.0)
    
    def test_api_cost_estimate(self):
        """Test API cost is always zero."""
        # Test various request types
        test_cases = [
            {"data_type": "stock_info"},
            {"data_type": "historical_prices", "period": "1y"},
            {"data_type": "options", "expiration_date": "2024-01-19"},
            {"tools": [{"tool_name": "get_stock_info", "arguments": {}}]}
        ]
        
        for params in test_cases:
            cost = self.collector.get_api_cost_estimate(params)
            self.assertEqual(cost, 0.0, f"Cost should be 0.0 for params: {params}")
    
    def test_collect_data_routing(self):
        """Test data collection routing to appropriate tools."""
        # Mock all tool methods
        self.collector.get_historical_prices = Mock(return_value={"prices": []})
        self.collector.get_stock_info = Mock(return_value={"info": {}})
        self.collector.get_news = Mock(return_value={"news": []})
        self.collector.get_financial_statement = Mock(return_value={"statement": {}})
        self.collector.get_option_expiration_dates = Mock(return_value={"dates": []})
        self.collector.get_option_chain = Mock(return_value={"chain": []})
        self.collector.get_holder_info = Mock(return_value={"holders": {}})
        self.collector.get_recommendations = Mock(return_value={"recommendations": []})
        
        # Test historical prices
        self.collector.collect_data({
            "data_type": "historical_prices",
            "ticker": "AAPL",
            "period": "1mo"
        })
        self.collector.get_historical_prices.assert_called_once()
        
        # Test stock info (default)
        self.collector.collect_data({
            "ticker": "AAPL"
        })
        self.collector.get_stock_info.assert_called()
        
        # Test news
        self.collector.collect_data({
            "data_type": "news",
            "ticker": "AAPL"
        })
        self.collector.get_news.assert_called_once()
        
        # Test financial statement
        self.collector.collect_data({
            "data_type": "financial_statement",
            "ticker": "AAPL",
            "statement_type": "income_stmt"
        })
        self.collector.get_financial_statement.assert_called_once()
        
        # Test options without expiration (gets dates)
        self.collector.collect_data({
            "data_type": "options",
            "ticker": "AAPL"
        })
        self.collector.get_option_expiration_dates.assert_called_once()
        
        # Test options with expiration (gets chain)
        self.collector.collect_data({
            "data_type": "options",
            "ticker": "AAPL",
            "expiration_date": "2024-01-19"
        })
        self.collector.get_option_chain.assert_called_once()
    
    def test_simulate_tool_response(self):
        """Test simulated responses when MCP server is not available."""
        # Force simulation mode
        self.collector.connection_established = False
        self.collector.establish_connection = Mock(return_value=False)
        
        # Test stock info simulation
        result = self.collector.get_stock_info("AAPL")
        self.assertIn("symbol", result)
        self.assertEqual(result["symbol"], "AAPL")
        
        # Test historical prices simulation
        result = self.collector.get_historical_prices("AAPL")
        self.assertIn("data", result)
        self.assertIsInstance(result["data"], list)
        
        # Test option dates simulation
        result = self.collector.get_option_expiration_dates("AAPL")
        self.assertIn("expiration_dates", result)
    
    def test_error_handling(self):
        """Test error handling in data collection."""
        # Mock MCP tool to raise exception
        self.collector.call_mcp_tool = Mock(side_effect=Exception("Test error"))
        
        result = self.collector.collect_data({
            "data_type": "stock_info",
            "ticker": "INVALID"
        })
        
        self.assertIn("error", result)
        self.assertIn("Test error", result["error"])
        self.assertEqual(result["source"], "yahoo_finance")
    
    def test_connection_establishment(self):
        """Test connection establishment logic."""
        with patch.object(self.collector, '_check_server_running') as mock_check:
            # Test when server is already running
            mock_check.return_value = True
            result = self.collector.establish_connection()
            self.assertTrue(result)
            self.assertTrue(self.collector.connection_established)
            
            # Test when server is not running (falls back to simulation)
            mock_check.return_value = False
            self.collector.connection_established = False
            result = self.collector.establish_connection()
            self.assertTrue(result)  # Should still return True with simulated tools
    
    def test_cleanup(self):
        """Test cleanup method."""
        # Mock MCP process
        mock_process = Mock()
        self.collector.mcp_process = mock_process
        self.collector.server_started = True
        
        self.collector.cleanup()
        
        mock_process.terminate.assert_called_once()
        mock_process.wait.assert_called_once_with(timeout=5)
        self.assertIsNone(self.collector.mcp_process)
        self.assertFalse(self.collector.server_started)


class TestYahooFinanceIntegration(unittest.TestCase):
    """Integration tests for Yahoo Finance MCP Collector."""
    
    @patch('subprocess.Popen')
    @patch('requests.get')
    def test_full_workflow(self, mock_requests, mock_subprocess):
        """Test complete workflow from connection to data retrieval."""
        # Setup mocks
        mock_requests.return_value.status_code = 200
        mock_process = Mock()
        mock_subprocess.return_value = mock_process
        
        # Initialize collector
        collector = YahooFinanceMCPCollector()
        
        # Establish connection
        result = collector.establish_connection()
        self.assertTrue(result)
        
        # Test data collection workflow
        test_ticker = "MSFT"
        
        # Get stock info
        collector.call_mcp_tool = Mock(return_value={
            "symbol": test_ticker,
            "longName": "Microsoft Corporation",
            "currentPrice": 400.00
        })
        
        info = collector.get_stock_info(test_ticker)
        self.assertEqual(info["symbol"], test_ticker)
        
        # Get historical prices
        collector.call_mcp_tool = Mock(return_value={
            "data": [{"Date": "2024-01-01", "Close": 400.0}]
        })
        
        prices = collector.get_historical_prices(test_ticker, "1mo", "1d")
        self.assertIn("data", prices)
        
        # Cleanup
        collector.cleanup()


if __name__ == "__main__":
    unittest.main()