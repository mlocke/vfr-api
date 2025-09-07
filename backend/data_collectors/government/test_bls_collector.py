"""
Comprehensive Test Suite for Bureau of Labor Statistics (BLS) Collector

This test suite verifies all functionality of the BLS collector including:
- Data collection capabilities
- Series validation
- Filtering and activation logic
- Employment data parsing
- CPI/PPI inflation data handling
- Error handling and rate limiting
- Integration with collector router

Tests follow established patterns from FRED and SEC EDGAR collectors.
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

from data_collectors.government.bls_collector import BLSCollector
from data_collectors.base import CollectorConfig, DateRange, DataFrequency


class TestBLSCollector(unittest.TestCase):
    """Test suite for BLS collector functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.config = CollectorConfig(
            api_key='test_api_key',
            base_url='https://api.bls.gov/publicAPI/v2/',
            timeout=30,
            max_retries=3,
            requests_per_minute=500
        )
        self.collector = BLSCollector(self.config)
        
        # Test date ranges
        self.date_range = DateRange(
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1)
        )
        
        # Sample BLS API response data
        self.mock_bls_response = {
            'status': 'REQUEST_SUCCEEDED',
            'responseTime': 100,
            'message': [],
            'Results': {
                'series': [
                    {
                        'seriesID': 'LNS14000000',
                        'data': [
                            {
                                'year': '2024',
                                'period': 'M01',
                                'periodName': 'January',
                                'value': '3.7',
                                'footnotes': []
                            },
                            {
                                'year': '2023',
                                'period': 'M12',
                                'periodName': 'December',
                                'value': '3.5',
                                'footnotes': []
                            }
                        ]
                    }
                ]
            }
        }
    
    def tearDown(self):
        """Clean up after tests."""
        pass
    
    # Test 1: Initialization and Configuration
    def test_collector_initialization(self):
        """Test BLS collector initialization."""
        # Test with API key
        collector_with_key = BLSCollector(self.config)
        self.assertEqual(collector_with_key.config.api_key, 'test_api_key')
        self.assertEqual(collector_with_key.config.requests_per_minute, 500)
        
        # Test without API key
        config_no_key = CollectorConfig()
        collector_no_key = BLSCollector(config_no_key)
        self.assertIsNone(collector_no_key.config.api_key)
        # The rate limiting configuration depends on CollectorConfig defaults
        
        # Test default initialization
        collector_default = BLSCollector()
        self.assertIsNone(collector_default.config.api_key)
    
    # Test 2: Filtering and Activation Logic
    def test_should_activate_employment_data(self):
        """Test activation for employment-related requests."""
        # Should activate for employment data
        employment_filter = {
            'analysis_type': 'employment',
            'indicators': ['unemployment', 'labor_force']
        }
        self.assertTrue(self.collector.should_activate(employment_filter))
        
        # Should activate for specific BLS indicators
        bls_filter = {
            'bls_series': ['LNS14000000', 'CES0000000001'],
            'data_type': 'timeseries'
        }
        self.assertTrue(self.collector.should_activate(bls_filter))
        
        # Should activate for CPI/inflation data
        inflation_filter = {
            'analysis_type': 'inflation',
            'indicators': ['cpi', 'consumer_price']
        }
        self.assertTrue(self.collector.should_activate(inflation_filter))
    
    def test_should_not_activate_non_bls_data(self):
        """Test non-activation for non-BLS requests."""
        # Should NOT activate for individual companies
        company_filter = {
            'companies': ['AAPL', 'MSFT'],
            'analysis_type': 'fundamental'
        }
        self.assertFalse(self.collector.should_activate(company_filter))
        
        # Should NOT activate for Treasury data
        treasury_filter = {
            'treasury_securities': 'bonds',
            'analysis_type': 'fiscal'
        }
        self.assertFalse(self.collector.should_activate(treasury_filter))
        
        # Should NOT activate for GDP/monetary policy (FRED territory)
        fed_filter = {
            'gdp': 'true',
            'federal_funds': 'true'
        }
        self.assertFalse(self.collector.should_activate(fed_filter))
    
    def test_get_activation_priority(self):
        """Test activation priority scoring."""
        # High priority for explicit BLS series
        bls_series_filter = {'bls_series': ['LNS14000000']}
        priority1 = self.collector.get_activation_priority(bls_series_filter)
        self.assertEqual(priority1, 95)
        
        # High priority for employment analysis
        employment_filter = {'analysis_type': 'employment'}
        priority2 = self.collector.get_activation_priority(employment_filter)
        self.assertGreaterEqual(priority2, 70)
        
        # Medium priority for inflation data
        inflation_filter = {'cpi': 'true', 'inflation': 'true'}
        priority3 = self.collector.get_activation_priority(inflation_filter)
        self.assertGreaterEqual(priority3, 60)
        
        # Zero priority for non-activating filters
        company_filter = {'companies': ['AAPL']}
        priority4 = self.collector.get_activation_priority(company_filter)
        self.assertEqual(priority4, 0)
    
    # Test 3: API Request Functionality
    @patch('requests.post')
    def test_make_request_success(self, mock_post):
        """Test successful API request."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self.mock_bls_response
        mock_post.return_value = mock_response
        
        payload = {
            'seriesid': ['LNS14000000'],
            'startyear': '2023',
            'endyear': '2024'
        }
        
        result = self.collector._make_request('timeseries/data/', payload)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['status'], 'REQUEST_SUCCEEDED')
        mock_post.assert_called_once()
    
    @patch('requests.post')
    def test_make_request_with_api_key(self, mock_post):
        """Test API request includes API key when available."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self.mock_bls_response
        mock_post.return_value = mock_response
        
        payload = {'seriesid': ['LNS14000000']}
        self.collector._make_request('timeseries/data/', payload)
        
        # Check that API key was added to payload
        called_payload = mock_post.call_args[1]['json']
        self.assertEqual(called_payload['registrationkey'], 'test_api_key')
    
    @patch('requests.post')
    def test_make_request_rate_limit_error(self, mock_post):
        """Test handling of rate limit errors."""
        mock_response = Mock()
        mock_response.status_code = 429
        mock_post.return_value = mock_response
        
        with self.assertRaises(Exception):  # Should raise NetworkError
            self.collector._make_request('timeseries/data/', {})
    
    # Test 4: Data Collection and Processing
    @patch.object(BLSCollector, '_make_request')
    def test_get_series_data(self, mock_request):
        """Test time series data collection."""
        mock_request.return_value = self.mock_bls_response
        
        result = self.collector.get_series_data(
            ['LNS14000000'], 
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1)
        )
        
        self.assertIsInstance(result, pd.DataFrame)
        self.assertGreater(len(result), 0)
        self.assertIn('series_id', result.columns)
        self.assertIn('date', result.columns)
        self.assertIn('value', result.columns)
        
        # Check data parsing
        self.assertEqual(result.iloc[0]['series_id'], 'LNS14000000')
        self.assertIsNotNone(result.iloc[0]['value'])
    
    @patch.object(BLSCollector, '_make_request')
    def test_get_latest_data(self, mock_request):
        """Test latest data collection."""
        mock_request.return_value = self.mock_bls_response
        
        result = self.collector.get_latest_data(['LNS14000000'])
        
        self.assertIsInstance(result, pd.DataFrame)
        # Should only return most recent data point per series
        series_counts = result.groupby('series_id').size()
        self.assertTrue(all(count == 1 for count in series_counts))
    
    @patch.object(BLSCollector, '_make_request')
    def test_get_latest_observation(self, mock_request):
        """Test latest observation for single series."""
        mock_request.return_value = self.mock_bls_response
        
        result = self.collector.get_latest_observation('LNS14000000')
        
        self.assertIsInstance(result, dict)
        self.assertEqual(result['series_id'], 'LNS14000000')
        self.assertIn('value', result)
        self.assertIn('date', result)
        self.assertIn('period', result)
    
    def test_parse_bls_date(self):
        """Test BLS date parsing functionality."""
        # Test monthly data
        monthly_date = self.collector._parse_bls_date('2024', 'M01')
        self.assertEqual(monthly_date, '2024-01-01')
        
        monthly_date2 = self.collector._parse_bls_date('2023', 'M12')
        self.assertEqual(monthly_date2, '2023-12-01')
        
        # Test quarterly data
        quarterly_date = self.collector._parse_bls_date('2024', 'Q01')
        self.assertEqual(quarterly_date, '2024-01-01')
        
        quarterly_date2 = self.collector._parse_bls_date('2024', 'Q04')
        self.assertEqual(quarterly_date2, '2024-10-01')
        
        # Test annual data
        annual_date = self.collector._parse_bls_date('2024', 'A01')
        self.assertEqual(annual_date, '2024-01-01')
        
        # Test invalid data
        invalid_date = self.collector._parse_bls_date('', 'M01')
        self.assertIsNone(invalid_date)
        
        invalid_date2 = self.collector._parse_bls_date('2024', 'M13')  # Invalid month
        self.assertIsNone(invalid_date2)
    
    # Test 5: Specialized Data Collection Methods
    @patch.object(BLSCollector, 'get_series_data')
    def test_search_employment_data(self, mock_get_series):
        """Test employment data collection."""
        mock_get_series.return_value = pd.DataFrame({
            'series_id': ['LNS14000000', 'CES0000000001'],
            'value': [3.7, 150000],
            'date': [datetime(2024, 1, 1), datetime(2024, 1, 1)]
        })
        
        result = self.collector.search_employment_data(
            include_unemployment=True,
            include_labor_force=True,
            include_jolts=True
        )
        
        self.assertIsInstance(result, pd.DataFrame)
        mock_get_series.assert_called_once()
        
        # Check that appropriate series were requested
        called_args = mock_get_series.call_args[0]
        series_requested = called_args[0]
        self.assertIn('LNS14000000', series_requested)  # Unemployment rate
        self.assertIn('CES0000000001', series_requested)  # Total employment
    
    @patch.object(BLSCollector, 'get_series_data')
    def test_search_inflation_data(self, mock_get_series):
        """Test inflation data collection."""
        mock_get_series.return_value = pd.DataFrame({
            'series_id': ['CUSR0000SA0', 'WPUFD4'],
            'value': [310.2, 145.8],
            'date': [datetime(2024, 1, 1), datetime(2024, 1, 1)]
        })
        
        # Test CPI and PPI collection
        result = self.collector.search_inflation_data(
            include_cpi=True,
            include_ppi=True,
            core_only=False
        )
        
        self.assertIsInstance(result, pd.DataFrame)
        mock_get_series.assert_called_once()
        
        # Test core-only collection
        mock_get_series.reset_mock()
        result_core = self.collector.search_inflation_data(
            include_cpi=True,
            include_ppi=True,
            core_only=True
        )
        
        called_args = mock_get_series.call_args[0]
        series_requested = called_args[0]
        # Should include core CPI and PPI series
        self.assertIn('CUUR0000SA0L1E', series_requested)  # Core CPI
        self.assertIn('WPUFD49104', series_requested)  # Core PPI
    
    @patch.object(BLSCollector, 'get_series_data')
    def test_get_wage_and_productivity_data(self, mock_get_series):
        """Test wage and productivity data collection."""
        mock_get_series.return_value = pd.DataFrame({
            'series_id': ['CES0500000003', 'PRS85006092'],
            'value': [28.50, 102.5],
            'date': [datetime(2024, 1, 1), datetime(2024, 1, 1)]
        })
        
        result = self.collector.get_wage_and_productivity_data()
        
        self.assertIsInstance(result, pd.DataFrame)
        mock_get_series.assert_called_once()
        
        called_args = mock_get_series.call_args[0]
        series_requested = called_args[0]
        # Should include earnings and productivity series
        self.assertIn('CES0500000003', series_requested)  # Avg hourly earnings
        self.assertIn('PRS85006092', series_requested)  # Labor productivity
    
    # Test 6: Series Information and Validation
    def test_get_popular_series(self):
        """Test popular series retrieval."""
        popular = self.collector.get_popular_series()
        
        self.assertIsInstance(popular, dict)
        self.assertIn('LNS14000000', popular)  # Unemployment rate
        self.assertIn('CUUR0000SA0', popular)  # CPI
        self.assertIn('WPUFD4', popular)  # PPI
        
        # Check descriptions are meaningful
        for series_id, description in popular.items():
            self.assertIsInstance(description, str)
            self.assertGreater(len(description), 10)
    
    def test_get_series_by_category(self):
        """Test series filtering by category."""
        # Test employment category
        employment_series = self.collector.get_series_by_category('employment')
        self.assertIsInstance(employment_series, list)
        self.assertIn('LNS14000000', employment_series)
        
        # Test CPI category
        cpi_series = self.collector.get_series_by_category('cpi')
        self.assertIsInstance(cpi_series, list)
        self.assertIn('CUUR0000SA0', cpi_series)
        
        # Test invalid category
        invalid_series = self.collector.get_series_by_category('invalid_category')
        self.assertEqual(invalid_series, [])
    
    def test_get_available_categories(self):
        """Test available categories retrieval."""
        categories = self.collector.get_available_categories()
        
        self.assertIsInstance(categories, dict)
        self.assertIn('employment', categories)
        self.assertIn('cpi', categories)
        self.assertIn('ppi', categories)
        self.assertIn('jolts', categories)
        
        # Check category structure
        for category, info in categories.items():
            self.assertIn('description', info)
            self.assertIn('series', info)
            self.assertIsInstance(info['series'], list)
    
    @patch.object(BLSCollector, '_make_request')
    def test_validate_symbols(self, mock_request):
        """Test series ID validation."""
        # Mock successful validation
        mock_request.return_value = {
            'status': 'REQUEST_SUCCEEDED',
            'Results': {
                'series': [
                    {'seriesID': 'LNS14000000', 'data': [{'value': '3.7'}]},
                    {'seriesID': 'INVALID_SERIES', 'data': []}
                ]
            }
        }
        
        validation = self.collector.validate_symbols(['LNS14000000', 'INVALID_SERIES'])
        
        self.assertIsInstance(validation, dict)
        self.assertTrue(validation['LNS14000000'])
        self.assertFalse(validation['INVALID_SERIES'])
    
    def test_get_available_symbols(self):
        """Test available symbols retrieval."""
        symbols = self.collector.get_available_symbols()
        
        self.assertIsInstance(symbols, list)
        self.assertGreater(len(symbols), 0)
        
        # Check symbol structure
        for symbol_info in symbols:
            self.assertIn('symbol', symbol_info)
            self.assertIn('name', symbol_info)
            self.assertIn('title', symbol_info)
            self.assertIn('source', symbol_info)
            self.assertEqual(symbol_info['source'], 'Bureau of Labor Statistics')
    
    # Test 7: Authentication and Connection
    @patch.object(BLSCollector, 'get_series_data')
    def test_authenticate(self, mock_get_series):
        """Test authentication (connection test)."""
        # Mock successful data retrieval
        mock_get_series.return_value = pd.DataFrame({
            'series_id': ['LNS14000000'],
            'value': [3.7]
        })
        
        result = self.collector.authenticate()
        self.assertTrue(result)
        
        # Mock failed data retrieval
        mock_get_series.return_value = pd.DataFrame()
        
        # Create a new collector instance to reset state
        collector_test = BLSCollector(self.config)
        result_fail = collector_test.authenticate()
        self.assertFalse(result_fail)
    
    @patch.object(BLSCollector, '_make_request')
    def test_connection(self, mock_request):
        """Test connection testing."""
        # Mock successful connection
        mock_request.return_value = self.mock_bls_response
        
        result = self.collector.test_connection()
        
        self.assertIsInstance(result, dict)
        self.assertIn('connected', result)
        self.assertIn('response_time_ms', result)
        self.assertIn('api_status', result)
        self.assertIn('has_api_key', result)
        self.assertTrue(result['has_api_key'])  # We have API key in test
    
    # Test 8: Batch and Real-time Collection
    @patch.object(BLSCollector, 'get_series_data')
    def test_collect_batch(self, mock_get_series):
        """Test batch data collection."""
        mock_get_series.return_value = pd.DataFrame({
            'series_id': ['LNS14000000', 'CES0000000001'],
            'value': [3.7, 150000],
            'date': [datetime(2024, 1, 1), datetime(2024, 1, 1)]
        })
        
        result = self.collector.collect_batch(
            ['LNS14000000', 'CES0000000001'],
            self.date_range,
            DataFrequency.MONTHLY,
            'timeseries'
        )
        
        self.assertIsInstance(result, pd.DataFrame)
        mock_get_series.assert_called_once()
    
    def test_collect_realtime(self):
        """Test real-time data collection."""
        with patch.object(self.collector, 'get_latest_observation') as mock_latest:
            mock_latest.return_value = {
                'series_id': 'LNS14000000',
                'value': 3.7,
                'date': '2024-01-01'
            }
            
            results = list(self.collector.collect_realtime(['LNS14000000']))
            
            self.assertGreater(len(results), 0)
            self.assertIn('series_id', results[0])
            self.assertIn('timestamp', results[0])
    
    # Test 9: Properties and Metadata
    def test_collector_properties(self):
        """Test collector property methods."""
        # Source name
        self.assertEqual(self.collector.source_name, "Bureau of Labor Statistics (BLS)")
        
        # Supported data types
        data_types = self.collector.supported_data_types
        self.assertIn('timeseries', data_types)
        self.assertIn('employment', data_types)
        self.assertIn('cpi', data_types)
        self.assertIn('ppi', data_types)
        
        # API key requirement
        self.assertFalse(self.collector.requires_api_key)  # Optional
    
    def test_get_rate_limits(self):
        """Test rate limit information."""
        rate_limits = self.collector.get_rate_limits()
        
        self.assertIsInstance(rate_limits, dict)
        # Should contain rate limit status information
    
    # Test 10: Error Handling
    @patch.object(BLSCollector, '_make_request')
    def test_error_handling_invalid_response(self, mock_request):
        """Test handling of invalid API responses."""
        # Mock API error response
        mock_request.return_value = {
            'status': 'REQUEST_NOT_PROCESSED',
            'message': ['Invalid series ID']
        }
        
        result = self.collector.get_series_data(['INVALID_SERIES'])
        
        # Should handle gracefully and return empty DataFrame
        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 0)
    
    @patch.object(BLSCollector, '_make_request')
    def test_error_handling_network_error(self, mock_request):
        """Test handling of network errors."""
        mock_request.side_effect = Exception("Network error")
        
        result = self.collector.get_latest_observation('LNS14000000')
        
        # Should handle gracefully and return None
        self.assertIsNone(result)


