"""
Comprehensive test suite for FDIC BankFind Suite API Collector.

Tests cover:
1. Collector activation logic and priority scoring
2. Banking data collection and processing
3. Bank health scoring and risk assessment
4. Regional and systematic analysis capabilities
5. API integration and error handling
6. Filter validation and data quality
"""

import pytest
import pandas as pd
from datetime import datetime, date, timedelta
from unittest.mock import Mock, patch, MagicMock
import json

from fdic_collector import FDICCollector
from ..base import CollectorConfig, DateRange, DataFrequency


class TestFDICCollectorActivation:
    """Test FDIC collector activation logic and priority scoring."""
    
    @pytest.fixture
    def collector(self):
        """Create FDIC collector for testing."""
        config = CollectorConfig(
            timeout=30,
            max_retries=3,
            rate_limit_enabled=False  # Disable for testing
        )
        return FDICCollector(config)
    
    def test_should_activate_banking_requests(self, collector):
        """Test activation for banking-specific requests."""
        # Banking sector analysis should activate
        banking_criteria = {
            'banking_sector': 'analysis',
            'analysis_type': 'banking'
        }
        assert collector.should_activate(banking_criteria) == True
        
        # Bank health analysis should activate
        health_criteria = {
            'bank_health': 'scoring',
            'region': 'California'
        }
        assert collector.should_activate(health_criteria) == True
        
        # Financial institution analysis should activate
        institution_criteria = {
            'institution_analysis': True,
            'banking_market': 'competition'
        }
        assert collector.should_activate(institution_criteria) == True
    
    def test_should_skip_company_analysis(self, collector):
        """Test that collector skips individual company analysis."""
        # Individual company analysis should not activate
        company_criteria = {
            'companies': ['AAPL', 'MSFT'],
            'analysis_type': 'fundamental'
        }
        assert collector.should_activate(company_criteria) == False
        
        # Small company groups should not activate
        small_group_criteria = {
            'companies': ['JPM', 'BAC', 'WFC'],  # 3 companies
            'analysis_type': 'comparison'
        }
        assert collector.should_activate(small_group_criteria) == False
    
    def test_should_skip_economic_indicators(self, collector):
        """Test that collector skips economic indicator requests."""
        # GDP analysis should not activate (BEA territory)
        gdp_criteria = {
            'gdp': 'quarterly_analysis',
            'economic_indicators': ['GDP', 'UNRATE']
        }
        assert collector.should_activate(gdp_criteria) == False
        
        # Federal funds rate should not activate (FRED territory)
        fed_criteria = {
            'federal_funds': 'analysis',
            'monetary_policy': 'rates'
        }
        assert collector.should_activate(fed_criteria) == False
    
    def test_should_skip_treasury_data(self, collector):
        """Test that collector skips Treasury data requests."""
        # Treasury securities should not activate
        treasury_criteria = {
            'treasury': 'bonds',
            'yield_curve': 'analysis'
        }
        assert collector.should_activate(treasury_criteria) == False
        
        # Federal debt should not activate (Treasury Fiscal territory)
        debt_criteria = {
            'federal_debt': 'analysis',
            'government_spending': 'trends'
        }
        assert collector.should_activate(debt_criteria) == False
    
    def test_activation_priority_scoring(self, collector):
        """Test priority scoring for different request types."""
        # Very high priority for explicit banking sector requests
        banking_criteria = {
            'banking_sector': 'analysis',
            'bank_health': 'scoring'
        }
        priority = collector.get_activation_priority(banking_criteria)
        assert priority >= 85, f"Expected priority >= 85, got {priority}"
        
        # High priority for banking analysis
        analysis_criteria = {
            'analysis_type': 'banking',
            'institution_analysis': True
        }
        priority = collector.get_activation_priority(analysis_criteria)
        assert priority >= 80, f"Expected priority >= 80, got {priority}"
        
        # Zero priority for non-banking requests
        company_criteria = {
            'companies': ['AAPL'],
            'analysis_type': 'fundamental'
        }
        priority = collector.get_activation_priority(company_criteria)
        assert priority == 0, f"Expected priority 0, got {priority}"
    
    def test_priority_keyword_matching(self, collector):
        """Test priority increases with banking-related keywords."""
        # Multiple banking keywords should increase priority
        multi_keyword_criteria = {
            'request': 'analyze banking sector financial institutions regulatory status',
            'region': 'California'
        }
        
        base_criteria = {
            'region': 'California'
        }
        
        # Should activate for both but with different priorities
        assert collector.should_activate(multi_keyword_criteria) == True
        assert collector.should_activate(base_criteria) == False  # No banking keywords
        
        multi_priority = collector.get_activation_priority(multi_keyword_criteria)
        assert multi_priority > 60, f"Expected priority > 60 for multiple keywords, got {multi_priority}"


