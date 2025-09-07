"""
Bureau of Economic Analysis (BEA) Data Collector

Collects comprehensive economic data from the U.S. Bureau of Economic Analysis API,
including GDP components, regional economic data, and industry-specific metrics.

Data Sources:
- NIPA (National Income and Product Accounts) - GDP, personal income, consumption
- GDPByIndustry - Value added, gross output by industry
- Regional - State/county/metro income, employment, GDP by geography
- International - Trade, investment position, multinational enterprises
- Fixed Assets - Investment and capital stock data

API Documentation: https://apps.bea.gov/API/docs/index.htm
Rate Limits: No explicit limits (reasonable use expected)
Authentication: UserID (36-character API key) required
Data Format: JSON (default) or XML

Key Economic Data Available:
- GDP components and industry breakdowns
- Regional economic indicators by state/metro
- Personal income and consumption data
- International trade and investment flows
- Industry-specific economic performance
"""

import pandas as pd
import requests
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Iterator, Optional, Union
from urllib.parse import urljoin, urlencode
import time
import json
import logging

from ..base import (
    DataCollectorInterface, 
    CollectorConfig, 
    DateRange, 
    DataFrequency,
    RateLimiter, 
    RateLimitConfig,
    ErrorHandler,
    RetryConfig,
    with_error_handling,
    NetworkError,
    AuthenticationError,
    DataValidationError
)

logger = logging.getLogger(__name__)