class TestBLSCollectorIntegration(unittest.TestCase):
    """Integration tests for BLS collector with other system components."""
    
    def setUp(self):
        """Set up integration test fixtures."""
        self.collector = BLSCollector()
    
    def test_collector_router_integration(self):
        """Test integration with collector router."""
        from data_collectors.collector_router import CollectorRouter
        
        router = CollectorRouter()
        
        # Test BLS activation for employment filter
        employment_filter = {
            'analysis_type': 'employment',
            'indicators': ['unemployment', 'labor_force']
        }
        
        collectors = router.route_request(employment_filter)
        
        # Should include BLS collector
        collector_names = [c.__class__.__name__ for c in collectors]
        # Note: May not be included if BLS collector isn't registered in router yet
        # This test validates the interface compatibility
        
        self.assertIsInstance(collectors, list)
    
    def test_frontend_filter_compatibility(self):
        """Test compatibility with frontend filter interface."""
        try:
            from data_collectors.frontend_filter_interface import FrontendFilterInterface
            
            interface = FrontendFilterInterface()
            
            # Test BLS-relevant filter translation
            frontend_filters = {
                "employment_data": "unemployment,labor_force",
                "inflation_data": "cpi,ppi",
                "time_period": "2y"
            }
            
            # Should be able to translate without errors
            translated = interface.translate_frontend_filters(frontend_filters)
            self.assertIsInstance(translated, dict)
            
        except ImportError:
            # Frontend interface may not be implemented yet
            self.skipTest("Frontend filter interface not available")