class TestFDICDataCollection:
    """Test FDIC data collection and processing capabilities."""
    
    @pytest.fixture
    def collector(self):
        """Create FDIC collector for testing."""
        config = CollectorConfig(rate_limit_enabled=False)
        return FDICCollector(config)
    
    @pytest.fixture
    def mock_api_response(self):
        """Mock FDIC API response data."""
        return {
            'data': [
                {
                    'NAME': 'Test Community Bank',
                    'CERT': '12345',
                    'STALP': 'CA',
                    'CITY': 'San Francisco',
                    'STNAME': 'California',
                    'ASSET': 1500,  # $1.5B assets
                    'DEP': 1200,    # $1.2B deposits
                    'ROA': 1.2,     # 1.2% ROA
                    'ROE': 12.5,    # 12.5% ROE
                    'NETINC': 18,   # $18M net income
                    'EQ': 150,      # $150M equity
                    'ACTIVE': 1
                },
                {
                    'NAME': 'Regional Banking Corp',
                    'CERT': '67890',
                    'STALP': 'NY',
                    'CITY': 'New York',
                    'STNAME': 'New York',
                    'ASSET': 25000,  # $25B assets
                    'DEP': 20000,    # $20B deposits
                    'ROA': 0.8,      # 0.8% ROA
                    'ROE': 8.5,      # 8.5% ROE
                    'NETINC': 200,   # $200M net income
                    'EQ': 2500,      # $2.5B equity
                    'ACTIVE': 1
                }
            ],
            'meta': {
                'total': 2,
                'count': 2
            }
        }
    
    @patch('requests.Session.get')
    def test_get_institutions_basic(self, mock_get, collector, mock_api_response):
        """Test basic institution data retrieval."""
        # Mock API response
        mock_response = Mock()
        mock_response.json.return_value = mock_api_response
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        # Test data collection
        result = collector.get_institutions(limit=10)
        
        # Verify API call
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        assert 'limit' in call_args[1]['params']
        assert call_args[1]['params']['limit'] == 10
        
        # Verify result structure
        assert 'data' in result
        assert 'meta' in result
        assert len(result['data']) == 2
        
        # Verify institution data
        institution = result['data'][0]
        assert institution['NAME'] == 'Test Community Bank'
        assert institution['CERT'] == '12345'
        assert institution['STALP'] == 'CA'
    
    @patch('requests.Session.get')
    def test_get_institutions_with_filters(self, mock_get, collector, mock_api_response):
        """Test institution data retrieval with filters."""
        mock_response = Mock()
        mock_response.json.return_value = mock_api_response
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        # Test with state filter
        result = collector.get_institutions(filters='STNAME:California', limit=50)
        
        # Verify filter parameter passed to API
        call_args = mock_get.call_args
        assert call_args[1]['params']['filters'] == 'STNAME:California'
        assert call_args[1]['params']['limit'] == 50
    
    def test_filter_by_bank_characteristics(self, collector):
        """Test bank characteristic filtering logic."""
        # Test community bank filter
        community_filter = collector.filter_by_bank_characteristics(size='community')
        assert 'ASSET:[0 TO 10000]' in community_filter
        
        # Test regional bank filter
        regional_filter = collector.filter_by_bank_characteristics(size='regional')
        assert 'ASSET:[10000 TO 50000]' in regional_filter
        
        # Test large bank filter
        large_filter = collector.filter_by_bank_characteristics(size='large')
        assert 'ASSET:[50000 TO *]' in large_filter
        
        # Test geographic filter
        geo_filter = collector.filter_by_bank_characteristics(geography='CA')
        assert 'California' in geo_filter or 'STALP:CA' in geo_filter
        
        # Test combined filters
        combined_filter = collector.filter_by_bank_characteristics(
            size='community', 
            geography='Texas',
            specialty='commercial'
        )
        assert 'ASSET:[0 TO 10000]' in combined_filter
        assert 'Texas' in combined_filter
        assert 'CB:1' in combined_filter


