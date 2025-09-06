"""
FRED (Federal Reserve Economic Data) Collector

Collects economic data from the Federal Reserve Bank of St. Louis FRED database,
which contains over 800,000 US and international time series from 108 sources.

Data Sources:
- Economic indicators (GDP, unemployment, inflation)
- Interest rates and monetary policy data  
- International economic data
- Regional and state-level statistics
- Financial market indicators

API Documentation: https://fred.stlouisfed.org/docs/api/
Rate Limits: None specified, but requests should be reasonable
Authentication: Requires free API key from FRED

Key Economic Indicators:
- GDP: Real Gross Domestic Product
- UNRATE: Unemployment Rate  
- CPIAUCSL: Consumer Price Index
- FEDFUNDS: Federal Funds Rate
- DGS10: 10-Year Treasury Rate
- DEXUSEU: US/Euro Exchange Rate
"""

import pandas as pd
import requests
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Iterator, Optional, Union
from urllib.parse import urljoin
import time

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


class FREDCollector(DataCollectorInterface):
    """
    Federal Reserve Economic Data (FRED) collector.
    
    Provides access to:
    - 800,000+ economic time series
    - US and international data
    - Real-time and historical economic indicators
    - Regional and state-level statistics
    - Release schedules and metadata
    
    Requires free API key from https://fred.stlouisfed.org/docs/api/api_key.html
    """
    
    BASE_URL = "https://api.stlouisfed.org/fred/"
    
    # Popular economic indicators
    POPULAR_SERIES = {
        # GDP and Growth
        'GDP': 'Gross Domestic Product',
        'GDPC1': 'Real Gross Domestic Product',
        'GDPPOT': 'Real Potential Gross Domestic Product',
        
        # Employment
        'UNRATE': 'Unemployment Rate',
        'CIVPART': 'Labor Force Participation Rate', 
        'PAYEMS': 'All Employees, Total Nonfarm',
        'UNEMPLOY': 'Unemployment Level',
        
        # Inflation
        'CPIAUCSL': 'Consumer Price Index for All Urban Consumers: All Items',
        'CPILFESL': 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy',
        'PCEPI': 'Personal Consumption Expenditures: Chain-type Price Index',
        
        # Interest Rates
        'FEDFUNDS': 'Federal Funds Effective Rate',
        'DGS3MO': '3-Month Treasury Constant Maturity Rate',
        'DGS10': '10-Year Treasury Constant Maturity Rate',
        'DGS30': '30-Year Treasury Constant Maturity Rate',
        
        # Exchange Rates
        'DEXUSEU': 'U.S. / Euro Foreign Exchange Rate',
        'DEXJPUS': 'Japan / U.S. Foreign Exchange Rate',
        'DEXCHUS': 'China / U.S. Foreign Exchange Rate',
        
        # Money Supply
        'M1SL': 'M1 Money Stock',
        'M2SL': 'M2 Money Stock',
        
        # Housing
        'HOUST': 'Housing Starts: Total: New Privately Owned Housing Units Started',
        'CSUSHPISA': 'S&P/Case-Shiller U.S. National Home Price Index',
        
        # Industrial
        'INDPRO': 'Industrial Production Index',
        'CAPACITY': 'Capacity Utilization: Total Industry'
    }
    
    def __init__(self, config: CollectorConfig):
        """
        Initialize FRED collector.
        
        Args:
            config: Configuration including API key
            
        Raises:
            ValueError: If API key not provided
        """
        if not config.api_key:
            raise ValueError("FRED API key is required. Get one at https://fred.stlouisfed.org/docs/api/api_key.html")
        
        super().__init__(config)
        
        # Standard headers
        self.headers = {
            'User-Agent': 'Financial Analysis Platform FRED Collector v1.0'
        }
        
        # Rate limiter (be conservative with FRED)
        rate_config = RateLimitConfig(
            requests_per_minute=120,  # 2 per second
            burst_limit=10
        )
        self.rate_limiter = RateLimiter(rate_config, "fred")
        
        # Error handler
        retry_config = RetryConfig(
            max_attempts=3,
            initial_delay=1.0,
            backoff_factor=2.0,
            retry_on=(NetworkError,)
        )
        self.error_handler = ErrorHandler(retry_config, name="fred")
        
        # Cache for series metadata
        self._series_cache: Dict[str, Dict] = {}
        self._categories_cache: Optional[Dict] = None
        
        logger.info("FRED collector initialized")
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "Federal Reserve Economic Data (FRED)"
    
    @property 
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            "series",              # Economic time series data
            "observations",        # Data observations for series
            "series_info",         # Series metadata and information
            "series_search",       # Search for series by text
            "series_updates",      # Recently updated series
            "releases",            # Economic data releases
            "release_info",        # Specific release information  
            "release_series",      # Series within a release
            "release_dates",       # Release schedule dates
            "categories",          # Data categories
            "category_series",     # Series within categories
            "sources",             # Data sources information
            "tags",                # Available tags
            "tags_series",         # Series matching tags
            "series_tags",         # Tags for specific series
            "economic_calendar",   # Upcoming release calendar
            "dashboard"            # Key indicators dashboard
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """FRED requires a free API key."""
        return True
    
    def authenticate(self) -> bool:
        """
        Test authentication with FRED API.
        
        Returns:
            True if authentication successful, False otherwise
        """
        try:
            # Test with a simple API call
            response = self._make_request("category", {"category_id": 0})
            
            if response.status_code == 200:
                data = response.json()
                if 'categories' in data:
                    self._authenticated = True
                    logger.info("FRED API authentication successful")
                else:
                    self._authenticated = False
                    logger.error("FRED API authentication failed: Invalid response format")
            elif response.status_code == 400:
                self._authenticated = False
                logger.error("FRED API authentication failed: Invalid API key")
            else:
                self._authenticated = False
                logger.error(f"FRED API authentication failed: HTTP {response.status_code}")
            
            return self._authenticated
            
        except Exception as e:
            logger.error(f"FRED authentication error: {e}")
            self._authenticated = False
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to FRED API."""
        try:
            start_time = datetime.now()
            response = self._make_request("category", {"category_id": 0})
            duration = (datetime.now() - start_time).total_seconds()
            
            return {
                "connected": response.status_code == 200,
                "status_code": response.status_code,
                "response_time_ms": duration * 1000,
                "api_key_valid": response.status_code != 400,
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
    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> requests.Response:
        """Make rate-limited request to FRED API."""
        # Apply rate limiting
        self.rate_limiter.acquire("fred_api", timeout=30)
        
        # Add API key and format
        request_params = params or {}
        request_params.update({
            'api_key': self.config.api_key,
            'file_type': 'json'
        })
        
        url = urljoin(self.BASE_URL, endpoint)
        
        try:
            response = requests.get(
                url,
                params=request_params,
                headers=self.headers,
                timeout=self.config.timeout
            )
            
            # Check for authentication errors
            if response.status_code == 400:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                if 'error_message' in error_data and 'api_key' in error_data['error_message'].lower():
                    raise AuthenticationError("Invalid FRED API key")
            
            # Check for rate limiting
            if response.status_code == 429:
                raise NetworkError("FRED rate limit exceeded", response.status_code)
            
            # Check for other HTTP errors
            if response.status_code >= 400:
                raise NetworkError(f"FRED API error: {response.status_code}", response.status_code)
            
            return response
            
        except requests.RequestException as e:
            raise NetworkError(f"Request to FRED failed: {e}")
    
    def collect_batch(
        self, 
        symbols: List[str], 
        date_range: DateRange,
        frequency: DataFrequency = DataFrequency.MONTHLY,
        data_type: str = "series"
    ) -> pd.DataFrame:
        """
        Collect economic data for multiple series.
        
        Args:
            symbols: List of FRED series IDs
            date_range: Date range for data collection
            frequency: Data frequency
            data_type: Type of data to collect
            
        Returns:
            DataFrame with economic data
        """
        logger.info(f"Collecting FRED data for {len(symbols)} series from {date_range.start_date} to {date_range.end_date}")
        
        all_data = []
        
        for series_id in symbols:
            try:
                if data_type == "series":
                    data = self.get_series_observations(series_id, date_range, frequency)
                    if not data.empty:
                        data['series_id'] = series_id
                        all_data.append(data)
                
                elif data_type == "series_info":
                    info = self.get_series_info(series_id)
                    if info:
                        all_data.append(info)
                
                # Small delay between requests
                time.sleep(0.1)
                
            except Exception as e:
                logger.warning(f"Failed to collect FRED data for series {series_id}: {e}")
                continue
        
        if not all_data:
            return pd.DataFrame()
        
        # Combine data based on type
        if data_type == "series":
            # Concatenate all series data
            df = pd.concat(all_data, ignore_index=True)
            
            # Add metadata
            df['collector_source'] = self.source_name
            df['collection_timestamp'] = datetime.now()
            
        else:
            # Convert list of dicts to DataFrame
            df = pd.DataFrame(all_data)
            df['collector_source'] = self.source_name
            df['collection_timestamp'] = datetime.now()
        
        logger.info(f"Successfully collected {len(df)} records from FRED")
        return df
    
    def collect_realtime(
        self, 
        symbols: List[str],
        data_type: str = "series"
    ) -> Iterator[Dict[str, Any]]:
        """
        Collect real-time economic data.
        Note: FRED data is typically updated on release schedules, not real-time.
        
        Args:
            symbols: List of FRED series IDs
            data_type: Type of data to collect
            
        Yields:
            Dictionary with latest economic data
        """
        logger.info(f"Starting real-time FRED monitoring for {len(symbols)} series")
        
        for series_id in symbols:
            try:
                # Get latest observation
                latest_data = self.get_latest_observation(series_id)
                if latest_data:
                    latest_data.update({
                        'series_id': series_id,
                        'timestamp': datetime.now().isoformat(),
                        'data_type': 'latest_observation'
                    })
                    yield latest_data
                
                # Get series info for context
                series_info = self.get_series_info(series_id)
                if series_info:
                    series_info.update({
                        'series_id': series_id,
                        'timestamp': datetime.now().isoformat(),
                        'data_type': 'series_info'
                    })
                    yield series_info
                    
            except Exception as e:
                logger.error(f"Error in real-time collection for FRED series {series_id}: {e}")
                continue
    
    def get_series_observations(
        self, 
        series_id: str, 
        date_range: DateRange,
        frequency: Optional[DataFrequency] = None
    ) -> pd.DataFrame:
        """
        Get observations for a FRED series.
        
        Args:
            series_id: FRED series identifier
            date_range: Date range for observations
            frequency: Optional frequency conversion
            
        Returns:
            DataFrame with observations
        """
        params = {
            'series_id': series_id,
            'observation_start': date_range.start_date.strftime('%Y-%m-%d'),
            'observation_end': date_range.end_date.strftime('%Y-%m-%d'),
            'sort_order': 'asc'
        }
        
        # Add frequency if specified
        if frequency:
            freq_mapping = {
                DataFrequency.DAILY: 'd',
                DataFrequency.WEEKLY: 'w',
                DataFrequency.MONTHLY: 'm',
                DataFrequency.QUARTERLY: 'q',
                DataFrequency.ANNUALLY: 'a'
            }
            if frequency in freq_mapping:
                params['frequency'] = freq_mapping[frequency]
        
        try:
            response = self._make_request("series/observations", params)
            data = response.json()
            
            if 'observations' not in data:
                logger.warning(f"No observations found for series {series_id}")
                return pd.DataFrame()
            
            observations = data['observations']
            
            # Convert to DataFrame
            df = pd.DataFrame(observations)
            
            # Process data
            df['date'] = pd.to_datetime(df['date'])
            df['value'] = pd.to_numeric(df['value'], errors='coerce')
            
            # Remove missing values (marked as '.')
            df = df[df['value'].notna()]
            
            # Set date as index
            df = df.set_index('date')
            
            return df
            
        except Exception as e:
            logger.error(f"Failed to get observations for series {series_id}: {e}")
            return pd.DataFrame()
    
    def get_series_info(self, series_id: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata information for a FRED series.
        
        Args:
            series_id: FRED series identifier
            
        Returns:
            Dictionary with series metadata
        """
        if series_id in self._series_cache:
            return self._series_cache[series_id]
        
        try:
            response = self._make_request("series", {"series_id": series_id})
            data = response.json()
            
            if 'seriess' not in data or not data['seriess']:
                logger.warning(f"Series info not found for {series_id}")
                return None
            
            series_info = data['seriess'][0]  # API returns list with single item
            
            # Cache the result
            self._series_cache[series_id] = series_info
            
            return series_info
            
        except Exception as e:
            logger.error(f"Failed to get series info for {series_id}: {e}")
            return None
    
    def get_latest_observation(self, series_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the most recent observation for a series.
        
        Args:
            series_id: FRED series identifier
            
        Returns:
            Dictionary with latest observation
        """
        try:
            params = {
                'series_id': series_id,
                'limit': 1,
                'sort_order': 'desc'
            }
            
            response = self._make_request("series/observations", params)
            data = response.json()
            
            if 'observations' not in data or not data['observations']:
                return None
            
            latest = data['observations'][0]
            
            # Convert value to float if possible
            try:
                latest['value'] = float(latest['value'])
            except (ValueError, TypeError):
                pass  # Keep original value if not convertible
            
            return latest
            
        except Exception as e:
            logger.error(f"Failed to get latest observation for {series_id}: {e}")
            return None
    
    def search_series(self, search_text: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Search for FRED series by text.
        
        Args:
            search_text: Text to search for
            limit: Maximum number of results
            
        Returns:
            List of matching series
        """
        try:
            params = {
                'search_text': search_text,
                'limit': limit,
                'sort_order': 'search_rank'
            }
            
            response = self._make_request("series/search", params)
            data = response.json()
            
            return data.get('seriess', [])
            
        except Exception as e:
            logger.error(f"Failed to search FRED series: {e}")
            return []
    
    def get_available_symbols(
        self, 
        exchange: Optional[str] = None,
        sector: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get popular economic indicators available from FRED.
        
        Args:
            exchange: Not applicable for FRED
            sector: Economic sector filter (not implemented)
            
        Returns:
            List of popular series information
        """
        symbols = []
        
        for series_id, description in self.POPULAR_SERIES.items():
            info = self.get_series_info(series_id)
            if info:
                symbols.append({
                    'symbol': series_id,
                    'name': description,
                    'title': info.get('title', description),
                    'units': info.get('units', ''),
                    'frequency': info.get('frequency', ''),
                    'last_updated': info.get('last_updated', ''),
                    'observation_start': info.get('observation_start', ''),
                    'observation_end': info.get('observation_end', '')
                })
            else:
                # Fallback if API call fails
                symbols.append({
                    'symbol': series_id,
                    'name': description,
                    'title': description
                })
        
        return symbols
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get current rate limit status."""
        return self.rate_limiter.get_status("fred_api")
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate if series IDs exist in FRED database.
        
        Args:
            symbols: List of FRED series IDs to validate
            
        Returns:
            Dictionary mapping series IDs to validation status
        """
        validation_results = {}
        
        for series_id in symbols:
            try:
                info = self.get_series_info(series_id)
                validation_results[series_id] = info is not None
            except Exception:
                validation_results[series_id] = False
        
        return validation_results
    
    def get_popular_indicators(self) -> Dict[str, str]:
        """Get dictionary of popular economic indicators."""
        return self.POPULAR_SERIES.copy()
    
    def get_series_updates(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get series sorted by most recent updates.
        
        Args:
            limit: Maximum number of series to return
            
        Returns:
            List of recently updated series with metadata
        """
        try:
            params = {
                'limit': limit,
                'sort_order': 'last_updated',
                'order_by': 'last_updated'
            }
            
            response = self._make_request("series/updates", params)
            data = response.json()
            
            return data.get('seriess', [])
            
        except Exception as e:
            logger.error(f"Failed to get series updates: {e}")
            return []
    
    def get_releases(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get all economic data releases.
        
        Args:
            limit: Maximum number of releases to return
            
        Returns:
            List of economic data releases
        """
        try:
            params = {
                'limit': limit,
                'sort_order': 'asc',
                'order_by': 'release_id'
            }
            
            response = self._make_request("releases", params)
            data = response.json()
            
            return data.get('releases', [])
            
        except Exception as e:
            logger.error(f"Failed to get releases: {e}")
            return []
    
    def get_release_info(self, release_id: int) -> Optional[Dict[str, Any]]:
        """
        Get information about a specific release.
        
        Args:
            release_id: FRED release ID
            
        Returns:
            Dictionary with release information
        """
        try:
            params = {'release_id': release_id}
            
            response = self._make_request("release", params)
            data = response.json()
            
            releases = data.get('releases', [])
            return releases[0] if releases else None
            
        except Exception as e:
            logger.error(f"Failed to get release info for {release_id}: {e}")
            return None
    
    def get_release_series(self, release_id: int, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Get all series within a specific release.
        
        Args:
            release_id: FRED release ID
            limit: Maximum number of series to return
            
        Returns:
            List of series in the release
        """
        try:
            params = {
                'release_id': release_id,
                'limit': limit,
                'sort_order': 'asc',
                'order_by': 'series_id'
            }
            
            response = self._make_request("release/series", params)
            data = response.json()
            
            return data.get('seriess', [])
            
        except Exception as e:
            logger.error(f"Failed to get release series for release {release_id}: {e}")
            return []
    
    def get_release_dates(self, release_id: int, 
                         start_date: Optional[date] = None,
                         end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        """
        Get release dates for a specific release.
        
        Args:
            release_id: FRED release ID
            start_date: Start date for release dates
            end_date: End date for release dates
            
        Returns:
            List of release dates
        """
        try:
            params = {'release_id': release_id}
            
            if start_date:
                params['realtime_start'] = start_date.strftime('%Y-%m-%d')
            if end_date:
                params['realtime_end'] = end_date.strftime('%Y-%m-%d')
            
            response = self._make_request("release/dates", params)
            data = response.json()
            
            return data.get('release_dates', [])
            
        except Exception as e:
            logger.error(f"Failed to get release dates for release {release_id}: {e}")
            return []
    
    def get_tags_series(self, tag_names: List[str], limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get series matching specific tags.
        
        Args:
            tag_names: List of tag names to match
            limit: Maximum number of series to return
            
        Returns:
            List of series matching the tags
        """
        try:
            params = {
                'tag_names': ';'.join(tag_names),
                'limit': limit,
                'sort_order': 'asc',
                'order_by': 'series_id'
            }
            
            response = self._make_request("tags/series", params)
            data = response.json()
            
            return data.get('seriess', [])
            
        except Exception as e:
            logger.error(f"Failed to get series for tags {tag_names}: {e}")
            return []
    
    def get_category_series(self, category_id: int, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Get all series within a specific category.
        
        Args:
            category_id: FRED category ID
            limit: Maximum number of series to return
            
        Returns:
            List of series in the category
        """
        try:
            params = {
                'category_id': category_id,
                'limit': limit,
                'sort_order': 'asc',
                'order_by': 'series_id'
            }
            
            response = self._make_request("category/series", params)
            data = response.json()
            
            return data.get('seriess', [])
            
        except Exception as e:
            logger.error(f"Failed to get category series for category {category_id}: {e}")
            return []
    
    def get_categories(self, category_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get economic data categories.
        
        Args:
            category_id: Specific category ID, or None for root categories
            
        Returns:
            List of categories
        """
        try:
            params = {}
            endpoint = "category"
            
            if category_id is not None:
                params['category_id'] = category_id
                endpoint = "category/children"
            
            response = self._make_request(endpoint, params)
            data = response.json()
            
            return data.get('categories', [])
            
        except Exception as e:
            logger.error(f"Failed to get categories: {e}")
            return []
    
    def get_sources(self) -> List[Dict[str, Any]]:
        """
        Get all FRED data sources.
        
        Returns:
            List of data sources
        """
        try:
            response = self._make_request("sources")
            data = response.json()
            
            return data.get('sources', [])
            
        except Exception as e:
            logger.error(f"Failed to get sources: {e}")
            return []
    
    def find_series_by_tags(self, search_tags: List[str], 
                           exclude_tags: Optional[List[str]] = None,
                           limit: int = 100) -> List[Dict[str, Any]]:
        """
        Advanced series search using tags with inclusion/exclusion.
        
        Args:
            search_tags: Tags that series must have
            exclude_tags: Tags that series must NOT have  
            limit: Maximum number of series to return
            
        Returns:
            List of series matching the tag criteria
        """
        try:
            # Get series with required tags
            series_with_tags = self.get_tags_series(search_tags, limit * 2)
            
            if not exclude_tags:
                return series_with_tags[:limit]
            
            # Filter out series with excluded tags
            filtered_series = []
            for series in series_with_tags:
                series_id = series.get('id')
                if series_id:
                    # Check if series has any excluded tags
                    series_tags = self.get_series_tags(series_id)
                    series_tag_names = [tag.get('name', '') for tag in series_tags]
                    
                    has_excluded_tag = any(tag in series_tag_names for tag in exclude_tags)
                    if not has_excluded_tag:
                        filtered_series.append(series)
                        
                        if len(filtered_series) >= limit:
                            break
            
            return filtered_series
            
        except Exception as e:
            logger.error(f"Failed to find series by tags: {e}")
            return []
    
    def get_series_tags(self, series_id: str) -> List[Dict[str, Any]]:
        """
        Get tags for a specific series.
        
        Args:
            series_id: FRED series ID
            
        Returns:
            List of tags for the series
        """
        try:
            params = {'series_id': series_id}
            
            response = self._make_request("series/tags", params)
            data = response.json()
            
            return data.get('tags', [])
            
        except Exception as e:
            logger.error(f"Failed to get tags for series {series_id}: {e}")
            return []
    
    def get_economic_calendar(self, days_ahead: int = 30) -> List[Dict[str, Any]]:
        """
        Get upcoming economic data releases (economic calendar).
        
        Args:
            days_ahead: Number of days ahead to look for releases
            
        Returns:
            List of upcoming releases with dates
        """
        try:
            end_date = date.today() + timedelta(days=days_ahead)
            
            # Get all releases first
            releases = self.get_releases(limit=200)
            
            calendar_items = []
            
            # Get release dates for each major release
            important_releases = [
                {'id': 10, 'name': 'Employment Situation'},
                {'id': 53, 'name': 'Gross Domestic Product'},  
                {'id': 24, 'name': 'Consumer Price Index'},
                {'id': 21, 'name': 'Federal Open Market Committee'},
                {'id': 16, 'name': 'Industrial Production and Capacity Utilization'},
                {'id': 25, 'name': 'Producer Price Index'},
                {'id': 52, 'name': 'Personal Income and Outlays'}
            ]
            
            for release_info in important_releases:
                try:
                    release_dates = self.get_release_dates(
                        release_info['id'],
                        start_date=date.today(),
                        end_date=end_date
                    )
                    
                    for release_date in release_dates:
                        calendar_item = {
                            'release_id': release_info['id'],
                            'release_name': release_info['name'],
                            'date': release_date.get('date'),
                            'description': f"{release_info['name']} Release"
                        }
                        calendar_items.append(calendar_item)
                        
                except Exception as e:
                    logger.debug(f"Could not get dates for release {release_info['id']}: {e}")
                    continue
            
            # Sort by date
            calendar_items.sort(key=lambda x: x.get('date', ''))
            
            return calendar_items
            
        except Exception as e:
            logger.error(f"Failed to get economic calendar: {e}")
            return []
    
    def get_key_indicators_dashboard(self) -> Dict[str, Any]:
        """
        Get a dashboard view of key economic indicators with latest values.
        
        Returns:
            Dictionary organized by economic categories with latest values
        """
        try:
            dashboard = {
                'employment': {},
                'inflation': {}, 
                'growth': {},
                'monetary_policy': {},
                'housing': {},
                'international': {},
                'last_updated': datetime.now().isoformat()
            }
            
            # Define key indicators by category
            key_indicators = {
                'employment': ['UNRATE', 'PAYEMS', 'CIVPART'],
                'inflation': ['CPIAUCSL', 'CPILFESL', 'PCEPI'],
                'growth': ['GDP', 'GDPC1', 'INDPRO'],
                'monetary_policy': ['FEDFUNDS', 'M1SL', 'M2SL'],
                'housing': ['HOUST', 'CSUSHPISA'],
                'international': ['DEXUSEU', 'DEXJPUS']
            }
            
            # Get latest values for each category
            for category, series_ids in key_indicators.items():
                for series_id in series_ids:
                    try:
                        latest = self.get_latest_observation(series_id)
                        series_info = self.get_series_info(series_id)
                        
                        if latest and series_info:
                            dashboard[category][series_id] = {
                                'value': latest.get('value'),
                                'date': latest.get('date'),
                                'title': series_info.get('title', series_id),
                                'units': series_info.get('units', ''),
                                'frequency': series_info.get('frequency', ''),
                                'last_updated': series_info.get('last_updated', '')
                            }
                    except Exception as e:
                        logger.debug(f"Could not get data for {series_id}: {e}")
                        continue
            
            return dashboard
            
        except Exception as e:
            logger.error(f"Failed to get key indicators dashboard: {e}")
            return {}