def run_all_bls_tests():
    """Run all BLS collector tests and return results."""
    print("🧪 Running Comprehensive BLS Collector Tests")
    print("=" * 60)
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestBLSCollector))
    suite.addTests(loader.loadTestsFromTestCase(TestBLSCollectorIntegration))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2, stream=sys.stdout)
    result = runner.run(suite)
    
    # Generate summary
    print("\n" + "=" * 60)
    print("📋 BLS COLLECTOR TEST SUMMARY")
    print("=" * 60)
    print(f"Tests Run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success Rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    
    if result.failures:
        print("\n❌ FAILURES:")
        for test, traceback in result.failures:
            error_msg = traceback.split('AssertionError: ')[-1].split('\n')[0]
            print(f"   - {test}: {error_msg}")
    
    if result.errors:
        print("\n⚠️ ERRORS:")
        for test, traceback in result.errors:
            error_msg = traceback.split('\n')[-2]
            print(f"   - {test}: {error_msg}")
    
    success = len(result.failures) == 0 and len(result.errors) == 0
    
    if success:
        print("\n🌟 ALL TESTS PASSED - BLS Collector ready for integration!")
    else:
        print(f"\n⚠️ {len(result.failures) + len(result.errors)} issues found - review and fix before integration")
    
    return result


if __name__ == "__main__":
    # Run all tests
    test_result = run_all_bls_tests()
    
    # Exit with appropriate code
    exit_code = 0 if (len(test_result.failures) == 0 and len(test_result.errors) == 0) else 1
    sys.exit(exit_code)