class TestBankHealthAnalysis:
    """Test bank health scoring and risk assessment capabilities."""
    
    @pytest.fixture
    def collector(self):
        """Create FDIC collector for testing."""
        config = CollectorConfig(rate_limit_enabled=False)
        return FDICCollector(config)
    
    @pytest.fixture
    def sample_institutions(self):
        """Sample institution data for health analysis testing."""
        return [
            {
                'NAME': 'Healthy Community Bank',
                'CERT': '11111',
                'STALP': 'CA',
                'CITY': 'Los Angeles',
                'ASSET': 2000,    # $2B assets
                'ROA': 1.5,       # Strong ROA
                'ROE': 15.0,      # Strong ROE
                'NETINC': 30,     # $30M net income
                'EQ': 250,        # $250M equity (12.5% ratio)
                'ACTIVE': 1
            },
            {
                'NAME': 'Struggling Regional Bank',
                'CERT': '22222',
                'STALP': 'NY',
                'CITY': 'Buffalo',
                'ASSET': 15000,   # $15B assets
                'ROA': -0.2,      # Negative ROA
                'ROE': -2.5,      # Negative ROE
                'NETINC': -30,    # -$30M net income (loss)
                'EQ': 750,        # $750M equity (5% ratio)
                'ACTIVE': 1
            },
            {
                'NAME': 'Average State Bank',
                'CERT': '33333',
                'STALP': 'TX',
                'CITY': 'Dallas',
                'ASSET': 5000,    # $5B assets
                'ROA': 0.8,       # Moderate ROA
                'ROE': 8.0,       # Moderate ROE
                'NETINC': 40,     # $40M net income
                'EQ': 400,        # $400M equity (8% ratio)
                'ACTIVE': 1
            }
        ]
    
    def test_calculate_bank_health_score(self, collector, sample_institutions):
        """Test individual bank health score calculation."""
        # Test healthy bank
        healthy_bank = sample_institutions[0]
        health_score = collector._calculate_bank_health_score(healthy_bank)
        
        assert health_score is not None
        assert health_score['institution_name'] == 'Healthy Community Bank'
        assert health_score['cert_id'] == '11111'
        assert health_score['composite_score'] is not None
        assert health_score['risk_category'] == 'Low Risk' or health_score['risk_category'] == 'Moderate Risk'
        
        # Verify financial metrics
        metrics = health_score['financial_metrics']
        assert metrics['roa'] == 1.5
        assert metrics['roe'] == 15.0
        assert metrics['equity_ratio'] == 12.5  # 250/2000 * 100
        
        # Test struggling bank
        struggling_bank = sample_institutions[1]
        struggling_score = collector._calculate_bank_health_score(struggling_bank)
        
        assert struggling_score is not None
        assert struggling_score['composite_score'] > health_score['composite_score']  # Higher score = more risk
        assert 'High Risk' in struggling_score['risk_category'] or 'Critical Risk' in struggling_score['risk_category']
    
    def test_health_score_components(self, collector, sample_institutions):
        """Test CAMELS component scoring logic."""
        healthy_bank = sample_institutions[0]
        health_score = collector._calculate_bank_health_score(healthy_bank)
        
        components = health_score['camels_components']
        
        # Verify component scores are within valid range (1-5)
        for component, score in components.items():
            assert 1 <= score <= 5, f"Component {component} score {score} out of range"
        
        # Healthy bank should have good component scores (1-2)
        assert components.get('capital', 5) <= 2, "Healthy bank should have good capital score"
        assert components.get('earnings', 5) <= 2, "Healthy bank should have good earnings score"
    
    @patch('fdic_collector.FDICCollector.get_institutions')
    def test_get_bank_health_analysis(self, mock_get_institutions, collector, sample_institutions):
        """Test comprehensive bank health analysis."""
        # Mock the institutions data
        mock_get_institutions.return_value = {
            'data': sample_institutions,
            'meta': {'total': 3}
        }
        
        # Test health analysis
        result = collector.get_bank_health_analysis(region='California')
        
        # Verify analysis structure
        assert 'total_institutions' in result
        assert 'health_scores' in result
        assert 'summary_statistics' in result
        assert 'risk_assessment' in result
        
        assert result['total_institutions'] == 3
        assert len(result['health_scores']) <= 3  # Some may fail processing
        
        # Verify summary statistics
        if result['health_scores']:
            summary = result['summary_statistics']
            assert 'total_analyzed' in summary
            assert 'average_score' in summary
            assert 'risk_distribution' in summary
            assert 'healthy_institutions' in summary
            assert 'at_risk_institutions' in summary
    
    def test_systematic_risk_assessment(self, collector, sample_institutions):
        """Test systematic risk assessment logic."""
        # Create health scores from sample institutions
        health_scores = []
        for institution in sample_institutions:
            score = collector._calculate_bank_health_score(institution)
            if score:
                health_scores.append(score)
        
        # Test systematic risk assessment
        risk_assessment = collector._assess_systematic_risk(health_scores)
        
        assert 'system_health_assessment' in risk_assessment
        assert 'high_risk_percentage' in risk_assessment
        assert 'geographic_concentration' in risk_assessment
        assert 'risk_indicators' in risk_assessment
        
        # Verify risk indicators
        indicators = risk_assessment['risk_indicators']
        assert indicators['institutions_analyzed'] == len(health_scores)
        assert 'high_risk_institutions' in indicators
        assert 'geographic_diversity' in indicators
        assert 'average_risk_score' in indicators


