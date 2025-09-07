"""
Energy Information Administration (EIA) API Collector

Collects energy and commodity data from the U.S. Energy Information Administration,
providing access to critical energy market indicators, production data, and price information.

Data Sources:
- Petroleum and other liquids (crude oil, gasoline, heating oil)
- Natural gas (production, consumption, storage, prices)
- Electricity (generation, consumption, capacity by fuel type)
- Coal (production, consumption, prices, reserves)
- Renewable and alternative fuels (solar, wind, hydroelectric)
- Nuclear and uranium data
- Total energy statistics and forecasts

API Documentation: https://www.eia.gov/opendata/documentation.php
Rate Limits: 5,000 rows per JSON request, reasonable request frequency expected
Authentication: API key required (free registration at https://www.eia.gov/opendata/)
User-Agent: Recommended for identification

Key Energy Indicators:
- WTI Crude Oil Prices
- Natural Gas Prices (Henry Hub)
- Gasoline and Diesel Prices
- Electricity Generation by Source
- Energy Production and Consumption
- Renewable Energy Capacity and Generation
"""

import pandas as pd
import requests
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Iterator, Optional, Union
from urllib.parse import urljoin
import time
import json

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

import logging

logger = logging.getLogger(__name__)


class EIACollector(DataCollectorInterface):
    """
    Energy Information Administration (EIA) API collector.
    
    Provides access to:
    - Petroleum and oil market data
    - Natural gas production and pricing
    - Electricity generation and consumption
    - Coal production and reserves
    - Renewable energy statistics
    - Energy forecasts and analysis
    
    Requires API key (get one at https://www.eia.gov/opendata/)
    """
    
    BASE_URL = "https://api.eia.gov/v2/"
    
    # Popular EIA series for energy analysis
    POPULAR_SERIES = {
        # Petroleum and Oil
        'petroleum/pri/spt/data': 'Spot Prices: WTI Crude Oil',
        'petroleum/pri/gnd/data': 'Gasoline and Diesel Fuel Update',
        'petroleum/sum/snd/data': 'Supply and Disposition',
        'petroleum/crd/crpdn/data': 'Crude Oil Production',
        'petroleum/stoc/wstk/data': 'Weekly Petroleum Status Report',
        
        # Natural Gas
        'natural-gas/pri/sum/data': 'Natural Gas Prices Summary',
        'natural-gas/prod/sum/data': 'Natural Gas Production Summary', 
        'natural-gas/cons/sum/data': 'Natural Gas Consumption Summary',
        'natural-gas/stor/sum/data': 'Natural Gas Storage Summary',
        'natural-gas/hh/data': 'Henry Hub Natural Gas Spot Price',
        
        # Electricity
        'electricity/rto/region-sub-ba/data': 'Electricity Data by Region',
        'electricity/retail-sales/data': 'Electricity Sales to End Users',
        'electricity/electric-power-operational-data/data': 'Electric Power Operations',
        'electricity/facility-fuel/data': 'Electricity Generation by Fuel Type',
        'electricity/state-electricity-profiles/data': 'State Electricity Profiles',
        
        # Coal
        'coal/production/data': 'Coal Production',
        'coal/consumption/data': 'Coal Consumption', 
        'coal/reserves/data': 'Coal Reserves',
        'coal/distribution/data': 'Coal Distribution',
        
        # Renewables
        'renewable/gen/data': 'Renewable Electricity Generation',
        'renewable/capacity/data': 'Renewable Electricity Capacity',
        'renewable/annual/data': 'Annual Renewable Energy Data',
        
        # Total Energy
        'total-energy/data': 'Monthly Energy Review',
        'international/data': 'International Energy Data'
    }
    
    # Energy sector categories for filtering
    ENERGY_SECTORS = {
        'petroleum': ['crude oil', 'gasoline', 'diesel', 'heating oil', 'jet fuel'],
        'natural_gas': ['henry hub', 'production', 'consumption', 'storage', 'imports', 'exports'],
        'electricity': ['generation', 'consumption', 'capacity', 'renewable', 'nuclear', 'coal'],
        'coal': ['production', 'consumption', 'reserves', 'exports', 'imports'],
        'renewables': ['solar', 'wind', 'hydroelectric', 'geothermal', 'biomass'],
        'nuclear': ['generation', 'capacity', 'fuel'],
        'international': ['global production', 'global consumption', 'trade flows']
    }
    
    def __init__(self, config: CollectorConfig = None):
        """
        Initialize EIA collector.
        
        Args:
            config: Collector configuration with API key and settings
        """
        if config is None:
            config = CollectorConfig()
            
        super().__init__(config)
        
        # EIA-specific configuration
        self.config = CollectorConfig(
            api_key=config.api_key if config else None,
            base_url=self.BASE_URL,
            timeout=30,
            max_retries=3,
            retry_delay=2.0,
            cache_enabled=True,
            cache_ttl=600,  # 10 minutes - energy data updates less frequently
            rate_limit_enabled=True,
            requests_per_minute=60,  # Conservative rate limit for EIA
            concurrent_requests=1
        )
        
        # Standard headers (EIA recommends User-Agent identification)
        self.headers = {
            'User-Agent': 'Financial Analysis Platform EIA Collector v1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        
        # Initialize rate limiter
        rate_config = RateLimitConfig(
            requests_per_minute=self.config.requests_per_minute,
            burst_limit=5,
            cooldown_period=2.0  # Be respectful to EIA servers
        )
        self.rate_limiter = RateLimiter(rate_config, "eia")
        
        # Initialize error handler
        retry_config = RetryConfig(
            max_attempts=self.config.max_retries,
            initial_delay=self.config.retry_delay,
            backoff_factor=2.0,
            retry_on=(NetworkError,)
        )
        self.error_handler = ErrorHandler(retry_config)
        
        logger.info(f"EIA collector initialized with {'API key' if self.config.api_key else 'no API key'}")
    
    def should_activate(self, criteria: Dict[str, Any]) -> bool:
        """
        EIA collector activates for energy and commodity data requests.
        
        Args:
            criteria: Request criteria dictionary
            
        Returns:
            True if EIA collector should handle this request
        """
        # Check for energy-related keywords
        energy_keywords = [
            'energy', 'oil', 'gas', 'petroleum', 'crude', 'gasoline', 'diesel',
            'electricity', 'power', 'coal', 'renewable', 'solar', 'wind', 
            'nuclear', 'commodity', 'fuel', 'wti', 'henry hub'
        ]
        
        # Check if any energy indicators are mentioned in the criteria
        criteria_str = str(criteria).lower()
        if any(keyword in criteria_str for keyword in energy_keywords):
            return True
            
        # Check for specific EIA data requests
        if criteria.get('energy_data', False):
            return True
            
        # Check for commodity analysis requests
        if criteria.get('commodities', False) or criteria.get('commodity_analysis', False):
            return True
            
        # Check for energy sector filtering
        if criteria.get('energy_sector'):
            return True
            
        # Check for specific energy series
        if criteria.get('eia_series') or criteria.get('energy_series'):
            return True
            
        return False
    
    def get_activation_priority(self, criteria: Dict[str, Any]) -> int:
        """
        Calculate activation priority for EIA collector.
        
        Args:
            criteria: Request criteria dictionary
            
        Returns:
            Priority score (0-100, higher = more priority)
        """
        priority = 50  # Base priority for EIA data
        
        # Higher priority for explicit EIA series requests
        if criteria.get('eia_series') or criteria.get('energy_series'):
            priority += 40
            
        # Higher priority for energy sector analysis
        if criteria.get('energy_sector'):
            priority += 35
            
        # Higher priority for commodity analysis
        if criteria.get('commodities', False) or criteria.get('commodity_analysis', False):
            priority += 30
            
        # Moderate priority for energy keywords
        energy_keywords = ['energy', 'oil', 'gas', 'petroleum', 'electricity', 'coal', 'renewable']
        criteria_str = str(criteria).lower()
        matching_keywords = sum(1 for keyword in energy_keywords if keyword in criteria_str)
        priority += matching_keywords * 5
        
        return min(priority, 100)
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "Energy Information Administration (EIA)"
    
    @property 
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            "energy_prices",        # Oil, gas, electricity prices
            "energy_production",    # Energy production data
            "energy_consumption",   # Energy consumption data
            "commodity_data",       # Commodity market data
            "renewable_energy",     # Renewable energy statistics
            "electricity_data",     # Electricity generation and consumption
            "energy_forecasts"      # Energy market forecasts
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """EIA API requires API key for access."""
        return True
    
    @property
    def requires_authentication(self) -> bool:
        """EIA API requires API key for access."""
        return True
    
    @with_error_handling
    def test_authentication(self) -> bool:
        """
        Test authentication with EIA API.
        
        Returns:
            True if authentication is successful
        """
        if not self.config.api_key:
            logger.warning("No EIA API key provided - authentication will fail")
            return False
            
        try:
            # Test with a simple data request
            test_url = f"{self.BASE_URL}petroleum/pri/spt/data"
            params = {
                'api_key': self.config.api_key,
                'frequency': 'daily',
                'data[]': 'value',
                'facets[duoarea][]': 'NUS',
                'facets[product][]': 'EPC0',
                'start': '2024-01-01',
                'end': '2024-01-02',
                'sort[0][column]': 'period',
                'sort[0][direction]': 'desc',
                'offset': 0,
                'length': 1
            }
            
            response = requests.get(test_url, params=params, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('response', {}).get('data'):
                    logger.info("EIA API authentication successful")
                    return True
                else:
                    logger.error("EIA API authentication failed: No data returned")
                    return False
            else:
                logger.error(f"EIA API authentication failed: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"EIA authentication error: {e}")
            return False
    
    def test_connection(self) -> bool:
        """Test the connection to EIA API."""
        return self.test_authentication()
    
    @with_error_handling
    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make rate-limited request to EIA API."""
        if not self.config.api_key:
            raise AuthenticationError("EIA API key is required")
            
        # Apply rate limiting
        self.rate_limiter.wait_if_needed()
        
        # Prepare request
        url = urljoin(self.BASE_URL, endpoint)
        if params is None:
            params = {}
            
        # Add API key to all requests
        params['api_key'] = self.config.api_key
        
        try:
            response = requests.get(
                url, 
                params=params,
                headers=self.headers,
                timeout=self.config.timeout
            )
            
            if response.status_code == 429:
                raise NetworkError("EIA rate limit exceeded", response.status_code)
            elif response.status_code != 200:
                raise NetworkError(f"EIA API error: {response.status_code}", response.status_code)
            
            data = response.json()
            
            # Check EIA API status
            if 'error' in data:
                error_msg = data.get('error', {}).get('message', 'Unknown error')
                raise DataValidationError(f"EIA API request failed: {error_msg}")
            
            return data
            
        except requests.RequestException as e:
            raise NetworkError(f"Request to EIA failed: {e}")
    
    @with_error_handling
    def collect_data(
        self, 
        symbols: List[str], 
        date_range: DateRange, 
        frequency: DataFrequency = DataFrequency.DAILY
    ) -> pd.DataFrame:
        """
        Collect EIA data for multiple series.
        
        Args:
            symbols: List of EIA series endpoints or identifiers
            date_range: Date range for data collection
            frequency: Data frequency (note: EIA determines frequency per series)
            
        Returns:
            DataFrame with EIA data
        """
        logger.info(f"Collecting EIA data for {len(symbols)} series from {date_range.start_date} to {date_range.end_date}")
        
        all_data = []
        
        for symbol in symbols:
            try:
                series_data = self.get_series_data([symbol], date_range, frequency)
                if not series_data.empty:
                    all_data.append(series_data)
                    logger.debug(f"Collected {len(series_data)} records for {symbol}")
                else:
                    logger.warning(f"No data returned for EIA series {symbol}")
                    
            except Exception as e:
                logger.error(f"Error collecting data for EIA series {symbol}: {e}")
                continue
        
        if all_data:
            df = pd.concat(all_data, ignore_index=True)
            logger.info(f"Successfully collected {len(df)} records from EIA")
            return df
        else:
            logger.warning("No EIA data collected")
            return pd.DataFrame()
    
    @with_error_handling
    def collect_real_time_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Collect real-time EIA data.
        
        Note: EIA data is typically updated daily/weekly, not real-time.
        This method returns the most recent available data.
        
        Args:
            symbols: List of EIA series endpoints or identifiers
            
        Returns:
            Dictionary with latest EIA data
        """
        logger.info(f"Starting EIA monitoring for {len(symbols)} series")
        
        real_time_data = {}
        
        for series_id in symbols:
            try:
                # Get most recent data point
                recent_data = self.get_series_data(
                    [series_id], 
                    DateRange(
                        start_date=datetime.now() - timedelta(days=30),
                        end_date=datetime.now()
                    )
                )
                
                if not recent_data.empty:
                    latest_record = recent_data.iloc[-1]
                    real_time_data[series_id] = {
                        'value': latest_record.get('value'),
                        'date': latest_record.get('date'),
                        'series_id': series_id,
                        'source': self.source_name,
                        'last_updated': datetime.now().isoformat()
                    }
                    
            except Exception as e:
                logger.error(f"Error in real-time collection for EIA series {series_id}: {e}")
                continue
        
        return real_time_data
    
    def get_series_data(
        self, 
        series_endpoints: List[str], 
        date_range: DateRange, 
        frequency: DataFrequency = DataFrequency.DAILY
    ) -> pd.DataFrame:
        """
        Get time series data for EIA endpoints.
        
        Args:
            series_endpoints: List of EIA API endpoints
            date_range: Date range for data collection
            frequency: Data frequency preference
            
        Returns:
            DataFrame with time series data
        """
        all_data = []
        
        for endpoint in series_endpoints:
            try:
                # Build request parameters
                params = {
                    'frequency': self._map_frequency_to_eia(frequency),
                    'data[]': 'value',
                    'start': date_range.start_date.strftime('%Y-%m-%d'),
                    'end': date_range.end_date.strftime('%Y-%m-%d'),
                    'sort[0][column]': 'period',
                    'sort[0][direction]': 'asc',
                    'offset': 0,
                    'length': 5000  # EIA maximum
                }
                
                # Make request
                data = self._make_request(endpoint, params)
                
                if data and 'response' in data and 'data' in data['response']:
                    records = data['response']['data']
                    
                    # Convert to DataFrame
                    df = pd.DataFrame(records)
                    if not df.empty:
                        df['series_id'] = endpoint
                        df['source'] = self.source_name
                        df['date'] = pd.to_datetime(df['period'])
                        all_data.append(df)
                        
            except Exception as e:
                logger.warning(f"EIA API request failed for endpoint {endpoint}: {e}")
                continue
        
        if all_data:
            df = pd.concat(all_data, ignore_index=True)
            logger.info(f"Successfully collected {len(df)} records from EIA")
            return df
        else:
            return pd.DataFrame()
    
    def _map_frequency_to_eia(self, frequency: DataFrequency) -> str:
        """Map DataFrequency to EIA frequency string."""
        mapping = {
            DataFrequency.DAILY: 'daily',
            DataFrequency.WEEKLY: 'weekly', 
            DataFrequency.MONTHLY: 'monthly',
            DataFrequency.QUARTERLY: 'quarterly',
            DataFrequency.ANNUALLY: 'annual'
        }
        return mapping.get(frequency, 'daily')
    
    def get_symbol_info(self, series_endpoint: str) -> Dict[str, Any]:
        """
        Get information about EIA series endpoint.
        
        Args:
            series_endpoint: EIA API endpoint
            
        Returns:
            Dictionary with series information
        """
        return {
            'symbol': series_endpoint,
            'source': 'Energy Information Administration',
            'type': 'energy_data',
            'description': self.POPULAR_SERIES.get(series_endpoint, f'EIA endpoint: {series_endpoint}'),
            'frequency': 'various',
            'currency': 'USD',
            'country': 'US',
            'sector': self._determine_energy_sector(series_endpoint)
        }
    
    def _determine_energy_sector(self, endpoint: str) -> str:
        """Determine energy sector from endpoint."""
        endpoint_lower = endpoint.lower()
        
        if 'petroleum' in endpoint_lower or 'oil' in endpoint_lower:
            return 'petroleum'
        elif 'natural-gas' in endpoint_lower or 'gas' in endpoint_lower:
            return 'natural_gas'
        elif 'electricity' in endpoint_lower or 'electric' in endpoint_lower:
            return 'electricity'
        elif 'coal' in endpoint_lower:
            return 'coal'
        elif 'renewable' in endpoint_lower:
            return 'renewables'
        elif 'nuclear' in endpoint_lower:
            return 'nuclear'
        else:
            return 'total_energy'
    
    def get_popular_indicators(self) -> Dict[str, str]:
        """Get dictionary of popular EIA indicators."""
        return self.POPULAR_SERIES
    
    def get_energy_series_by_sector(self, sector: str) -> List[str]:
        """
        Get EIA series endpoints by energy sector.
        
        Args:
            sector: Energy sector ('petroleum', 'natural_gas', 'electricity', etc.)
            
        Returns:
            List of relevant series endpoints
        """
        sector_series = []
        
        for endpoint, description in self.POPULAR_SERIES.items():
            if sector.lower() in endpoint.lower() or sector.lower() in description.lower():
                sector_series.append(endpoint)
        
        return sector_series
    
    def search_series(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for EIA series by query string.
        
        Args:
            query: Search query
            limit: Maximum number of results
            
        Returns:
            List of matching series information
        """
        results = []
        query_lower = query.lower()
        
        for endpoint, description in self.POPULAR_SERIES.items():
            if (query_lower in endpoint.lower() or 
                query_lower in description.lower()):
                
                results.append({
                    'endpoint': endpoint,
                    'description': description,
                    'sector': self._determine_energy_sector(endpoint)
                })
                
                if len(results) >= limit:
                    break
        
        return results
    
    def authenticate(self) -> bool:
        """Authenticate with EIA API (same as test_authentication)."""
        return self.test_authentication()
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to EIA API.
        
        Returns:
            Dictionary with connection status and details
        """
        try:
            auth_success = self.test_authentication()
            return {
                'connected': auth_success,
                'source': self.source_name,
                'api_key_provided': bool(self.config.api_key),
                'base_url': self.BASE_URL,
                'last_tested': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'connected': False,
                'source': self.source_name,
                'error': str(e),
                'last_tested': datetime.now().isoformat()
            }
    
    def collect_batch(
        self, 
        symbols: List[str], 
        date_range: DateRange,
        frequency: DataFrequency = DataFrequency.DAILY,
        data_type: str = "energy_prices"
    ) -> pd.DataFrame:
        """
        Collect historical data for multiple EIA series.
        
        Args:
            symbols: List of EIA series endpoints to collect data for
            date_range: Date range for data collection
            frequency: Data frequency (daily, weekly, etc.)
            data_type: Type of data to collect (energy_prices, production, etc.)
            
        Returns:
            DataFrame with standardized columns and multi-index (symbol, date)
        """
        return self.collect_data(symbols, date_range, frequency)
    
    def collect_realtime(
        self, 
        symbols: List[str],
        data_type: str = "energy_prices"
    ) -> Iterator[Dict[str, Any]]:
        """
        Collect real-time data for EIA series.
        
        Args:
            symbols: List of EIA series endpoints to collect data for
            data_type: Type of data to collect
            
        Yields:
            Dictionary with real-time data points
        """
        real_time_data = self.collect_real_time_data(symbols)
        for symbol, data in real_time_data.items():
            yield {
                'symbol': symbol,
                'timestamp': datetime.now().isoformat(),
                'data': data,
                'data_type': data_type,
                'source': self.source_name
            }
    
    def get_available_symbols(
        self, 
        exchange: Optional[str] = None,
        sector: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get list of available EIA series endpoints.
        
        Args:
            exchange: Not applicable for EIA (energy sector filter)
            sector: Energy sector filter (petroleum, natural_gas, electricity, etc.)
            
        Returns:
            List of dictionaries with EIA series metadata
        """
        available_series = []
        
        if sector:
            # Filter by energy sector
            sector_series = self.get_energy_series_by_sector(sector)
            for endpoint in sector_series:
                available_series.append(self.get_symbol_info(endpoint))
        else:
            # Return all popular EIA series
            for endpoint, description in self.POPULAR_SERIES.items():
                available_series.append(self.get_symbol_info(endpoint))
        
        return available_series
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """
        Get current rate limit status.
        
        Returns:
            Dictionary with rate limit information
        """
        return {
            'requests_per_minute': self.config.requests_per_minute,
            'daily_limit': 5000,  # EIA API limit
            'current_usage': 'Not tracked',
            'reset_time': 'Daily at midnight UTC',
            'api_key_required': True,
            'source': self.source_name
        }
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate if symbols are valid EIA series endpoints.
        
        Args:
            symbols: List of symbols to validate
            
        Returns:
            Dictionary mapping each symbol to validation status
        """
        validation_results = {}
        
        for symbol in symbols:
            # Basic validation - check if it looks like an EIA endpoint
            is_valid = (
                isinstance(symbol, str) and
                '/' in symbol and
                any(sector in symbol.lower() for sector in self.ENERGY_SECTORS.keys())
            )
            validation_results[symbol] = is_valid
            
        return validation_results