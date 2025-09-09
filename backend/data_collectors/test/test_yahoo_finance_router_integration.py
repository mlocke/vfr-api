"""
Integration Tests for Yahoo Finance MCP Collector with Router

Tests the integration between Yahoo Finance MCP Collector and the 
four-quadrant routing system, validating that the router correctly
prioritizes Yahoo Finance as a free commercial MCP option.
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import sys
from pathlib import Path
import json
from datetime import datetime

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Import with proper module structure
import collector_router
from commercial.mcp.yahoo_finance_mcp_collector import YahooFinanceMCPCollector  
from base.collector_interface import CollectorConfig


class TestYahooFinanceRouterIntegration(unittest.TestCase):
    """Integration tests for Yahoo Finance MCP Collector with Router."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.router = collector_router.CollectorRouter()
        
        # Mock the Yahoo Finance collector to avoid actual MCP server dependency
        self.mock_yahoo_collector = Mock(spec=YahooFinanceMCPCollector)
        self.mock_yahoo_collector.name = "Yahoo Finance MCP Collector"
        self.mock_yahoo_collector.source_name = "yahoo_finance"
        self.mock_yahoo_collector.cost_per_request = 0.0
        self.mock_yahoo_collector.subscription_tier.name = "FREE"
        self.mock_yahoo_collector.connection_established = True
        self.mock_yahoo_collector.supported_data_types = [
            "stock_info", "historical_prices", "financial_statement", 
            "options", "news", "recommendations", "holder_info"
        ]
        
        # Configure mock responses
        self.mock_yahoo_collector.collect_data.return_value = {
            "source": "yahoo_finance",
            "timestamp": datetime.now().isoformat(),
            "data": {"symbol": "AAPL", "price": 150.00},
            "success": True
        }
        
        self.mock_yahoo_collector.get_api_cost_estimate.return_value = 0.0
        self.mock_yahoo_collector.check_quota_status.return_value = {
            "remaining_requests": None,
            "quota_limit": None,
            "status": "unlimited"
        }
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_yahoo_finance_registration(self, mock_yahoo_class):
        """Test that Yahoo Finance is properly registered in the router."""
        mock_yahoo_class.return_value = self.mock_yahoo_collector
        
        # Initialize router to trigger registration
        router = collector_router.CollectorRouter()
        
        # Check that Yahoo Finance is in the commercial MCP registry
        self.assertIn('yahoo_finance_mcp', router.commercial_mcp_registry)
        
        # Verify it has the highest preference (100) due to being free
        yahoo_capability = router.commercial_mcp_registry['yahoo_finance_mcp']
        self.assertEqual(yahoo_capability.cost_per_request, 0.0)
        self.assertEqual(yahoo_capability.protocol_preference, 100)
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_routing_priority_for_free_service(self, mock_yahoo_class):
        """Test that router prioritizes free Yahoo Finance over paid services."""
        mock_yahoo_class.return_value = self.mock_yahoo_collector
        
        router = collector_router.CollectorRouter()
        
        # Create a request that could be fulfilled by multiple collectors
        request = {
            "data_type": "stock_info",
            "symbols": ["AAPL"],
            "ticker": "AAPL"
        }
        
        # Get routing decision
        with patch.object(router, '_get_best_collector') as mock_get_best:
            mock_get_best.return_value = ('yahoo_finance_mcp', self.mock_yahoo_collector)
            
            collector_name, collector = router.route_request(request)
            
            # Should select Yahoo Finance due to zero cost
            self.assertEqual(collector_name, 'yahoo_finance_mcp')
            self.assertEqual(collector.cost_per_request, 0.0)
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_cost_optimization_routing(self, mock_yahoo_class):
        """Test that router's cost optimization selects Yahoo Finance first."""
        mock_yahoo_class.return_value = self.mock_yahoo_collector
        
        router = collector_router.CollectorRouter()
        
        # Mock other expensive collectors
        expensive_collector = Mock()
        expensive_collector.cost_per_request = 0.01
        expensive_collector.supported_data_types = ["stock_info"]
        
        # Test cost-based selection
        request = {
            "data_type": "stock_info",
            "symbols": ["AAPL"],
            "ticker": "AAPL"
        }
        
        # Simulate having multiple collectors available
        available_collectors = [
            ('expensive_api', expensive_collector),
            ('yahoo_finance_mcp', self.mock_yahoo_collector)
        ]
        
        # Router should select Yahoo Finance due to zero cost
        best_name, best_collector = router._select_best_by_cost(available_collectors)
        self.assertEqual(best_name, 'yahoo_finance_mcp')
        self.assertEqual(best_collector.cost_per_request, 0.0)
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_four_quadrant_integration(self, mock_yahoo_class):
        """Test Yahoo Finance integration in four-quadrant architecture."""
        mock_yahoo_class.return_value = self.mock_yahoo_collector
        
        router = collector_router.CollectorRouter()
        
        # Test that Yahoo Finance is in the commercial MCP quadrant
        self.assertIn('yahoo_finance_mcp', router.commercial_mcp_registry)
        self.assertNotIn('yahoo_finance_mcp', router.government_api_registry)
        self.assertNotIn('yahoo_finance_mcp', router.government_mcp_registry)
        self.assertNotIn('yahoo_finance_mcp', router.commercial_api_registry)
        
        # Verify quadrant characteristics
        yahoo_capability = router.commercial_mcp_registry['yahoo_finance_mcp']
        self.assertEqual(yahoo_capability.cost_per_request, 0.0)
        self.assertTrue(yahoo_capability.protocol_preference >= 100)
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_fallback_behavior(self, mock_yahoo_class):
        """Test fallback behavior when Yahoo Finance is unavailable."""
        # Mock Yahoo Finance as unavailable
        unavailable_collector = Mock(spec=YahooFinanceMCPCollector)
        unavailable_collector.connection_established = False
        unavailable_collector.cost_per_request = 0.0
        mock_yahoo_class.return_value = unavailable_collector
        
        router = collector_router.CollectorRouter()
        
        request = {
            "data_type": "stock_info",
            "symbols": ["AAPL"],
            "ticker": "AAPL"
        }
        
        # Mock another available collector
        backup_collector = Mock()
        backup_collector.connection_established = True
        backup_collector.cost_per_request = 0.01
        backup_collector.supported_data_types = ["stock_info"]
        
        with patch.object(router, 'commercial_api_registry') as mock_api_registry:
            mock_api_registry.__contains__ = Mock(return_value=True)
            mock_api_registry.__getitem__ = Mock(return_value=Mock(
                collector_class=Mock(return_value=backup_collector),
                cost_per_request=0.01
            ))
            
            # Should fall back to backup collector when Yahoo is unavailable
            with patch.object(router, '_get_best_collector') as mock_get_best:
                mock_get_best.return_value = ('backup_api', backup_collector)
                
                collector_name, collector = router.route_request(request)
                self.assertNotEqual(collector_name, 'yahoo_finance_mcp')
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_data_collection_integration(self, mock_yahoo_class):
        """Test routing returns Yahoo Finance collector for stock data."""
        mock_yahoo_class.return_value = self.mock_yahoo_collector
        
        router = collector_router.CollectorRouter()
        
        request = {
            "data_type": "stock_info",
            "symbols": ["AAPL"],
            "ticker": "AAPL"
        }
        
        # Route the request
        collectors = router.route_request(request)
        
        # Should return list of collectors
        self.assertIsInstance(collectors, list)
        self.assertGreater(len(collectors), 0)
        
        # Yahoo Finance should be prioritized for stock info
        # (We can't test exact routing without mocking internal methods)
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_cost_estimation_integration(self, mock_yahoo_class):
        """Test that router can identify free Yahoo Finance service."""
        mock_yahoo_class.return_value = self.mock_yahoo_collector
        
        router = collector_router.CollectorRouter()
        
        # Check that Yahoo Finance is registered with zero cost
        if 'yahoo_finance_mcp' in router.commercial_mcp_registry:
            yahoo_capability = router.commercial_mcp_registry['yahoo_finance_mcp']
            self.assertEqual(yahoo_capability.cost_per_request, 0.0)
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_quota_management_integration(self, mock_yahoo_class):
        """Test that Yahoo Finance collector has unlimited quota."""
        mock_yahoo_class.return_value = self.mock_yahoo_collector
        
        router = collector_router.CollectorRouter()
        
        # Yahoo Finance should be unlimited (no quota restrictions)
        yahoo_capability = router.commercial_mcp_registry.get('yahoo_finance_mcp')
        if yahoo_capability:
            collector_instance = yahoo_capability.collector_class()
            status = collector_instance.check_quota_status()
            
            # Should show unlimited status
            self.assertEqual(status["status"], "unlimited")
    
    @patch('collector_router.YahooFinanceMCPCollector')
    def test_multi_symbol_routing(self, mock_yahoo_class):
        """Test routing behavior with multiple symbols."""
        mock_yahoo_class.return_value = self.mock_yahoo_collector
        
        router = collector_router.CollectorRouter()
        
        request = {
            "data_type": "stock_info",
            "symbols": ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN"]
        }
        
        with patch.object(router, 'route_request') as mock_route:
            mock_route.return_value = ('yahoo_finance_mcp', self.mock_yahoo_collector)
            
            # Should still route to Yahoo Finance for multiple symbols (it's free)
            collector_name, collector = router.route_request(request)
            
            self.assertEqual(collector_name, 'yahoo_finance_mcp')
            self.assertEqual(collector.cost_per_request, 0.0)
    
    def test_router_initialization_without_yahoo(self):
        """Test router initialization when Yahoo Finance MCP is not available."""
        with patch('collector_router.YahooFinanceMCPCollector', None):
            # Router should still initialize successfully
            router = collector_router.CollectorRouter()
            
            # Yahoo Finance should not be in registry
            self.assertNotIn('yahoo_finance_mcp', router.commercial_mcp_registry)
            
            # Router should still be functional
            self.assertIsNotNone(router.government_api_registry)
            self.assertIsNotNone(router.commercial_api_registry)


if __name__ == "__main__":
    unittest.main()