class BEACollector(DataCollectorInterface):
    """
    Bureau of Economic Analysis (BEA) API collector for comprehensive economic data.
    
    Specializes in GDP analysis, regional economics, and industry-specific metrics.
    Activates for economic analysis, GDP requests, regional data, and industry analysis.
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None, api_key: Optional[str] = None):
        """Initialize BEA collector."""
        if config is None:
            config = CollectorConfig()
            config.base_url = "https://apps.bea.gov/api/data/"
            config.timeout = 30
            config.user_agent = "StockPicker/1.0 BEA Economic Collector"
        
        self.config = config
        self.api_key = api_key or "D905F9EE-0E78-4B3E-98AC-B5A61A643723"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': self.config.user_agent,
            'Accept': 'application/json'
        })
        
        # Rate limiter (conservative approach - no official limits)
        self.rate_limiter = RateLimiter(
            RateLimitConfig(
                requests_per_second=2,
                requests_per_minute=120,
                requests_per_hour=7200
            )
        )
        
        # Available datasets for economic data
        self.datasets = {
            'nipa': 'NIPA',              # National Income and Product Accounts
            'gdp_by_industry': 'GDPbyIndustry',  # GDP by Industry
            'regional': 'Regional',       # Regional Income/Product (deprecated, use RegionalIncome/RegionalProduct)
            'regional_income': 'RegionalIncome',  # State/metro income data
            'regional_product': 'RegionalProduct',  # State/metro GDP data
            'international': 'ITA',       # International Transactions
            'investment_position': 'IIP', # International Investment Position
            'fixed_assets': 'FixedAssets', # Fixed Assets
            'input_output': 'InputOutput', # Input-Output tables
            'multinational': 'MNE',       # Multinational Enterprises
            'services_trade': 'IntlServTrade'  # International Services Trade
        }
        
        # Key NIPA tables for financial analysis
        self.nipa_tables = {
            'gdp_summary': 'T10101',      # Gross Domestic Product
            'gdp_components': 'T10105',   # GDP components
            'personal_income': 'T20100',  # Personal Income and Outlays
            'personal_consumption': 'T20804',  # Personal Consumption Expenditures
            'corporate_profits': 'T60900',  # Corporate Profits
            'government_receipts': 'T30100',  # Government Current Receipts
            'government_expenditures': 'T30200'  # Government Current Expenditures
        }
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if BEA collector should handle the request.
        
        Activates for:
        - GDP analysis requests
        - Regional economic data
        - Industry analysis
        - Economic indicators beyond FRED scope
        - Trade and international data
        """
        # Check for BEA-specific request patterns
        bea_indicators = [
            'gdp', 'nipa', 'regional', 'industry_gdp', 'personal_income',
            'consumption', 'trade_balance', 'investment_position',
            'regional_economy', 'state_gdp', 'metro_gdp', 'industry_analysis'
        ]
        
        # Check if any BEA indicators are present
        for key, value in filter_criteria.items():
            key_lower = key.lower()
            if any(indicator in key_lower for indicator in bea_indicators):
                return True
            
            # Check values for BEA-related terms
            if isinstance(value, str):
                value_lower = value.lower()
                if any(indicator in value_lower for indicator in bea_indicators):
                    return True
        
        # Check for specific BEA data types
        if 'data_type' in filter_criteria:
            data_type = filter_criteria['data_type'].lower()
            if any(indicator in data_type for indicator in bea_indicators):
                return True
        
        # Don't activate for individual company requests (SEC EDGAR territory)
        if any(key in filter_criteria for key in ['companies', 'symbols', 'tickers', 'ciks']):
            return False
            
        # Don't activate for treasury/fiscal requests (Treasury Fiscal territory)
        if any(key in filter_criteria for key in ['treasury_series', 'fiscal_data', 'debt_data']):
            return False
            
        return False
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Return priority level for BEA collector (0-100).
        
        Priority 90: GDP, regional, industry-specific requests
        Priority 80: General economic analysis
        Priority 0: Not applicable for this request type
        """
        if not self.should_activate(filter_criteria):
            return 0
            
        # High priority for GDP and regional requests
        high_priority_terms = ['gdp', 'nipa', 'regional', 'industry_gdp']
        if any(term in str(filter_criteria).lower() for term in high_priority_terms):
            return 90
            
        # Medium-high priority for economic analysis
        medium_priority_terms = ['personal_income', 'consumption', 'trade', 'economic']
        if any(term in str(filter_criteria).lower() for term in medium_priority_terms):
            return 80
            
        return 70  # Default for other BEA requests

    @with_error_handling
    def get_gdp_data(self, frequency: str = 'Q', years: Optional[List[str]] = None, 
                     table: str = 'gdp_summary') -> Dict[str, Any]:
        """
        Get GDP data from NIPA tables.
        
        Args:
            frequency: 'A' for annual, 'Q' for quarterly
            years: List of years or 'ALL' for all available
            table: GDP table type ('gdp_summary', 'gdp_components', etc.)
            
        Returns:
            Dictionary containing GDP data and metadata
        """
        time.sleep(0.5)  # Rate limiting - 2 requests per second
        
        if years is None:
            years = ['ALL']
        
        table_name = self.nipa_tables.get(table, 'T10101')  # Default to GDP summary
        year_param = ','.join(years) if isinstance(years, list) and years != ['ALL'] else 'ALL'
        
        params = {
            'UserID': self.api_key,
            'method': 'GetData',
            'datasetname': 'NIPA',
            'TableName': table_name,
            'Frequency': frequency,
            'Year': year_param,
            'ResultFormat': 'JSON'
        }
        
        try:
            response = self.session.get(self.config.base_url, params=params, 
                                      timeout=self.config.timeout)
            response.raise_for_status()
            data = response.json()
            
            # Process BEA API response
            if 'BEAAPI' in data and 'Results' in data['BEAAPI']:
                results = data['BEAAPI']['Results']
                
                # Check for API errors
                if 'Error' in results:
                    error = results['Error']
                    error_desc = error.get('APIErrorDescription', error.get('@APIErrorDescription', 'Unknown error'))
                    raise DataValidationError(f"BEA API Error: {error_desc}")
                
                # Extract data
                if 'Data' in results:
                    gdp_data = results['Data']
                    
                    # Process and structure the data
                    processed_data = self._process_gdp_data(gdp_data, table, frequency)
                    
                    result = {
                        'data_type': f'BEA GDP Data - {table}',
                        'source': 'U.S. Bureau of Economic Analysis',
                        'timestamp': datetime.now().isoformat(),
                        'table_name': table_name,
                        'frequency': frequency,
                        'years_requested': year_param,
                        'gdp_analysis': processed_data,
                        'raw_data': gdp_data[:10] if gdp_data else [],  # Sample for reference
                        'metadata': {
                            'query_params': params,
                            'total_records': len(gdp_data) if gdp_data else 0
                        }
                    }
                    
                    return result
                else:
                    raise DataValidationError("No GDP data returned from BEA API")
                    
            else:
                raise DataValidationError("Invalid BEA API response format")
                
        except requests.exceptions.RequestException as e:
            raise NetworkError(f"Failed to fetch BEA GDP data: {e}")
    
    @with_error_handling
    def get_regional_data(self, geography_type: str = 'state', metric: str = 'personal_income',
                         years: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Get regional economic data by state, county, or metro area.
        
        Args:
            geography_type: 'state', 'county', or 'metro'
            metric: Type of regional data to retrieve
            years: List of years or None for recent years
            
        Returns:
            Dictionary containing regional economic data
        """
        time.sleep(0.5)  # Rate limiting - 2 requests per second
        
        if years is None:
            years = ['ALL']
        
        year_param = ','.join(years) if isinstance(years, list) and years != ['ALL'] else 'ALL'
        
        # Use Regional dataset with correct parameters
        params = {
            'UserID': self.api_key,
            'method': 'GetData',
            'datasetname': 'Regional',
            'GeoFips': 'STATE',     # All states
            'LineCode': '1',        # Personal Income line code
            'TableName': 'CAINC1',  # Personal Income Summary table
            'Year': year_param,
            'ResultFormat': 'JSON'
        }
        
        try:
            response = self.session.get(self.config.base_url, params=params,
                                      timeout=self.config.timeout)
            response.raise_for_status()
            data = response.json()
            
            # Process BEA API response
            if 'BEAAPI' in data and 'Results' in data['BEAAPI']:
                results = data['BEAAPI']['Results']
                
                # Check for API errors
                if 'Error' in results:
                    error = results['Error']
                    error_desc = error.get('APIErrorDescription', error.get('@APIErrorDescription', 'Unknown error'))
                    raise DataValidationError(f"BEA API Error: {error_desc}")
                
                # Extract regional data
                if 'Data' in results:
                    regional_data = results['Data']
                    
                    # Process and structure the data
                    processed_data = self._process_regional_data(regional_data, geography_type, metric)
                    
                    result = {
                        'data_type': f'BEA Regional Data - {geography_type} {metric}',
                        'source': 'U.S. Bureau of Economic Analysis',
                        'timestamp': datetime.now().isoformat(),
                        'geography_type': geography_type,
                        'metric': metric,
                        'years_requested': year_param,
                        'regional_analysis': processed_data,
                        'raw_data': regional_data[:10] if regional_data else [],
                        'metadata': {
                            'query_params': params,
                            'total_records': len(regional_data) if regional_data else 0
                        }
                    }
                    
                    return result
                else:
                    raise DataValidationError("No regional data returned from BEA API")
            else:
                raise DataValidationError("Invalid BEA API response format")
                
        except requests.exceptions.RequestException as e:
            raise NetworkError(f"Failed to fetch BEA regional data: {e}")
    
    @with_error_handling
    def get_industry_gdp_data(self, industry_level: str = 'sector', years: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Get GDP data by industry from GDPByIndustry dataset.
        
        Args:
            industry_level: Level of industry detail ('sector', 'subsector', 'detail')
            years: List of years or None for recent years
            
        Returns:
            Dictionary containing industry GDP data
        """
        time.sleep(0.5)  # Rate limiting - 2 requests per second
        
        if years is None:
            years = ['ALL']
        
        year_param = ','.join(years) if isinstance(years, list) and years != ['ALL'] else 'ALL'
        
        params = {
            'UserID': self.api_key,
            'method': 'GetData',
            'datasetname': 'GDPbyIndustry',
            'Industry': 'ALL',    # All industries
            'TableID': 'ALL',     # All tables
            'Frequency': 'A',     # Annual frequency
            'Year': year_param,
            'ResultFormat': 'JSON'
        }
        
        try:
            response = self.session.get(self.config.base_url, params=params,
                                      timeout=self.config.timeout)
            response.raise_for_status()
            data = response.json()
            
            # Process BEA API response
            if 'BEAAPI' in data and 'Results' in data['BEAAPI']:
                results = data['BEAAPI']['Results']
                
                # Check for API errors
                if 'Error' in results:
                    error = results['Error']
                    error_desc = error.get('APIErrorDescription', error.get('@APIErrorDescription', 'Unknown error'))
                    raise DataValidationError(f"BEA API Error: {error_desc}")
                
                # Extract industry data
                if 'Data' in results:
                    industry_data = results['Data']
                    
                    # Process and structure the data
                    processed_data = self._process_industry_data(industry_data, industry_level)
                    
                    result = {
                        'data_type': f'BEA Industry GDP Data - {industry_level}',
                        'source': 'U.S. Bureau of Economic Analysis',
                        'timestamp': datetime.now().isoformat(),
                        'industry_level': industry_level,
                        'component': 'ValueAdded',
                        'years_requested': year_param,
                        'industry_analysis': processed_data,
                        'raw_data': industry_data[:10] if industry_data else [],
                        'metadata': {
                            'query_params': params,
                            'total_records': len(industry_data) if industry_data else 0
                        }
                    }
                    
                    return result
                else:
                    raise DataValidationError("No industry GDP data returned from BEA API")
            else:
                raise DataValidationError("Invalid BEA API response format")
                
        except requests.exceptions.RequestException as e:
            raise NetworkError(f"Failed to fetch BEA industry GDP data: {e}")
    
    @with_error_handling
    def get_comprehensive_economic_summary(self) -> Dict[str, Any]:
        """
        Get comprehensive economic analysis combining GDP and Regional data.
        
        Returns:
            Dictionary containing comprehensive economic analysis
        """
        logger.info("Generating comprehensive economic summary from BEA data")
        
        try:
            # Gather data from working datasets
            gdp_data = self.get_gdp_data(frequency='Q', years=['2023', '2024'], table='gdp_summary')
            regional_data = self.get_regional_data(geography_type='state', metric='personal_income', years=['2023'])
            
            # Try industry data but continue if it fails
            industry_data = None
            try:
                industry_data = self.get_industry_gdp_data(industry_level='sector', years=['2023'])
            except Exception:
                logger.warning("Industry data unavailable, continuing with GDP and regional data")
            
            # Create comprehensive summary
            summary = {
                'analysis_type': 'Comprehensive BEA Economic Analysis',
                'source': 'U.S. Bureau of Economic Analysis API',
                'timestamp': datetime.now().isoformat(),
                'economic_highlights': {
                    'gdp_summary': self._extract_gdp_highlights(gdp_data),
                    'regional_overview': self._extract_regional_highlights(regional_data),
                    'industry_performance': self._extract_industry_highlights(industry_data) if industry_data else {'status': 'Industry data unavailable'},
                },
                'data_sources': {
                    'gdp_data': gdp_data,
                    'regional_data': regional_data,
                    'industry_data': industry_data or {'status': 'Not available'}
                },
                'investment_context': {
                    'economic_trends': self._analyze_economic_trends(gdp_data),
                    'regional_opportunities': self._analyze_regional_opportunities(regional_data),
                    'sector_performance': self._analyze_sector_performance(industry_data) if industry_data else ['Industry analysis unavailable'],
                    'market_considerations': self._generate_economic_considerations(gdp_data, regional_data)
                }
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Failed to generate comprehensive economic summary: {e}")
            raise DataValidationError(f"Comprehensive economic analysis failed: {e}")
    
    def _process_gdp_data(self, gdp_data: List[Dict], table: str, frequency: str) -> Dict[str, Any]:
        """Process raw GDP data into structured format."""
        if not gdp_data:
            return {'error': 'No GDP data available'}
        
        try:
            # Extract key metrics from GDP data
            processed = {
                'table_type': table,
                'frequency': frequency,
                'data_points': len(gdp_data),
                'latest_values': [],
                'time_series': []
            }
            
            # Process recent data points
            for record in gdp_data[:5]:  # Latest 5 observations
                processed_record = {
                    'year': record.get('TimePeriod', ''),
                    'value': record.get('DataValue', ''),
                    'line_description': record.get('LineDescription', ''),
                    'series_code': record.get('SeriesCode', '')
                }
                processed['latest_values'].append(processed_record)
            
            return processed
        except Exception:
            return {'error': 'Unable to process GDP data'}
    
    def _process_regional_data(self, regional_data: List[Dict], geography_type: str, metric: str) -> Dict[str, Any]:
        """Process raw regional data into structured format."""
        if not regional_data:
            return {'error': 'No regional data available'}
        
        try:
            processed = {
                'geography_type': geography_type,
                'metric': metric,
                'data_points': len(regional_data),
                'top_regions': [],
                'regional_trends': []
            }
            
            # Process and rank regions
            for record in regional_data[:10]:  # Top 10 regions
                processed_record = {
                    'region': record.get('GeoName', ''),
                    'value': record.get('DataValue', ''),
                    'year': record.get('TimePeriod', ''),
                    'code': record.get('GeoFips', '')
                }
                processed['top_regions'].append(processed_record)
            
            return processed
        except Exception:
            return {'error': 'Unable to process regional data'}
    
    def _process_industry_data(self, industry_data: List[Dict], industry_level: str) -> Dict[str, Any]:
        """Process raw industry GDP data into structured format."""
        if not industry_data:
            return {'error': 'No industry data available'}
        
        try:
            processed = {
                'industry_level': industry_level,
                'data_points': len(industry_data),
                'top_industries': [],
                'industry_performance': []
            }
            
            # Process industry performance
            for record in industry_data[:10]:  # Top 10 industries
                processed_record = {
                    'industry': record.get('IndustryDescription', ''),
                    'value': record.get('DataValue', ''),
                    'year': record.get('TimePeriod', ''),
                    'industry_code': record.get('IndustryCode', '')
                }
                processed['top_industries'].append(processed_record)
            
            return processed
        except Exception:
            return {'error': 'Unable to process industry data'}
    
    def _extract_gdp_highlights(self, gdp_data: Dict) -> Dict[str, Any]:
        """Extract key highlights from GDP data."""
        if 'gdp_analysis' in gdp_data and 'latest_values' in gdp_data['gdp_analysis']:
            latest = gdp_data['gdp_analysis']['latest_values']
            if latest:
                return {
                    'latest_period': latest[0].get('year', 'N/A'),
                    'latest_value': latest[0].get('value', 'N/A'),
                    'data_points': len(latest)
                }
        return {'status': 'GDP highlights unavailable'}
    
    def _extract_regional_highlights(self, regional_data: Dict) -> Dict[str, Any]:
        """Extract key highlights from regional data."""
        if 'regional_analysis' in regional_data and 'top_regions' in regional_data['regional_analysis']:
            top_regions = regional_data['regional_analysis']['top_regions']
            return {
                'regions_analyzed': len(top_regions),
                'top_region': top_regions[0].get('region', 'N/A') if top_regions else 'N/A'
            }
        return {'status': 'Regional highlights unavailable'}
    
    def _extract_industry_highlights(self, industry_data: Dict) -> Dict[str, Any]:
        """Extract key highlights from industry data."""
        if 'industry_analysis' in industry_data and 'top_industries' in industry_data['industry_analysis']:
            top_industries = industry_data['industry_analysis']['top_industries']
            return {
                'industries_analyzed': len(top_industries),
                'top_industry': top_industries[0].get('industry', 'N/A') if top_industries else 'N/A'
            }
        return {'status': 'Industry highlights unavailable'}
    
    def _analyze_economic_trends(self, gdp_data: Dict) -> List[str]:
        """Analyze economic trends from GDP data."""
        trends = [
            "GDP trend analysis based on latest BEA data",
            "Economic growth patterns from national accounts",
            "Components of economic expansion or contraction"
        ]
        return trends
    
    def _analyze_regional_opportunities(self, regional_data: Dict) -> List[str]:
        """Analyze regional investment opportunities."""
        opportunities = [
            "Regional economic performance variations",
            "State and metro area growth differentials", 
            "Geographic diversification opportunities"
        ]
        return opportunities
    
    def _analyze_sector_performance(self, industry_data: Dict) -> List[str]:
        """Analyze sector performance from industry data."""
        performance = [
            "Industry value-added contribution analysis",
            "Sector-specific economic performance metrics",
            "Industry rotation opportunities based on BEA data"
        ]
        return performance
    
    def _generate_economic_considerations(self, gdp_data: Dict, regional_data: Dict) -> List[str]:
        """Generate market considerations based on economic data."""
        considerations = [
            "Monitor GDP components for economic cycle positioning",
            "Consider regional economic variations for geographic allocation",
            "Evaluate state-level economic performance for investment opportunities",
            "Assess economic trends for macro-driven investment decisions",
            "Use regional income data for geographic diversification strategies"
        ]
        return considerations

    # Data collection interface methods
    def authenticate(self) -> bool:
        """Test BEA API authentication with provided UserID."""
        try:
            params = {
                'UserID': self.api_key,
                'method': 'GetDataSetList',
                'ResultFormat': 'JSON'
            }
            response = self.session.get(self.config.base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Check for authentication errors
            if 'BEAAPI' in data and 'Results' in data['BEAAPI']:
                results = data['BEAAPI']['Results']
                if 'Error' in results:
                    error = results['Error']
                    if 'Invalid API UserId' in error.get('@APIErrorDescription', ''):
                        return False
                return True
            return False
        except Exception:
            return False
        
    def collect_batch(self, symbols: List[str], date_range: DateRange) -> pd.DataFrame:
        """Collect batch economic data - adapted for BEA data types."""
        results = []
        
        for data_type in symbols:  # Treat as BEA data types
            if 'gdp' in data_type.lower():
                data = self.get_gdp_data(frequency='Q', years=['ALL'])
                results.append(data)
            elif 'regional' in data_type.lower():
                data = self.get_regional_data()
                results.append(data)
            elif 'industry' in data_type.lower():
                data = self.get_industry_gdp_data()
                results.append(data)
                
        return pd.DataFrame(results) if results else pd.DataFrame()
    
    def collect_realtime(self, symbols: List[str]) -> Iterator[Dict]:
        """Collect real-time economic data."""
        for data_type in symbols:
            if 'gdp' in data_type.lower():
                yield self.get_gdp_data(frequency='Q', years=['2023', '2024'])
            elif 'regional' in data_type.lower():
                yield self.get_regional_data()
    
    def get_rate_limits(self) -> RateLimitConfig:
        """Return current rate limit configuration."""
        return self.rate_limiter.config
    
    def validate_data(self, data: Dict) -> Dict[str, Any]:
        """Validate BEA economic data."""
        validation_result = {
            'is_valid': True,
            'errors': [],
            'warnings': []
        }
        
        # Check for required fields
        if not data.get('data_type'):
            validation_result['errors'].append('Missing data_type field')
            validation_result['is_valid'] = False
            
        if not data.get('timestamp'):
            validation_result['warnings'].append('Missing timestamp')
            
        # Check for BEA API errors
        if 'error' in str(data).lower():
            validation_result['warnings'].append('Potential BEA API error detected')
            
        return validation_result
    
    # Required abstract methods from DataCollectorInterface
    @property
    def source_name(self) -> str:
        """Return the name of this data source."""
        return "U.S. Bureau of Economic Analysis"
    
    @property 
    def requires_api_key(self) -> bool:
        """BEA API requires a UserID (API key)."""
        return True
    
    @property
    def supported_data_types(self) -> List[str]:
        """Return list of supported BEA data types."""
        return [
            'gdp_data',
            'nipa_tables',
            'regional_income', 
            'regional_product',
            'industry_gdp',
            'international_transactions',
            'fixed_assets',
            'personal_income',
            'consumption_expenditures'
        ]
    
    def get_available_symbols(self) -> List[str]:
        """
        Get available BEA data series identifiers.
        These are economic data types rather than stock symbols.
        """
        return [
            'GDP_QUARTERLY',        # Quarterly GDP data
            'GDP_ANNUAL',          # Annual GDP data
            'PERSONAL_INCOME',     # Personal Income by state/metro
            'REGIONAL_GDP',        # GDP by state/metro
            'INDUSTRY_GDP',        # GDP by industry
            'CONSUMPTION_PCE',     # Personal Consumption Expenditures
            'CORPORATE_PROFITS',   # Corporate Profits
            'GOVERNMENT_SPENDING', # Government expenditures
            'TRADE_BALANCE',       # International transactions
            'INVESTMENT_POSITION'  # International investment position
        ]
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate BEA data series symbols.
        
        Args:
            symbols: List of BEA data series identifiers to validate
            
        Returns:
            Dictionary mapping each symbol to validation status
        """
        available_symbols = self.get_available_symbols()
        return {
            symbol: symbol in available_symbols or any(
                keyword in symbol.upper() 
                for keyword in ['GDP', 'INCOME', 'REGIONAL', 'INDUSTRY', 'NIPA']
            )
            for symbol in symbols
        }
    
    def test_connection(self) -> bool:
        """
        Test connection to BEA API.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            params = {
                'UserID': self.api_key,
                'method': 'GetDataSetList',
                'ResultFormat': 'JSON'
            }
            
            response = self.session.get(self.config.base_url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for valid BEA API response
            if 'BEAAPI' in data and 'Results' in data['BEAAPI']:
                results = data['BEAAPI']['Results']
                # If there's an error, connection failed
                if 'Error' in results:
                    return False
                # If there are datasets, connection successful
                return 'Dataset' in results
            
            return False
            
        except Exception:
            return False