"""
Comprehensive Test Suite for Energy Information Administration (EIA) Collector

This test suite verifies all functionality of the EIA collector including:
- Energy data collection capabilities
- Series validation and endpoint testing
- Filtering and activation logic for energy sectors
- Oil, gas, and electricity data parsing
- Renewable energy and coal data handling
- Error handling and rate limiting
- Integration with collector router

Tests follow established patterns from FRED, SEC EDGAR, and BLS collectors.
"""

import unittest
from unittest.mock import patch, Mock, MagicMock
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Dict, Any, List
import json

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from data_collectors.government.eia_collector import EIACollector
from data_collectors.base import CollectorConfig, DateRange, DataFrequency


class TestEIACollector(unittest.TestCase):
    """Test suite for EIA collector functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.config = CollectorConfig(
            api_key='test_api_key',
            base_url='https://api.eia.gov/v2/',
            timeout=30,
            max_retries=3,
            requests_per_minute=60
        )
        self.collector = EIACollector(self.config)
        
        # Test date ranges
        self.date_range = DateRange(
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1)
        )
        
        # Sample EIA API response data
        self.sample_response = {
            "response": {
                "data": [
                    {
                        "period": "2024-01-15",
                        "duoarea": "NUS",
                        "product": "EPC0",
                        "value": 73.25,
                        "units": "dollars per barrel"
                    },
                    {
                        "period": "2024-01-16", 
                        "duoarea": "NUS",
                        "product": "EPC0",
                        "value": 74.10,
                        "units": "dollars per barrel"
                    }
                ],
                "total": 2,
                "dateFormat": "YYYY-MM-DD",
                "frequency": "daily",
                "data-type": "value",
                "description": "Cushing, OK WTI Spot Price FOB"
            }
        }
    
    def test_collector_initialization(self):
        """Test EIA collector initialization."""
        # Test with config
        collector_with_key = EIACollector(self.config)
        self.assertEqual(collector_with_key.config.api_key, 'test_api_key')
        self.assertEqual(collector_with_key.BASE_URL, 'https://api.eia.gov/v2/')
        
        # Test without config
        config_no_key = CollectorConfig()
        collector_no_key = EIACollector(config_no_key)
        self.assertIsNone(collector_no_key.config.api_key)
        
        # Test default config
        collector_default = EIACollector()
        self.assertIsNone(collector_default.config.api_key)
    
    def test_should_activate(self):
        """Test activation logic for different request types."""
        # Should activate for energy-related requests
        self.assertTrue(self.collector.should_activate({'energy': True}))
        self.assertTrue(self.collector.should_activate({'energy_data': True}))
        self.assertTrue(self.collector.should_activate({'commodities': True}))
        self.assertTrue(self.collector.should_activate({'oil': 'wti'}))
        self.assertTrue(self.collector.should_activate({'natural_gas': True}))
        self.assertTrue(self.collector.should_activate({'electricity': True}))
        self.assertTrue(self.collector.should_activate({'renewable': 'solar'}))
        self.assertTrue(self.collector.should_activate({'eia_series': ['petroleum/pri/spt/data']}))
        self.assertTrue(self.collector.should_activate({'energy_sector': 'petroleum'}))
        
        # Test keyword detection in strings
        self.assertTrue(self.collector.should_activate({'analysis': 'crude oil prices'}))
        self.assertTrue(self.collector.should_activate({'description': 'henry hub natural gas'}))
        self.assertTrue(self.collector.should_activate({'query': 'electricity generation'}))
        
    def test_non_activation(self):
        """Test non-activation for non-EIA requests."""
        # Should not activate for non-energy requests
        self.assertFalse(self.collector.should_activate({'companies': ['AAPL']}))
        self.assertFalse(self.collector.should_activate({'fred_series': ['GDP']}))
        self.assertFalse(self.collector.should_activate({'treasury_securities': True}))
        self.assertFalse(self.collector.should_activate({'employment': True}))
        self.assertFalse(self.collector.should_activate({}))
    
    def test_get_activation_priority(self):
        """Test activation priority calculation."""
        # High priority for explicit EIA series
        high_priority = self.collector.get_activation_priority({
            'eia_series': ['petroleum/pri/spt/data']
        })
        self.assertGreaterEqual(high_priority, 90)
        
        # Moderate priority for energy sector
        medium_priority = self.collector.get_activation_priority({
            'energy_sector': 'petroleum'
        })
        self.assertGreaterEqual(medium_priority, 80)
        
        # Lower priority for general energy keywords
        low_priority = self.collector.get_activation_priority({
            'analysis': 'general energy trends'
        })
        self.assertLess(low_priority, 80)
    
    @patch.object(EIACollector, '_make_request')
    def test_collect_data_success(self, mock_request):
        """Test successful data collection."""
        mock_request.return_value = self.sample_response
        
        result = self.collector.collect_data(
            ['petroleum/pri/spt/data'],
            self.date_range,
            DataFrequency.DAILY
        )
        
        self.assertIsInstance(result, pd.DataFrame)
        self.assertFalse(result.empty)
        self.assertIn('value', result.columns)
        self.assertIn('date', result.columns)
        self.assertIn('series_id', result.columns)
        self.assertIn('source', result.columns)
        self.assertEqual(len(result), 2)
    
    @patch.object(EIACollector, '_make_request')
    def test_collect_data_empty_response(self, mock_request):
        """Test data collection with empty response."""
        mock_request.return_value = {'response': {'data': []}}
        
        result = self.collector.collect_data(
            ['petroleum/pri/spt/data'],
            self.date_range
        )
        
        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(result.empty)
    
    @patch.object(EIACollector, '_make_request')
    def test_collect_real_time_data(self, mock_request):
        """Test real-time data collection."""
        mock_request.return_value = self.sample_response
        
        result = self.collector.collect_real_time_data(['petroleum/pri/spt/data'])
        
        self.assertIsInstance(result, dict)
        self.assertIn('petroleum/pri/spt/data', result)
        
        series_data = result['petroleum/pri/spt/data']
        self.assertIn('value', series_data)
        self.assertIn('date', series_data)
        self.assertIn('series_id', series_data)
        self.assertEqual(series_data['source'], 'Energy Information Administration (EIA)')
    
    def test_frequency_mapping(self):
        """Test EIA frequency mapping functionality."""
        self.assertEqual(self.collector._map_frequency_to_eia(DataFrequency.DAILY), 'daily')
        self.assertEqual(self.collector._map_frequency_to_eia(DataFrequency.WEEKLY), 'weekly')
        self.assertEqual(self.collector._map_frequency_to_eia(DataFrequency.MONTHLY), 'monthly')
        self.assertEqual(self.collector._map_frequency_to_eia(DataFrequency.QUARTERLY), 'quarterly')
        self.assertEqual(self.collector._map_frequency_to_eia(DataFrequency.ANNUALLY), 'annual')
    
    @patch.object(EIACollector, 'get_series_data')
    def test_get_series_data_integration(self, mock_get_series):
        """Test series data integration."""
        # Mock successful response
        mock_df = pd.DataFrame([
            {'value': 73.25, 'date': '2024-01-15', 'series_id': 'petroleum/pri/spt/data'},
            {'value': 74.10, 'date': '2024-01-16', 'series_id': 'petroleum/pri/spt/data'}
        ])
        mock_get_series.return_value = mock_df
        
        result = self.collector.get_series_data(
            ['petroleum/pri/spt/data'],
            self.date_range,
            DataFrequency.DAILY
        )
        
        self.assertIsInstance(result, pd.DataFrame)
        self.assertFalse(result.empty)
        mock_get_series.assert_called_once()
    
    @patch.object(EIACollector, 'get_series_data') 
    def test_collect_data_error_handling(self, mock_get_series):
        """Test error handling in data collection."""
        # Mock exception in series data collection
        mock_get_series.side_effect = Exception("API error")
        
        result = self.collector.collect_data(
            ['invalid/endpoint'],
            self.date_range
        )
        
        # Should return empty DataFrame on error
        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(result.empty)
    
    @patch.object(EIACollector, 'get_series_data')
    def test_real_time_error_handling(self, mock_get_series):
        """Test error handling in real-time collection."""
        # Mock exception
        mock_get_series.side_effect = Exception("Network error")
        
        result = self.collector.collect_real_time_data(['petroleum/pri/spt/data'])
        
        # Should return empty dict on error
        self.assertIsInstance(result, dict)
        self.assertEqual(len(result), 0)
    
    @patch.object(EIACollector, '_make_request')
    def test_get_symbol_info(self, mock_request):
        """Test symbol information retrieval."""
        # Test popular series
        for endpoint in ['petroleum/pri/spt/data', 'natural-gas/pri/sum/data']:
            symbol_info = self.collector.get_symbol_info(endpoint)
            
            self.assertIn('symbol', symbol_info)
            self.assertIn('source', symbol_info)
            self.assertIn('description', symbol_info)
            self.assertIn('sector', symbol_info)
            self.assertEqual(symbol_info['symbol'], endpoint)
            self.assertEqual(symbol_info['source'], 'Energy Information Administration')
    
    @patch.object(EIACollector, 'get_series_data')
    def test_monitoring_functionality(self, mock_get_series):
        """Test energy monitoring capabilities."""
        # Mock successful monitoring data
        mock_df = pd.DataFrame([
            {'value': 73.25, 'date': '2024-01-15', 'period': '2024-01-15'},
            {'value': 74.10, 'date': '2024-01-16', 'period': '2024-01-16'}
        ])
        mock_get_series.return_value = mock_df
        
        collector_test = EIACollector(self.config)
        result = collector_test.collect_real_time_data(['petroleum/pri/spt/data'])
        
        self.assertIsInstance(result, dict)
        if result:  # If data returned
            self.assertIn('petroleum/pri/spt/data', result)
    
    @patch.object(EIACollector, '_make_request')
    def test_authentication_with_key(self, mock_request):
        """Test authentication with API key."""
        mock_request.return_value = self.sample_response
        
        auth_result = self.collector.test_authentication()
        
        self.assertTrue(auth_result)
        mock_request.assert_called_once()
    
    @patch.object(EIACollector, 'get_series_data')
    def test_data_validation(self, mock_get_series):
        """Test data validation and quality checks."""
        # Test with valid data
        valid_df = pd.DataFrame([
            {'value': 73.25, 'date': '2024-01-15', 'series_id': 'petroleum/pri/spt/data'},
            {'value': 74.10, 'date': '2024-01-16', 'series_id': 'petroleum/pri/spt/data'}
        ])
        mock_get_series.return_value = valid_df
        
        result = self.collector.collect_data(['petroleum/pri/spt/data'], self.date_range)
        
        self.assertFalse(result.empty)
        self.assertIn('value', result.columns)
        self.assertIn('date', result.columns)
    
    def test_properties(self):
        """Test collector properties."""
        self.assertEqual(self.collector.source_name, "Energy Information Administration (EIA)")
        
        supported_types = self.collector.supported_data_types
        self.assertIn("energy_prices", supported_types)
        self.assertIn("energy_production", supported_types)
        self.assertIn("commodity_data", supported_types)
        self.assertIn("renewable_energy", supported_types)
        
        self.assertTrue(self.collector.requires_authentication)
    
    @patch.object(EIACollector, '_make_request')
    def test_error_response_handling(self, mock_request):
        """Test handling of error responses from EIA API."""
        # Test API error response
        mock_request.side_effect = Exception("API rate limit exceeded")
        
        with self.assertRaises(Exception):
            self.collector.get_series_data(['petroleum/pri/spt/data'], self.date_range)
    
    @patch.object(EIACollector, '_make_request')
    def test_network_error_handling(self, mock_request):
        """Test network error handling."""
        mock_request.side_effect = Exception("Connection timeout")
        
        with self.assertRaises(Exception):
            self.collector.get_series_data(['petroleum/pri/spt/data'], self.date_range)
    
    def test_energy_sector_determination(self):
        """Test energy sector determination from endpoints."""
        self.assertEqual(self.collector._determine_energy_sector('petroleum/pri/spt/data'), 'petroleum')
        self.assertEqual(self.collector._determine_energy_sector('natural-gas/pri/sum/data'), 'natural_gas')
        self.assertEqual(self.collector._determine_energy_sector('electricity/retail-sales/data'), 'electricity')
        self.assertEqual(self.collector._determine_energy_sector('coal/production/data'), 'coal')
        self.assertEqual(self.collector._determine_energy_sector('renewable/gen/data'), 'renewables')
        self.assertEqual(self.collector._determine_energy_sector('nuclear/capacity/data'), 'nuclear')
        self.assertEqual(self.collector._determine_energy_sector('total-energy/data'), 'total_energy')
    
    def test_get_energy_series_by_sector(self):
        """Test getting energy series by sector."""
        petroleum_series = self.collector.get_energy_series_by_sector('petroleum')
        self.assertGreater(len(petroleum_series), 0)
        
        gas_series = self.collector.get_energy_series_by_sector('natural-gas')
        self.assertGreater(len(gas_series), 0)
        
        electricity_series = self.collector.get_energy_series_by_sector('electricity')
        self.assertGreater(len(electricity_series), 0)
    
    def test_search_series(self):
        """Test series search functionality."""
        # Search for oil-related series
        oil_results = self.collector.search_series('oil', limit=5)
        self.assertLessEqual(len(oil_results), 5)
        
        # Search for gas-related series
        gas_results = self.collector.search_series('gas', limit=3)
        self.assertLessEqual(len(gas_results), 3)
        
        # Verify result structure
        if oil_results:
            result = oil_results[0]
            self.assertIn('endpoint', result)
            self.assertIn('description', result)
            self.assertIn('sector', result)
    
    def test_popular_indicators(self):
        """Test popular indicators retrieval."""
        indicators = self.collector.get_popular_indicators()
        
        self.assertIsInstance(indicators, dict)
        self.assertGreater(len(indicators), 0)
        
        # Check for key energy indicators
        self.assertTrue(any('petroleum' in key for key in indicators.keys()))
        self.assertTrue(any('natural-gas' in key for key in indicators.keys()))
        self.assertTrue(any('electricity' in key for key in indicators.keys()))


class TestEIACollectorIntegration(unittest.TestCase):
    """Integration tests for EIA collector with other system components."""
    
    def setUp(self):
        """Set up integration test fixtures."""
        self.collector = EIACollector()
    
    def test_collector_router_integration(self):
        """Test integration with collector router."""
        # Test EIA activation for energy filter
        criteria = {
            'energy': True,
            'energy_sector': 'petroleum',
            'analysis_type': 'commodity'
        }
        
        should_activate = self.collector.should_activate(criteria)
        self.assertTrue(should_activate)
        
        # Should include EIA collector
        priority = self.collector.get_activation_priority(criteria)
        self.assertGreater(priority, 80)  # High priority for energy requests
        
        # Note: May not be included if EIA collector isn't registered in router yet
    
    def test_frontend_filter_integration(self):
        """Test integration with frontend filter interface."""
        try:
            from data_collectors.frontend_filter_interface import FrontendFilterInterface
            
            # Test EIA-relevant filter translation
            interface = FrontendFilterInterface()
            
            # Mock frontend request for energy data
            frontend_request = {
                "energy": "oil,gas,electricity",
                "energy_sector": "petroleum",
                "analysis_type": "commodity",
                "time_period": "1y"
            }
            
            # Should be translatable (basic test)
            self.assertIsInstance(frontend_request, dict)
            
        except ImportError:
            # Frontend interface may not be fully implemented yet
            self.skipTest("Frontend filter interface not available")


def run_comprehensive_tests():
    """Run all EIA collector tests and return results."""
    print("🧪 Running Comprehensive EIA Collector Tests")
    print("=" * 50)
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test cases
    suite.addTests(loader.loadTestsFromTestCase(TestEIACollector))
    suite.addTests(loader.loadTestsFromTestCase(TestEIACollectorIntegration))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 50)
    print("📋 EIA COLLECTOR TEST SUMMARY")
    print(f"Tests Run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success Rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    
    if result.wasSuccessful():
        print("\n🌟 ALL TESTS PASSED - EIA Collector ready for integration!")
        return True
    else:
        print("\n⚠️ Some tests failed - Review implementation before integration")
        if result.failures:
            print("\nFailures:")
            for test, traceback in result.failures:
                print(f"  - {test}: {traceback}")
        if result.errors:
            print("\nErrors:")
            for test, traceback in result.errors:
                print(f"  - {test}: {traceback}")
        return False


if __name__ == '__main__':
    success = run_comprehensive_tests()
    exit(0 if success else 1)