class TestFDICCollectorIntegration:
    """Test FDIC collector integration with routing system and error handling."""
    
    @pytest.fixture
    def collector(self):
        """Create FDIC collector for testing."""
        config = CollectorConfig(rate_limit_enabled=False)
        return FDICCollector(config)
    
    def test_collector_properties(self, collector):
        """Test collector property implementations."""
        assert collector.source_name == "Federal Deposit Insurance Corporation (FDIC)"
        assert collector.requires_api_key == False
        assert collector.requires_authentication == False
        
        supported_types = collector.supported_data_types
        assert "banking_institutions" in supported_types
        assert "bank_financials" in supported_types
        assert "bank_failures" in supported_types
        assert "regulatory_status" in supported_types
    
    @patch('requests.Session.get')
    def test_test_authentication(self, mock_get, collector):
        """Test authentication/connection testing."""
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {'data': [], 'meta': {'total': 0}}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        result = collector.test_authentication()
        assert result == True
        
        # Verify API call was made
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        assert 'institutions' in call_args[0][0]  # URL contains 'institutions'
    
    @patch('requests.Session.get')
    def test_test_connection(self, mock_get, collector):
        """Test connection testing method."""
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {'data': [], 'meta': {'total': 0}}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        result = collector.test_connection()
        
        assert result['status'] == 'success'
        assert result['source'] == collector.source_name
        assert 'timestamp' in result
        assert result['requires_auth'] == False
    
    def test_get_rate_limits(self, collector):
        """Test rate limit information."""
        limits = collector.get_rate_limits()
        
        assert limits['source'] == collector.source_name
        assert limits['has_limits'] == False  # FDIC API has no explicit limits
        assert 'message' in limits
    
    def test_validate_symbols(self, collector):
        """Test symbol validation logic."""
        test_symbols = [
            '12345',  # Valid CERT ID
            '67890',  # Valid CERT ID  
            'First National Bank',  # Valid bank name
            'XYZ',    # Invalid (too short)
            '123'     # Invalid (too short for CERT)
        ]
        
        validation_results = collector.validate_symbols(test_symbols)
        
        assert validation_results['12345'] == True
        assert validation_results['67890'] == True
        assert validation_results['First National Bank'] == True
        assert validation_results['XYZ'] == False
        assert validation_results['123'] == False
    
    @patch('requests.Session.get')
    def test_get_available_symbols(self, mock_get, collector):
        """Test getting available banking institutions as symbols."""
        # Mock API response
        mock_response = Mock()
        mock_response.json.return_value = {
            'data': [
                {
                    'CERT': '12345',
                    'NAME': 'Test Bank',
                    'STALP': 'CA',
                    'CITY': 'San Francisco'
                }
            ]
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        symbols = collector.get_available_symbols()
        
        assert len(symbols) == 1
        symbol = symbols[0]
        assert symbol['symbol'] == '12345'
        assert symbol['name'] == 'Test Bank'
        assert symbol['state'] == 'CA'
        assert symbol['type'] == 'FDIC_INSTITUTION'
    
    def test_safe_float_conversion(self, collector):
        """Test safe float conversion utility."""
        assert collector._safe_float(1.5) == 1.5
        assert collector._safe_float('2.5') == 2.5
        assert collector._safe_float('0') == 0.0
        assert collector._safe_float(None) is None
        assert collector._safe_float('') is None
        assert collector._safe_float('NULL') is None
        assert collector._safe_float('invalid') is None
    
    def test_state_name_mapping(self, collector):
        """Test state code to name mapping."""
        assert collector._get_state_name('CA') == 'California'
        assert collector._get_state_name('NY') == 'New York'
        assert collector._get_state_name('TX') == 'Texas'
        assert collector._get_state_name('ZZ') is None  # Invalid state code


class TestFDICErrorHandling:
    """Test FDIC collector error handling and edge cases."""
    
    @pytest.fixture
    def collector(self):
        """Create FDIC collector for testing."""
        config = CollectorConfig(rate_limit_enabled=False, max_retries=1)
        return FDICCollector(config)
    
    @patch('requests.Session.get')
    def test_api_error_handling(self, mock_get, collector):
        """Test handling of API errors."""
        # Mock API error response
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("404 Not Found")
        mock_get.return_value = mock_response
        
        # Should handle error gracefully
        with pytest.raises(requests.exceptions.HTTPError):
            collector.get_institutions()
    
    @patch('requests.Session.get')
    def test_network_error_handling(self, mock_get, collector):
        """Test handling of network errors."""
        # Mock network error
        mock_get.side_effect = requests.exceptions.ConnectionError("Network error")
        
        # Should handle network error gracefully
        with pytest.raises(requests.exceptions.ConnectionError):
            collector.get_institutions()
    
    def test_invalid_institution_data_handling(self, collector):
        """Test handling of invalid or incomplete institution data."""
        # Test with missing required fields
        invalid_institution = {
            'NAME': 'Test Bank',
            # Missing CERT, financial metrics, etc.
        }
        
        # Should return None for invalid data
        result = collector._calculate_bank_health_score(invalid_institution)
        # Should still return basic info even with missing financial data
        assert result is None or result['composite_score'] is None
    
    def test_empty_health_analysis(self, collector):
        """Test health analysis with no valid institutions."""
        # Test with empty health scores
        empty_analysis = collector._calculate_health_summary([])
        assert 'error' in empty_analysis
        
        empty_risk = collector._assess_systematic_risk([])
        assert 'error' in empty_risk


# Integration test that could be run against actual API (if needed)
class TestFDICRealAPIIntegration:
    """Optional integration tests against real FDIC API (commented out by default)."""
    
    @pytest.mark.skip(reason="Integration test - uncomment to run against real API")
    def test_real_api_connection(self):
        """Test connection to real FDIC API."""
        collector = FDICCollector()
        
        # Test basic connection
        result = collector.test_authentication()
        assert result == True
        
        # Test basic data retrieval
        data = collector.get_institutions(limit=5)
        assert 'data' in data
        assert len(data['data']) <= 5
    
    @pytest.mark.skip(reason="Integration test - uncomment to run against real API") 
    def test_real_health_analysis(self):
        """Test health analysis with real data."""
        collector = FDICCollector()
        
        # Test regional analysis
        result = collector.get_bank_health_analysis(region='CA')
        assert 'total_institutions' in result
        assert result['total_institutions'] > 0


if __name__ == '__main__':
    # Run tests
    pytest.main([__file__, '-v'])