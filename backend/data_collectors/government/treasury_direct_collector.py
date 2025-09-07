"""
Treasury Direct API Collector

Collects data from the U.S. Treasury's Treasury Direct API, which provides
information about US Treasury securities, auctions, and interest rates.

Data Sources:
- Treasury securities (Bills, Notes, Bonds, TIPS, FRNs)
- Auction data and results
- Interest rates and yields
- Historical pricing information
- Security details and specifications

API Documentation: https://www.treasurydirect.gov/webapis/
Rate Limits: No explicit limits, but should be used reasonably
Authentication: No API key required

Key Data Types:
- Securities: Active and historical treasury securities
- Auctions: Auction announcements and results  
- Interest Rates: Historical interest rate data
- Redemption Values: I Bond and EE Bond values
"""

import json
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
    DataValidationError
)

import logging

logger = logging.getLogger(__name__)


class TreasuryDirectCollector(DataCollectorInterface):
    """
    U.S. Treasury Direct API collector for treasury securities data.
    
    Provides access to:
    - Treasury Bills, Notes, Bonds, TIPS, FRNs
    - Auction data and results
    - Interest rates and yields  
    - Historical security information
    - Redemption values for savings bonds
    
    No API key required, but rate limiting is applied for courtesy.
    """
    
    BASE_URL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/"
    
    # Available datasets
    DATASETS = {
        'treasury_securities': 'v1/accounting/od/debt_to_penny',
        'daily_treasury_yield': 'v1/accounting/od/daily_treasury_yield_curve',
        'auction_data': 'v1/accounting/od/auctions_query',
        'interest_rates': 'v1/accounting/od/avg_interest_rates', 
        'redemption_tables': 'v1/accounting/od/redemption_tables',
        'gold_reserve': 'v1/accounting/od/gold_reserve',
        'gift_contributions': 'v1/accounting/od/gift_contributions_public_debt'
    }
    
    # Security types available
    SECURITY_TYPES = {
        'bills': 'Treasury Bills (T-Bills)',
        'notes': 'Treasury Notes (T-Notes)', 
        'bonds': 'Treasury Bonds (T-Bonds)',
        'tips': 'Treasury Inflation-Protected Securities (TIPS)',
        'frns': 'Floating Rate Notes (FRNs)',
        'savings': 'Savings Bonds (I and EE Bonds)'
    }
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """
        Initialize Treasury Direct collector.
        
        Args:
            config: Optional collector configuration
        """
        # Use default config if none provided
        if config is None:
            config = CollectorConfig(
                requests_per_minute=120,  # Conservative rate
                timeout=30,
                max_retries=3
            )
        
        super().__init__(config)
        
        # Standard headers
        self.headers = {
            'User-Agent': 'Financial Analysis Platform Treasury Collector v1.0',
            'Accept': 'application/json'
        }
        
        # Rate limiter (be conservative)
        rate_config = RateLimitConfig(
            requests_per_minute=60,  # 1 per second
            burst_limit=10
        )
        self.rate_limiter = RateLimiter(rate_config, "treasury_direct")
        
        # Error handler
        retry_config = RetryConfig(
            max_attempts=3,
            initial_delay=1.0,
            backoff_factor=2.0,
            retry_on=(NetworkError,)
        )
        self.error_handler = ErrorHandler(retry_config, name="treasury_direct")
        
        # Cache for metadata
        self._metadata_cache: Dict[str, Any] = {}
        
        logger.info("Treasury Direct collector initialized")
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "U.S. Treasury Direct"
    
    @property 
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            "treasury_securities",    # Active treasury securities
            "daily_treasury_yield",   # Daily yield curve data
            "auction_data",          # Treasury auction information  
            "interest_rates",        # Average interest rates
            "redemption_tables",     # Savings bond redemption values
            "debt_to_penny",         # Total public debt data
            "gold_reserve"           # Gold reserve information
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """Treasury Direct API does not require authentication."""
        return False
    
    def authenticate(self) -> bool:
        """
        Test connection to Treasury Direct API.
        No authentication required, just verify API is accessible.
        """
        try:
            # Test with a simple query
            response = self._make_request(
                self.DATASETS['daily_treasury_yield'],
                {"filter": "record_date:gte:2023-01-01", "page[size]": "1"}
            )
            
            self._authenticated = response.status_code == 200
            
            if self._authenticated:
                logger.info("Treasury Direct API connection verified")
            else:
                logger.error(f"Treasury Direct API connection failed: {response.status_code}")
            
            return self._authenticated
            
        except Exception as e:
            logger.error(f"Treasury Direct authentication failed: {e}")
            self._authenticated = False
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to Treasury Direct API."""
        try:
            start_time = datetime.now()
            response = self._make_request(
                self.DATASETS['daily_treasury_yield'],
                {"page[size]": "1"}
            )
            duration = (datetime.now() - start_time).total_seconds()
            
            return {
                "connected": response.status_code == 200,
                "status_code": response.status_code,
                "response_time_ms": duration * 1000,
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
        """Make rate-limited request to Treasury Direct API."""
        # Apply rate limiting
        self.rate_limiter.acquire("treasury_api", timeout=30)
        
        url = urljoin(self.BASE_URL, endpoint)
        
        # Default parameters
        request_params = params or {}
        request_params.setdefault('format', 'json')
        
        try:
            response = requests.get(
                url,
                params=request_params,
                headers=self.headers,
                timeout=self.config.timeout
            )
            
            # Check for rate limiting
            if response.status_code == 429:
                raise NetworkError("Treasury Direct rate limit exceeded", response.status_code)
            
            # Check for other HTTP errors
            if response.status_code >= 400:
                raise NetworkError(f"Treasury Direct API error: {response.status_code}", response.status_code)
            
            return response
            
        except requests.RequestException as e:
            raise NetworkError(f"Request to Treasury Direct failed: {e}")
    
    def collect_batch(
        self, 
        symbols: List[str], 
        date_range: DateRange,
        frequency: DataFrequency = DataFrequency.DAILY,
        data_type: str = "daily_treasury_yield"
    ) -> pd.DataFrame:
        """
        Collect treasury data for specified symbols/securities.
        
        Args:
            symbols: List of treasury security identifiers or data types
            date_range: Date range for data collection
            frequency: Data frequency (daily, weekly, monthly)
            data_type: Type of treasury data to collect
            
        Returns:
            DataFrame with treasury data
        """
        logger.info(f"Collecting Treasury {data_type} data from {date_range.start_date} to {date_range.end_date}")
        
        all_data = []
        
        # For treasury data, symbols often represent maturity periods or specific datasets
        for symbol in symbols:
            try:
                if data_type == "daily_treasury_yield":
                    data = self.get_daily_yield_curve(date_range, symbol)
                    if not data.empty:
                        data['symbol'] = symbol
                        all_data.append(data)
                
                elif data_type == "auction_data":
                    data = self.get_auction_data(date_range, symbol)
                    if not data.empty:
                        data['symbol'] = symbol
                        all_data.append(data)
                
                elif data_type == "interest_rates":
                    data = self.get_interest_rates(date_range, symbol)
                    if not data.empty:
                        data['symbol'] = symbol
                        all_data.append(data)
                
                # Small delay between requests
                time.sleep(0.2)
                
            except Exception as e:
                logger.warning(f"Failed to collect Treasury data for {symbol}: {e}")
                continue
        
        if not all_data:
            return pd.DataFrame()
        
        # Combine all data
        df = pd.concat(all_data, ignore_index=True)
        
        # Add metadata
        df['collector_source'] = self.source_name
        df['collection_timestamp'] = datetime.now()
        
        logger.info(f"Successfully collected {len(df)} Treasury records")
        return df
    
    def collect_realtime(
        self, 
        symbols: List[str],
        data_type: str = "daily_treasury_yield"
    ) -> Iterator[Dict[str, Any]]:
        """
        Collect latest treasury data.
        Treasury data is typically updated daily, not real-time.
        
        Args:
            symbols: List of treasury identifiers
            data_type: Type of data to collect
            
        Yields:
            Dictionary with latest treasury data
        """
        logger.info(f"Starting real-time Treasury monitoring for {data_type}")
        
        for symbol in symbols:
            try:
                # Get latest data point
                if data_type == "daily_treasury_yield":
                    latest_data = self.get_latest_yield_curve(symbol)
                elif data_type == "auction_data":
                    latest_data = self.get_latest_auction_data(symbol)
                else:
                    continue
                
                if latest_data:
                    latest_data.update({
                        'symbol': symbol,
                        'data_type': data_type,
                        'timestamp': datetime.now().isoformat()
                    })
                    yield latest_data
                    
            except Exception as e:
                logger.error(f"Error in real-time Treasury collection for {symbol}: {e}")
                continue
    
    def get_daily_yield_curve(self, date_range: DateRange, maturity: Optional[str] = None) -> pd.DataFrame:
        """
        Get daily treasury yield curve data.
        
        Args:
            date_range: Date range for data
            maturity: Specific maturity to filter (e.g., '10 Yr')
            
        Returns:
            DataFrame with yield curve data
        """
        # Build filter for date range
        filters = [
            f"record_date:gte:{date_range.start_date.strftime('%Y-%m-%d')}",
            f"record_date:lte:{date_range.end_date.strftime('%Y-%m-%d')}"
        ]
        
        # Add maturity filter if specified
        if maturity:
            filters.append(f"maturity:eq:{maturity}")
        
        params = {
            "filter": ",".join(filters),
            "sort": "record_date",
            "page[size]": "10000"  # Large page size to get all data
        }
        
        try:
            response = self._make_request(self.DATASETS['daily_treasury_yield'], params)
            data = response.json()
            
            if 'data' not in data or not data['data']:
                logger.warning("No daily yield curve data found")
                return pd.DataFrame()
            
            # Convert to DataFrame
            df = pd.DataFrame(data['data'])
            
            # Process data types
            if 'record_date' in df.columns:
                df['record_date'] = pd.to_datetime(df['record_date'])
                df = df.set_index('record_date')
            
            # Convert yield columns to numeric
            numeric_columns = ['new_date', 'value']
            for col in numeric_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            return df
            
        except Exception as e:
            logger.error(f"Failed to get daily yield curve data: {e}")
            return pd.DataFrame()
    
    def get_latest_yield_curve(self, maturity: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get the most recent yield curve data.
        
        Args:
            maturity: Specific maturity to get
            
        Returns:
            Dictionary with latest yield data
        """
        try:
            # Get last 30 days to ensure we get the most recent data
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
            
            filters = [
                f"record_date:gte:{start_date.strftime('%Y-%m-%d')}",
                f"record_date:lte:{end_date.strftime('%Y-%m-%d')}"
            ]
            
            if maturity:
                filters.append(f"maturity:eq:{maturity}")
            
            params = {
                "filter": ",".join(filters),
                "sort": "-record_date",  # Descending order
                "page[size]": "1"
            }
            
            response = self._make_request(self.DATASETS['daily_treasury_yield'], params)
            data = response.json()
            
            if 'data' not in data or not data['data']:
                return None
            
            latest = data['data'][0]
            
            # Convert value to float if possible
            if 'value' in latest:
                try:
                    latest['value'] = float(latest['value'])
                except (ValueError, TypeError):
                    pass
            
            return latest
            
        except Exception as e:
            logger.error(f"Failed to get latest yield curve data: {e}")
            return None
    
    def get_auction_data(self, date_range: DateRange, security_type: Optional[str] = None) -> pd.DataFrame:
        """
        Get treasury auction data.
        
        Args:
            date_range: Date range for auctions
            security_type: Type of security (bills, notes, bonds)
            
        Returns:
            DataFrame with auction data
        """
        # Build filter for date range
        filters = [
            f"auction_date:gte:{date_range.start_date.strftime('%Y-%m-%d')}",
            f"auction_date:lte:{date_range.end_date.strftime('%Y-%m-%d')}"
        ]
        
        if security_type:
            filters.append(f"security_type:eq:{security_type}")
        
        params = {
            "filter": ",".join(filters),
            "sort": "auction_date",
            "page[size]": "10000"
        }
        
        try:
            response = self._make_request(self.DATASETS['auction_data'], params)
            data = response.json()
            
            if 'data' not in data or not data['data']:
                logger.warning("No auction data found")
                return pd.DataFrame()
            
            # Convert to DataFrame
            df = pd.DataFrame(data['data'])
            
            # Process date columns
            date_columns = ['auction_date', 'issue_date', 'maturity_date']
            for col in date_columns:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
            
            # Convert numeric columns
            numeric_columns = ['high_yield', 'low_yield', 'median_yield']
            for col in numeric_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            return df
            
        except Exception as e:
            logger.error(f"Failed to get auction data: {e}")
            return pd.DataFrame()
    
    def get_latest_auction_data(self, security_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get the most recent auction data.
        
        Args:
            security_type: Type of security to filter
            
        Returns:
            Dictionary with latest auction data
        """
        try:
            # Get last 90 days
            end_date = date.today()
            start_date = end_date - timedelta(days=90)
            
            filters = [
                f"auction_date:gte:{start_date.strftime('%Y-%m-%d')}",
                f"auction_date:lte:{end_date.strftime('%Y-%m-%d')}"
            ]
            
            if security_type:
                filters.append(f"security_type:eq:{security_type}")
            
            params = {
                "filter": ",".join(filters),
                "sort": "-auction_date",
                "page[size]": "1"
            }
            
            response = self._make_request(self.DATASETS['auction_data'], params)
            data = response.json()
            
            if 'data' not in data or not data['data']:
                return None
            
            return data['data'][0]
            
        except Exception as e:
            logger.error(f"Failed to get latest auction data: {e}")
            return None
    
    def get_interest_rates(self, date_range: DateRange, rate_type: Optional[str] = None) -> pd.DataFrame:
        """
        Get average interest rates data.
        
        Args:
            date_range: Date range for data
            rate_type: Specific rate type to filter
            
        Returns:
            DataFrame with interest rates
        """
        filters = [
            f"record_date:gte:{date_range.start_date.strftime('%Y-%m-%d')}",
            f"record_date:lte:{date_range.end_date.strftime('%Y-%m-%d')}"
        ]
        
        if rate_type:
            filters.append(f"security_desc:eq:{rate_type}")
        
        params = {
            "filter": ",".join(filters),
            "sort": "record_date",
            "page[size]": "10000"
        }
        
        try:
            response = self._make_request(self.DATASETS['interest_rates'], params)
            data = response.json()
            
            if 'data' not in data or not data['data']:
                return pd.DataFrame()
            
            df = pd.DataFrame(data['data'])
            
            # Process dates and values
            if 'record_date' in df.columns:
                df['record_date'] = pd.to_datetime(df['record_date'])
                df = df.set_index('record_date')
            
            if 'avg_interest_rate_amt' in df.columns:
                df['avg_interest_rate_amt'] = pd.to_numeric(df['avg_interest_rate_amt'], errors='coerce')
            
            return df
            
        except Exception as e:
            logger.error(f"Failed to get interest rates: {e}")
            return pd.DataFrame()
    
    def get_available_symbols(
        self, 
        exchange: Optional[str] = None,
        sector: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get available Treasury security types and maturities.
        
        Args:
            exchange: Not applicable for Treasury data
            sector: Not applicable for Treasury data
            
        Returns:
            List of available Treasury symbols/types
        """
        symbols = []
        
        # Add common yield curve maturities
        yield_maturities = [
            '1 Mo', '2 Mo', '3 Mo', '4 Mo', '6 Mo',
            '1 Yr', '2 Yr', '3 Yr', '5 Yr', '7 Yr', '10 Yr', '20 Yr', '30 Yr'
        ]
        
        for maturity in yield_maturities:
            symbols.append({
                'symbol': maturity,
                'name': f'{maturity} Treasury Yield',
                'type': 'yield_curve',
                'description': f'Treasury yield for {maturity} maturity'
            })
        
        # Add security types
        for key, description in self.SECURITY_TYPES.items():
            symbols.append({
                'symbol': key,
                'name': description,
                'type': 'security_type',
                'description': f'Treasury {description}'
            })
        
        return symbols
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get current rate limit status."""
        return self.rate_limiter.get_status("treasury_api")
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate if symbols are valid Treasury identifiers.
        
        Args:
            symbols: List of symbols to validate
            
        Returns:
            Dictionary mapping symbols to validation status
        """
        validation_results = {}
        
        # Valid yield curve maturities
        valid_maturities = {'1 Mo', '2 Mo', '3 Mo', '4 Mo', '6 Mo', 
                           '1 Yr', '2 Yr', '3 Yr', '5 Yr', '7 Yr', '10 Yr', '20 Yr', '30 Yr'}
        
        # Valid security types
        valid_security_types = set(self.SECURITY_TYPES.keys())
        
        for symbol in symbols:
            # Check if it's a valid maturity or security type
            is_valid = (symbol in valid_maturities or 
                       symbol in valid_security_types or
                       symbol.lower() in valid_security_types)
            
            validation_results[symbol] = is_valid
        
        return validation_results
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if Treasury Direct collector should handle the request.
        
        Activates for:
        - Treasury-specific requests (bonds, bills, notes, yield curves)
        - Interest rate analysis
        - Government debt securities analysis
        - Auction data requests
        
        Does NOT activate for:
        - Individual company requests (SEC EDGAR territory)
        - Economic indicators (FRED territory)
        - Government spending/fiscal policy (Treasury Fiscal territory)
        """
        # Check for Treasury-specific request patterns
        treasury_indicators = [
            'treasury', 'bonds', 'bills', 'notes', 'yield_curve', 'interest_rates',
            'auction', 'tips', 'frns', 'savings_bonds', 'government_securities',
            'debt_securities', 'treasury_yield', 'treasury_auction'
        ]
        
        # Check if any Treasury indicators are present in keys or values
        for key, value in filter_criteria.items():
            key_lower = key.lower()
            if any(indicator in key_lower for indicator in treasury_indicators):
                return True
            
            # Check values for Treasury-related terms
            if isinstance(value, str):
                value_lower = value.lower()
                if any(indicator in value_lower for indicator in treasury_indicators):
                    return True
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and any(indicator in item.lower() for indicator in treasury_indicators):
                        return True
        
        # Check for specific Treasury data types
        if 'data_type' in filter_criteria:
            data_type = filter_criteria['data_type'].lower()
            if any(indicator in data_type for indicator in treasury_indicators):
                return True
        
        # Check for security types
        if 'security_types' in filter_criteria:
            security_types = filter_criteria['security_types']
            if isinstance(security_types, list):
                for sec_type in security_types:
                    if sec_type.lower() in self.SECURITY_TYPES:
                        return True
            elif isinstance(security_types, str):
                if security_types.lower() in self.SECURITY_TYPES:
                    return True
        
        # Check for maturity-related requests
        if 'maturities' in filter_criteria or 'maturity' in filter_criteria:
            return True
        
        # Don't activate for individual company requests (SEC EDGAR territory)
        if any(key in filter_criteria for key in ['companies', 'symbols', 'tickers', 'ciks']):
            return False
            
        # Don't activate for economic indicator requests (FRED territory)
        if any(key in filter_criteria for key in ['fred_series', 'economic_indicator']):
            return False
            
        # Don't activate for government spending/fiscal policy (Treasury Fiscal territory)
        if any(key in filter_criteria for key in ['government_spending', 'federal_budget', 'fiscal_policy']):
            return False
            
        return False
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Return priority level for Treasury Direct collector (0-100).
        
        Priority 95: Specific Treasury securities requests
        Priority 85: Treasury yield curve and interest rate requests
        Priority 75: General Treasury data requests
        Priority 0: Not applicable for this request type
        """
        if not self.should_activate(filter_criteria):
            return 0
            
        # Very high priority for specific Treasury securities
        high_priority_terms = ['treasury_auction', 'specific_securities', 'cusip']
        if any(term in str(filter_criteria).lower() for term in high_priority_terms):
            return 95
            
        # High priority for yield curve and interest rate requests
        medium_high_terms = ['yield_curve', 'interest_rates', 'treasury_yield', 'bonds', 'bills', 'notes']
        if any(term in str(filter_criteria).lower() for term in medium_high_terms):
            return 85
            
        # Medium-high priority for general Treasury requests
        medium_terms = ['treasury', 'government_securities', 'debt_securities']
        if any(term in str(filter_criteria).lower() for term in medium_terms):
            return 75
            
        return 60  # Default for other Treasury requests
    
    def filter_by_security_type(self, security_types: List[str], 
                               date_range: Optional[DateRange] = None) -> Dict[str, Any]:
        """
        Filter Treasury data by specific security types.
        
        Args:
            security_types: List of security types ('bills', 'notes', 'bonds', 'tips', 'frns')
            date_range: Optional date range for filtering
            
        Returns:
            Dictionary containing filtered Treasury securities data
        """
        if date_range is None:
            # Default to last year
            end_date = date.today()
            start_date = end_date - timedelta(days=365)
            date_range = DateRange(start_date, end_date)
        
        filtered_results = {
            'filter_criteria': {
                'security_types': security_types,
                'date_range': {
                    'start': date_range.start_date.isoformat(),
                    'end': date_range.end_date.isoformat()
                }
            },
            'results_by_type': {},
            'metadata': {
                'filter_date': datetime.now().isoformat(),
                'source': 'Treasury Direct Security Type Filter'
            }
        }
        
        for sec_type in security_types:
            if sec_type.lower() in self.SECURITY_TYPES:
                try:
                    # Get auction data for this security type
                    auction_data = self.get_auction_data(date_range, sec_type)
                    
                    # Get yield curve data if applicable
                    yield_data = None
                    if sec_type.lower() in ['notes', 'bonds']:
                        yield_data = self.get_daily_yield_curve(date_range)
                    
                    filtered_results['results_by_type'][sec_type] = {
                        'security_name': self.SECURITY_TYPES[sec_type.lower()],
                        'auction_data': auction_data.to_dict('records') if not auction_data.empty else [],
                        'yield_data': yield_data.to_dict('records') if yield_data is not None and not yield_data.empty else [],
                        'data_points': len(auction_data) if not auction_data.empty else 0
                    }
                except Exception as e:
                    logger.warning(f"Error filtering {sec_type} data: {e}")
                    filtered_results['results_by_type'][sec_type] = {
                        'error': f"Unable to retrieve {sec_type} data: {e}"
                    }
        
        return filtered_results
    
    def filter_by_maturity_range(self, min_maturity: str, max_maturity: str,
                                date_range: Optional[DateRange] = None) -> Dict[str, Any]:
        """
        Filter Treasury yield data by maturity range.
        
        Args:
            min_maturity: Minimum maturity (e.g., '1 Yr')
            max_maturity: Maximum maturity (e.g., '10 Yr')
            date_range: Optional date range for filtering
            
        Returns:
            Dictionary containing yield data within maturity range
        """
        if date_range is None:
            # Default to last 3 months
            end_date = date.today()
            start_date = end_date - timedelta(days=90)
            date_range = DateRange(start_date, end_date)
        
        # Define maturity ordering for filtering
        maturity_order = [
            '1 Mo', '2 Mo', '3 Mo', '4 Mo', '6 Mo',
            '1 Yr', '2 Yr', '3 Yr', '5 Yr', '7 Yr', '10 Yr', '20 Yr', '30 Yr'
        ]
        
        try:
            min_idx = maturity_order.index(min_maturity)
            max_idx = maturity_order.index(max_maturity)
        except ValueError as e:
            return {
                'error': f"Invalid maturity specified: {e}",
                'valid_maturities': maturity_order
            }
        
        if min_idx > max_idx:
            return {
                'error': f"Minimum maturity ({min_maturity}) cannot be greater than maximum ({max_maturity})"
            }
        
        target_maturities = maturity_order[min_idx:max_idx + 1]
        
        filtered_results = {
            'filter_criteria': {
                'maturity_range': {
                    'min': min_maturity,
                    'max': max_maturity,
                    'included_maturities': target_maturities
                },
                'date_range': {
                    'start': date_range.start_date.isoformat(),
                    'end': date_range.end_date.isoformat()
                }
            },
            'yield_data': [],
            'maturity_analysis': {},
            'metadata': {
                'filter_date': datetime.now().isoformat(),
                'source': 'Treasury Direct Maturity Range Filter'
            }
        }
        
        try:
            # Get yield curve data for the date range
            all_yield_data = self.get_daily_yield_curve(date_range)
            
            if not all_yield_data.empty:
                # Filter by target maturities if the data has a maturity column
                if 'maturity' in all_yield_data.columns:
                    filtered_data = all_yield_data[all_yield_data['maturity'].isin(target_maturities)]
                    filtered_results['yield_data'] = filtered_data.to_dict('records')
                else:
                    # If no maturity column, return all data with a note
                    filtered_results['yield_data'] = all_yield_data.to_dict('records')
                    filtered_results['note'] = 'Maturity filtering unavailable - returning all yield curve data'
                
                # Calculate maturity analysis
                for maturity in target_maturities:
                    maturity_data = [record for record in filtered_results['yield_data'] 
                                   if record.get('maturity') == maturity]
                    if maturity_data:
                        yields = [float(record.get('value', 0)) for record in maturity_data 
                                if record.get('value') and record.get('value') != '.']
                        if yields:
                            filtered_results['maturity_analysis'][maturity] = {
                                'data_points': len(yields),
                                'latest_yield': yields[-1] if yields else None,
                                'average_yield': round(sum(yields) / len(yields), 3) if yields else None,
                                'min_yield': min(yields) if yields else None,
                                'max_yield': max(yields) if yields else None
                            }
            
        except Exception as e:
            logger.error(f"Error filtering by maturity range: {e}")
            filtered_results['error'] = f"Unable to filter by maturity range: {e}"
        
        return filtered_results
    
    def screen_by_yield_criteria(self, min_yield: Optional[float] = None, 
                               max_yield: Optional[float] = None,
                               target_maturities: Optional[List[str]] = None,
                               date_range: Optional[DateRange] = None) -> Dict[str, Any]:
        """
        Screen Treasury securities by yield criteria.
        
        Args:
            min_yield: Minimum yield threshold (as percentage)
            max_yield: Maximum yield threshold (as percentage) 
            target_maturities: Specific maturities to analyze
            date_range: Optional date range for analysis
            
        Returns:
            Dictionary containing securities meeting yield criteria
        """
        if date_range is None:
            # Default to last 30 days
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
            date_range = DateRange(start_date, end_date)
        
        if target_maturities is None:
            target_maturities = ['2 Yr', '5 Yr', '10 Yr', '30 Yr']  # Common benchmark maturities
        
        screening_results = {
            'screening_criteria': {
                'min_yield': min_yield,
                'max_yield': max_yield,
                'target_maturities': target_maturities,
                'date_range': {
                    'start': date_range.start_date.isoformat(),
                    'end': date_range.end_date.isoformat()
                }
            },
            'qualified_securities': [],
            'yield_analysis': {},
            'metadata': {
                'screening_date': datetime.now().isoformat(),
                'securities_screened': 0,
                'securities_qualified': 0,
                'source': 'Treasury Direct Yield Screening'
            }
        }
        
        try:
            # Get recent yield data
            for maturity in target_maturities:
                latest_yield_data = self.get_latest_yield_curve(maturity)
                
                if latest_yield_data and 'value' in latest_yield_data:
                    try:
                        current_yield = float(latest_yield_data['value'])
                        screening_results['metadata']['securities_screened'] += 1
                        
                        # Apply yield criteria
                        passes_screening = True
                        screening_details = {}
                        
                        if min_yield is not None:
                            passes = current_yield >= min_yield
                            screening_details['min_yield_check'] = {
                                'actual': current_yield,
                                'required': min_yield,
                                'passed': passes
                            }
                            passes_screening = passes_screening and passes
                        
                        if max_yield is not None:
                            passes = current_yield <= max_yield
                            screening_details['max_yield_check'] = {
                                'actual': current_yield,
                                'required_max': max_yield,
                                'passed': passes
                            }
                            passes_screening = passes_screening and passes
                        
                        if passes_screening:
                            qualified_security = {
                                'maturity': maturity,
                                'current_yield': current_yield,
                                'record_date': latest_yield_data.get('record_date'),
                                'screening_details': screening_details,
                                'qualification_status': 'QUALIFIED'
                            }
                            screening_results['qualified_securities'].append(qualified_security)
                            screening_results['metadata']['securities_qualified'] += 1
                        
                        # Add to yield analysis
                        screening_results['yield_analysis'][maturity] = {
                            'current_yield': current_yield,
                            'record_date': latest_yield_data.get('record_date'),
                            'passed_screening': passes_screening
                        }
                        
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Invalid yield value for {maturity}: {latest_yield_data.get('value')}")
                        continue
        
        except Exception as e:
            logger.error(f"Error in yield screening: {e}")
            screening_results['error'] = f"Yield screening failed: {e}"
        
        return screening_results