"""
Bureau of Labor Statistics (BLS) API Collector

Collects labor and employment data from the U.S. Bureau of Labor Statistics,
providing access to critical employment indicators, wages, productivity, and economic data.

Data Sources:
- Employment data (unemployment rates, job openings, employment levels)
- Consumer Price Index (CPI) for inflation measurements
- Producer Price Index (PPI) for wholesale price changes
- Employment Cost Index (ECI) for wage and benefit trends
- Productivity and costs data
- Occupational Employment and Wage Statistics (OEWS)

API Documentation: https://www.bls.gov/developers/api_signature_v2.shtml
Rate Limits: 25 requests per day for unregistered users, 500 requests per day with API key
Authentication: Optional API key for higher rate limits and extended historical data
User-Agent: Required for all requests

Key Economic Indicators:
- Unemployment Rate (UNRATE from CPS)
- Consumer Price Index (CPI-U, CPI-W)
- Producer Price Index (PPI)
- Employment Cost Index (ECI)
- Job Openings and Labor Turnover Survey (JOLTS)
- Productivity measures
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


class BLSCollector(DataCollectorInterface):
    """
    Bureau of Labor Statistics (BLS) API collector.
    
    Provides access to:
    - Employment and unemployment data
    - Consumer and Producer Price Indexes
    - Wage and productivity statistics
    - Labor market trends
    - Occupational employment statistics
    
    Requires API key for full access (get one at https://www.bls.gov/developers/api_key.htm)
    """
    
    BASE_URL = "https://api.bls.gov/publicAPI/v2/"
    
    # Popular BLS series for economic analysis
    POPULAR_SERIES = {
        # Employment and Unemployment
        'LNS14000000': 'Unemployment Rate (Civilian Labor Force)',
        'CES0000000001': 'Total Nonfarm Employment',
        'LNS12300000': 'Employment-Population Ratio',
        'LNS11300000': 'Labor Force Participation Rate',
        'JTS1000HIL': 'Job Openings: Total Nonfarm (JOLTS)',
        'JTS1000QUL': 'Quits: Total Nonfarm (JOLTS)',
        'JTS1000LDL': 'Layoffs and Discharges: Total Nonfarm (JOLTS)',
        
        # Consumer Price Index (CPI)
        'CUUR0000SA0': 'CPI-U: All Items (Not Seasonally Adjusted)',
        'CUSR0000SA0': 'CPI-U: All Items (Seasonally Adjusted)',
        'CUUR0000SA0L1E': 'CPI-U: All Items Less Food and Energy',
        'CUUR0000SAF1': 'CPI-U: Food',
        'CUUR0000SAE1': 'CPI-U: Energy',
        'CUUR0000SEHE01': 'CPI-U: Shelter',
        'CUUR0000SETB01': 'CPI-U: Gasoline (All Types)',
        
        # Producer Price Index (PPI)
        'WPUFD4': 'PPI: Final Demand',
        'WPUFD49104': 'PPI: Final Demand Less Food and Energy',
        'WPUFD49116': 'PPI: Final Demand Food',
        'WPUFD4131': 'PPI: Final Demand Energy',
        
        # Employment Cost Index (ECI)
        'CIU1010000000000A': 'ECI: Total Compensation (All Workers)',
        'CIU1020000000000A': 'ECI: Wages and Salaries (All Workers)',
        'CIU1030000000000A': 'ECI: Benefits (All Workers)',
        
        # Productivity
        'PRS85006092': 'Labor Productivity: Nonfarm Business Sector',
        'PRS85006112': 'Unit Labor Costs: Nonfarm Business Sector',
        
        # Average Hourly Earnings
        'CES0500000003': 'Average Hourly Earnings: Total Private',
        'CES0500000011': 'Average Weekly Hours: Total Private'
    }
    
    # Series categories for organization
    SERIES_CATEGORIES = {
        'employment': {
            'description': 'Employment, unemployment, and labor force statistics',
            'series': ['LNS14000000', 'CES0000000001', 'LNS12300000', 'LNS11300000']
        },
        'jolts': {
            'description': 'Job Openings and Labor Turnover Survey data',
            'series': ['JTS1000HIL', 'JTS1000QUL', 'JTS1000LDL']
        },
        'cpi': {
            'description': 'Consumer Price Index inflation measures',
            'series': ['CUUR0000SA0', 'CUSR0000SA0', 'CUUR0000SA0L1E', 'CUUR0000SAF1', 'CUUR0000SAE1']
        },
        'ppi': {
            'description': 'Producer Price Index wholesale price measures',
            'series': ['WPUFD4', 'WPUFD49104', 'WPUFD49116', 'WPUFD4131']
        },
        'eci': {
            'description': 'Employment Cost Index wage and benefit trends',
            'series': ['CIU1010000000000A', 'CIU1020000000000A', 'CIU1030000000000A']
        },
        'productivity': {
            'description': 'Labor productivity and unit labor costs',
            'series': ['PRS85006092', 'PRS85006112']
        },
        'earnings': {
            'description': 'Average hourly earnings and weekly hours',
            'series': ['CES0500000003', 'CES0500000011']
        }
    }
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """
        Initialize BLS collector.
        
        Args:
            config: Optional configuration including API key
            
        Note:
            API key is optional but recommended for higher rate limits
        """
        # Create default config if none provided
        self.config = config or CollectorConfig(
            api_key=None,  # Optional for BLS
            base_url="https://api.bls.gov/publicAPI/v2/",
            timeout=30,
            max_retries=3,
            requests_per_minute=25 if not config or not config.api_key else 500  # Based on BLS limits
        )
        
        super().__init__(self.config)
        
        # Standard headers (BLS doesn't require specific User-Agent but recommended)
        self.headers = {
            'User-Agent': 'Financial Analysis Platform BLS Collector v1.0',
            'Content-Type': 'application/json'
        }
        
        # Rate limiter (conservative approach)
        requests_per_minute = 25 if not self.config.api_key else 500
        rate_config = RateLimitConfig(
            requests_per_minute=requests_per_minute,
            burst_limit=5
        )
        self.rate_limiter = RateLimiter(rate_config, "bls")
        
        # Error handler
        retry_config = RetryConfig(
            max_attempts=3,
            initial_delay=2.0,  # Be respectful to BLS servers
            backoff_factor=2.0,
            retry_on=(NetworkError,)
        )
        self.error_handler = ErrorHandler(retry_config, name="bls")
        
        # Cache for series metadata
        self._series_cache: Dict[str, Dict] = {}
        
        logger.info(f"BLS collector initialized with {'API key' if self.config.api_key else 'no API key'} (rate limit: {requests_per_minute}/min)")
    
    # Filtering and activation methods
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if this collector should activate based on filter criteria.
        
        BLS collector activates for employment and labor market data requests.
        """
        # Check for BLS-specific indicators
        bls_indicators = [
            'bls_series', 'employment', 'unemployment', 'labor', 'jobs', 'wages',
            'cpi', 'consumer_price', 'inflation', 'ppi', 'producer_price',
            'productivity', 'earnings', 'jolts', 'labor_force', 'employment_cost'
        ]
        
        # Check if any BLS indicators are mentioned in the criteria
        criteria_str = str(filter_criteria).lower()
        has_bls_indicators = any(indicator in criteria_str for indicator in bls_indicators)
        
        # Don't activate for individual company analysis
        has_companies = bool(filter_criteria.get('companies')) or bool(filter_criteria.get('symbols'))
        has_specific_companies = has_companies and len(filter_criteria.get('companies', filter_criteria.get('symbols', []))) <= 20
        
        # Don't activate for Treasury-specific requests
        has_treasury = any(key in criteria_str for key in ['treasury', 'bonds', 'bills', 'notes', 'federal_debt'])
        
        # Don't activate for general GDP/monetary policy (FRED handles these better)
        has_fed_monetary = any(key in criteria_str for key in ['gdp', 'federal_funds', 'interest_rates', 'monetary'])
        
        return has_bls_indicators and not has_specific_companies and not has_treasury and not has_fed_monetary
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Get activation priority based on filter criteria (0-100 scale).
        
        Higher priority for employment and labor market data.
        """
        if not self.should_activate(filter_criteria):
            return 0
        
        priority = 50  # Base priority for BLS data
        
        # Higher priority for explicit BLS series requests
        if filter_criteria.get('bls_series'):
            priority = 95
        
        # High priority for employment analysis
        if filter_criteria.get('analysis_type') == 'employment':
            priority += 25
        
        # Medium to high priority for specific labor market indicators
        criteria_str = str(filter_criteria).lower()
        employment_terms = ['unemployment', 'employment', 'labor_force', 'jobs', 'jolts']
        inflation_terms = ['cpi', 'ppi', 'inflation', 'consumer_price', 'producer_price']
        wage_terms = ['wages', 'earnings', 'productivity', 'employment_cost']
        
        if any(term in criteria_str for term in employment_terms):
            priority += 20
        elif any(term in criteria_str for term in inflation_terms):
            priority += 15
        elif any(term in criteria_str for term in wage_terms):
            priority += 10
        
        return min(priority, 100)
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "Bureau of Labor Statistics (BLS)"
    
    @property 
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            "timeseries",           # Time series data for BLS series
            "series_info",          # Series metadata and information
            "latest_data",          # Most recent data points
            "employment",           # Employment and unemployment statistics
            "cpi",                  # Consumer Price Index data
            "ppi",                  # Producer Price Index data
            "jolts",                # Job Openings and Labor Turnover Survey
            "productivity",         # Labor productivity measures
            "earnings",             # Average hourly earnings data
            "labor_force",          # Labor force participation
            "employment_cost",      # Employment Cost Index
            "popular_series",       # Popular economic indicators
            "series_catalog"        # Available BLS series catalog
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """BLS API key is optional but recommended for higher limits."""
        return False  # Optional
    
    def authenticate(self) -> bool:
        """
        Test authentication with BLS API.
        BLS doesn't require authentication, but API key provides higher limits.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Test with a simple series request (unemployment rate)
            test_data = self.get_series_data(['LNS14000000'], latest_only=True)
            
            if test_data is not None and not test_data.empty:
                self._authenticated = True
                logger.info("BLS API connection successful")
            else:
                self._authenticated = False
                logger.error("BLS API connection failed: No data returned")
            
            return self._authenticated
            
        except Exception as e:
            logger.error(f"BLS authentication error: {e}")
            self._authenticated = False
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to BLS API."""
        try:
            start_time = datetime.now()
            
            # Test with unemployment rate series
            response = self._make_request("timeseries/data/", {
                'seriesid': ['LNS14000000'],
                'startyear': '2023',
                'endyear': '2023'
            })
            
            duration = (datetime.now() - start_time).total_seconds()
            
            success = response is not None and response.get('status') == 'REQUEST_SUCCEEDED'
            
            return {
                "connected": success,
                "response_time_ms": duration * 1000,
                "api_status": response.get('status') if response else 'FAILED',
                "has_api_key": bool(self.config.api_key),
                "rate_limit_status": self.rate_limiter.get_status(),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "connected": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    @with_error_handling
    def _make_request(self, endpoint: str, payload: Dict) -> Optional[Dict]:
        """Make rate-limited request to BLS API."""
        # Apply rate limiting
        self.rate_limiter.acquire("bls_api", timeout=30)
        
        url = urljoin(self.BASE_URL, endpoint)
        
        # Add API key if available
        if self.config.api_key:
            payload['registrationkey'] = self.config.api_key
        
        try:
            response = requests.post(
                url,
                json=payload,
                headers=self.headers,
                timeout=self.config.timeout
            )
            
            # Check for HTTP errors
            if response.status_code == 429:
                raise NetworkError("BLS rate limit exceeded", response.status_code)
            elif response.status_code >= 400:
                raise NetworkError(f"BLS API error: {response.status_code}", response.status_code)
            
            response.raise_for_status()
            data = response.json()
            
            # Check BLS API status
            if data.get('status') == 'REQUEST_NOT_PROCESSED':
                error_msg = ', '.join(data.get('message', ['Unknown error']))
                raise DataValidationError(f"BLS API request failed: {error_msg}")
            
            return data
            
        except requests.RequestException as e:
            raise NetworkError(f"Request to BLS failed: {e}")
    
    def collect_batch(
        self, 
        symbols: List[str], 
        date_range: DateRange,
        frequency: DataFrequency = DataFrequency.MONTHLY,
        data_type: str = "timeseries"
    ) -> pd.DataFrame:
        """
        Collect BLS data for multiple series.
        
        Args:
            symbols: List of BLS series IDs
            date_range: Date range for data collection
            frequency: Data frequency (note: BLS determines frequency per series)
            data_type: Type of data to collect
            
        Returns:
            DataFrame with BLS data
        """
        logger.info(f"Collecting BLS data for {len(symbols)} series from {date_range.start_date} to {date_range.end_date}")
        
        if data_type == "timeseries":
            return self.get_series_data(symbols, date_range.start_date, date_range.end_date)
        elif data_type == "latest_data":
            return self.get_latest_data(symbols)
        else:
            logger.warning(f"Unsupported data type: {data_type}")
            return pd.DataFrame()
    
    def collect_realtime(
        self, 
        symbols: List[str],
        data_type: str = "latest_data"
    ) -> Iterator[Dict[str, Any]]:
        """
        Collect real-time BLS data.
        Note: BLS data is typically updated monthly, not real-time.
        
        Args:
            symbols: List of BLS series IDs
            data_type: Type of data to collect
            
        Yields:
            Dictionary with latest BLS data
        """
        logger.info(f"Starting BLS monitoring for {len(symbols)} series")
        
        for series_id in symbols:
            try:
                # Get latest data point
                latest_data = self.get_latest_observation(series_id)
                if latest_data:
                    latest_data.update({
                        'series_id': series_id,
                        'timestamp': datetime.now().isoformat(),
                        'data_type': 'latest_observation'
                    })
                    yield latest_data
                    
            except Exception as e:
                logger.error(f"Error in real-time collection for BLS series {series_id}: {e}")
                continue
    
    def get_series_data(
        self, 
        series_ids: List[str], 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        latest_only: bool = False
    ) -> pd.DataFrame:
        """
        Get time series data for BLS series.
        
        Args:
            series_ids: List of BLS series identifiers
            start_date: Start date for data
            end_date: End date for data
            latest_only: If True, get only the most recent observation
            
        Returns:
            DataFrame with time series data
        """
        # BLS API has limit of 50 series per request with API key, 25 without
        max_series = 50 if self.config.api_key else 25
        
        all_data = []
        
        # Process series in chunks
        for i in range(0, len(series_ids), max_series):
            chunk = series_ids[i:i + max_series]
            
            payload = {
                'seriesid': chunk
            }
            
            # Add date range if specified
            if not latest_only and start_date and end_date:
                payload.update({
                    'startyear': str(start_date.year),
                    'endyear': str(end_date.year)
                })
            elif latest_only:
                # Get last 2 years for latest data
                current_year = datetime.now().year
                payload.update({
                    'startyear': str(current_year - 1),
                    'endyear': str(current_year)
                })
            
            try:
                response = self._make_request("timeseries/data/", payload)
                
                if not response or response.get('status') != 'REQUEST_SUCCEEDED':
                    logger.warning(f"BLS API request failed for chunk {i//max_series + 1}")
                    continue
                
                # Process series data
                for series_data in response.get('Results', {}).get('series', []):
                    series_id = series_data.get('seriesID', '')
                    series_data_points = series_data.get('data', [])
                    
                    for data_point in series_data_points:
                        # Parse date components
                        year = data_point.get('year', '')
                        period = data_point.get('period', '')
                        value = data_point.get('value', '')
                        
                        # Convert period to month/quarter
                        date_str = self._parse_bls_date(year, period)
                        if not date_str:
                            continue
                        
                        # Convert value to float
                        try:
                            numeric_value = float(value) if value not in ['-', ''] else None
                        except ValueError:
                            numeric_value = None
                        
                        all_data.append({
                            'series_id': series_id,
                            'date': date_str,
                            'value': numeric_value,
                            'year': year,
                            'period': period,
                            'period_name': data_point.get('periodName', ''),
                            'footnotes': data_point.get('footnotes', [])
                        })
                
                # Rate limiting between chunks
                if i + max_series < len(series_ids):
                    time.sleep(1)
                    
            except Exception as e:
                logger.warning(f"Failed to collect BLS data for chunk {i//max_series + 1}: {e}")
                continue
        
        if not all_data:
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(all_data)
        
        # Convert date column to datetime
        df['date'] = pd.to_datetime(df['date'])
        
        # Add metadata
        df['collector_source'] = self.source_name
        df['collection_timestamp'] = datetime.now()
        
        # Sort by series and date
        df = df.sort_values(['series_id', 'date'])
        
        # If latest only, keep most recent for each series
        if latest_only:
            df = df.groupby('series_id').last().reset_index()
        
        logger.info(f"Successfully collected {len(df)} records from BLS")
        return df
    
    def get_latest_data(self, series_ids: List[str]) -> pd.DataFrame:
        """
        Get the latest available data for specified series.
        
        Args:
            series_ids: List of BLS series identifiers
            
        Returns:
            DataFrame with latest data points
        """
        return self.get_series_data(series_ids, latest_only=True)
    
    def get_latest_observation(self, series_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the most recent observation for a series.
        
        Args:
            series_id: BLS series identifier
            
        Returns:
            Dictionary with latest observation
        """
        try:
            df = self.get_series_data([series_id], latest_only=True)
            
            if df.empty:
                return None
            
            latest_row = df.iloc[0]
            
            return {
                'series_id': latest_row['series_id'],
                'value': latest_row['value'],
                'date': latest_row['date'].strftime('%Y-%m-%d'),
                'period': latest_row['period'],
                'period_name': latest_row['period_name'],
                'year': latest_row['year']
            }
            
        except Exception as e:
            logger.error(f"Failed to get latest observation for {series_id}: {e}")
            return None
    
    def get_popular_series(self) -> Dict[str, str]:
        """Get dictionary of popular BLS indicators."""
        return self.POPULAR_SERIES.copy()
    
    def get_series_by_category(self, category: str) -> List[str]:
        """
        Get BLS series IDs by category.
        
        Args:
            category: Category name (employment, cpi, ppi, etc.)
            
        Returns:
            List of series IDs in the category
        """
        category_info = self.SERIES_CATEGORIES.get(category.lower(), {})
        return category_info.get('series', [])
    
    def get_available_categories(self) -> Dict[str, Dict[str, Any]]:
        """Get available BLS data categories."""
        return self.SERIES_CATEGORIES.copy()
    
    def search_employment_data(self, 
                              include_unemployment: bool = True,
                              include_labor_force: bool = True,
                              include_jolts: bool = True) -> pd.DataFrame:
        """
        Get comprehensive employment data.
        
        Args:
            include_unemployment: Include unemployment statistics
            include_labor_force: Include labor force participation
            include_jolts: Include job openings data
            
        Returns:
            DataFrame with employment indicators
        """
        series_to_fetch = []
        
        if include_unemployment:
            series_to_fetch.extend(['LNS14000000', 'CES0000000001'])  # Unemployment rate, total employment
        
        if include_labor_force:
            series_to_fetch.extend(['LNS11300000', 'LNS12300000'])  # Participation rate, employment ratio
        
        if include_jolts:
            series_to_fetch.extend(['JTS1000HIL', 'JTS1000QUL'])  # Job openings, quits
        
        return self.get_series_data(series_to_fetch)
    
    def search_inflation_data(self, 
                             include_cpi: bool = True,
                             include_ppi: bool = True,
                             core_only: bool = False) -> pd.DataFrame:
        """
        Get comprehensive inflation data.
        
        Args:
            include_cpi: Include Consumer Price Index
            include_ppi: Include Producer Price Index
            core_only: Include only core measures (excluding food/energy)
            
        Returns:
            DataFrame with inflation indicators
        """
        series_to_fetch = []
        
        if include_cpi:
            if core_only:
                series_to_fetch.append('CUUR0000SA0L1E')  # CPI less food and energy
            else:
                series_to_fetch.extend(['CUSR0000SA0', 'CUUR0000SA0L1E'])  # All items + core
        
        if include_ppi:
            if core_only:
                series_to_fetch.append('WPUFD49104')  # PPI less food and energy
            else:
                series_to_fetch.extend(['WPUFD4', 'WPUFD49104'])  # Final demand + core
        
        return self.get_series_data(series_to_fetch)
    
    def get_wage_and_productivity_data(self) -> pd.DataFrame:
        """
        Get wage and productivity indicators.
        
        Returns:
            DataFrame with wage and productivity data
        """
        wage_series = [
            'CES0500000003',  # Average hourly earnings
            'CIU1010000000000A',  # Employment Cost Index
            'PRS85006092',  # Labor productivity
            'PRS85006112'   # Unit labor costs
        ]
        
        return self.get_series_data(wage_series)
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get current rate limit status."""
        return self.rate_limiter.get_status("bls_api")
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate if series IDs exist in BLS database.
        
        Args:
            symbols: List of BLS series IDs to validate
            
        Returns:
            Dictionary mapping series IDs to validation status
        """
        validation_results = {}
        
        # Test with small date range to validate series existence
        current_year = datetime.now().year
        
        try:
            payload = {
                'seriesid': symbols,
                'startyear': str(current_year - 1),
                'endyear': str(current_year)
            }
            
            response = self._make_request("timeseries/data/", payload)
            
            if response and response.get('status') == 'REQUEST_SUCCEEDED':
                returned_series = {
                    series['seriesID']: bool(series.get('data'))
                    for series in response.get('Results', {}).get('series', [])
                }
                
                # Mark series as valid if they returned data
                for series_id in symbols:
                    validation_results[series_id] = returned_series.get(series_id, False)
            else:
                # Default to False if request failed
                validation_results = {series_id: False for series_id in symbols}
                
        except Exception as e:
            logger.error(f"Validation request failed: {e}")
            validation_results = {series_id: False for series_id in symbols}
        
        return validation_results
    
    def _parse_bls_date(self, year: str, period: str) -> Optional[str]:
        """
        Parse BLS date components into ISO date string.
        
        Args:
            year: Year string
            period: Period string (M01-M12 for monthly, Q01-Q04 for quarterly, A01 for annual)
            
        Returns:
            ISO date string or None if parsing fails
        """
        try:
            if not year or not period:
                return None
            
            year_int = int(year)
            
            # Monthly data
            if period.startswith('M'):
                month = int(period[1:])
                if 1 <= month <= 12:
                    return f"{year_int}-{month:02d}-01"
            
            # Quarterly data  
            elif period.startswith('Q'):
                quarter = int(period[1:])
                if 1 <= quarter <= 4:
                    month = (quarter - 1) * 3 + 1
                    return f"{year_int}-{month:02d}-01"
            
            # Annual data
            elif period in ['A01', 'S01', 'S02', 'S03']:
                return f"{year_int}-01-01"
            
            # Semi-annual
            elif period.startswith('S'):
                semi = int(period[1:])
                month = 1 if semi == 1 else 7
                return f"{year_int}-{month:02d}-01"
            
            return None
            
        except (ValueError, IndexError):
            return None
    
    def get_available_symbols(
        self, 
        exchange: Optional[str] = None,
        sector: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get popular BLS series information.
        
        Args:
            exchange: Not applicable for BLS
            sector: BLS category filter
            
        Returns:
            List of popular series information
        """
        symbols = []
        
        # Filter by category if specified
        if sector and sector.lower() in self.SERIES_CATEGORIES:
            series_ids = self.get_series_by_category(sector.lower())
            category_desc = self.SERIES_CATEGORIES[sector.lower()]['description']
        else:
            series_ids = list(self.POPULAR_SERIES.keys())
            category_desc = "Popular BLS Economic Indicators"
        
        for series_id in series_ids:
            description = self.POPULAR_SERIES.get(series_id, f"BLS Series {series_id}")
            
            symbols.append({
                'symbol': series_id,
                'name': description,
                'title': description,
                'category': category_desc,
                'frequency': 'Monthly',  # Most BLS series are monthly
                'source': 'Bureau of Labor Statistics'
            })
        
        return symbols