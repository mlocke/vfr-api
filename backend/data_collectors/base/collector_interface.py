"""
Base interface and configuration for all financial data collectors.

This module defines the standard interface that all data collectors must implement,
ensuring consistency across different data sources and enabling plug-and-play architecture.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, date
from typing import List, Dict, Any, Iterator, Optional, Union
import pandas as pd
from enum import Enum


class DataFrequency(Enum):
    """Data collection frequency options."""
    REALTIME = "realtime"
    MINUTE = "1min"
    HOUR = "1hour" 
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"


@dataclass
class DateRange:
    """Date range specification for data collection."""
    start_date: Union[date, datetime, str]
    end_date: Union[date, datetime, str]
    
    def __post_init__(self):
        """Convert string dates to datetime objects."""
        if isinstance(self.start_date, str):
            self.start_date = pd.to_datetime(self.start_date).date()
        if isinstance(self.end_date, str):
            self.end_date = pd.to_datetime(self.end_date).date()


@dataclass
class CollectorConfig:
    """Configuration settings for data collectors."""
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0
    cache_enabled: bool = True
    cache_ttl: int = 300  # seconds
    rate_limit_enabled: bool = True
    validate_data: bool = True
    log_level: str = "INFO"
    
    # API-specific settings
    requests_per_minute: int = 60
    requests_per_day: Optional[int] = None
    concurrent_requests: int = 1
    
    # Data processing settings
    normalize_symbols: bool = True
    handle_splits: bool = True
    adjust_dividends: bool = True


class DataCollectorInterface(ABC):
    """
    Abstract base class for all financial data collectors.
    
    This interface ensures all collectors provide consistent functionality:
    - Authentication management
    - Rate limiting and quota handling
    - Data validation and quality checks
    - Error handling and retry logic
    - Caching for performance
    - Standardized data formats
    """
    
    def __init__(self, config: CollectorConfig):
        """
        Initialize the data collector.
        
        Args:
            config: Configuration settings for the collector
        """
        self.config = config
        self.name = self.__class__.__name__
        self._authenticated = False
        self._session = None
        
    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the name of the data source (e.g., 'SEC EDGAR', 'Alpha Vantage')."""
        pass
    
    @property 
    @abstractmethod
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types (e.g., ['stocks', 'bonds', 'economic'])."""
        pass
    
    @property
    @abstractmethod
    def requires_api_key(self) -> bool:
        """Return True if this collector requires an API key."""
        pass
    
    @abstractmethod
    def authenticate(self) -> bool:
        """
        Authenticate with the data source.
        
        Returns:
            True if authentication successful, False otherwise
        """
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to the data source.
        
        Returns:
            Dictionary with connection status and details
        """
        pass
    
    @abstractmethod
    def collect_batch(
        self, 
        symbols: List[str], 
        date_range: DateRange,
        frequency: DataFrequency = DataFrequency.DAILY,
        data_type: str = "prices"
    ) -> pd.DataFrame:
        """
        Collect historical data for multiple symbols.
        
        Args:
            symbols: List of symbols to collect data for
            date_range: Date range for data collection
            frequency: Data frequency (daily, weekly, etc.)
            data_type: Type of data to collect (prices, fundamentals, etc.)
            
        Returns:
            DataFrame with standardized columns and multi-index (symbol, date)
        """
        pass
    
    @abstractmethod
    def collect_realtime(
        self, 
        symbols: List[str],
        data_type: str = "prices"
    ) -> Iterator[Dict[str, Any]]:
        """
        Collect real-time data for symbols.
        
        Args:
            symbols: List of symbols to collect data for
            data_type: Type of data to collect
            
        Yields:
            Dictionary with real-time data points
        """
        pass
    
    @abstractmethod
    def get_available_symbols(
        self, 
        exchange: Optional[str] = None,
        sector: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get list of available symbols from the data source.
        
        Args:
            exchange: Filter by exchange (optional)
            sector: Filter by sector (optional)
            
        Returns:
            List of dictionaries with symbol metadata
        """
        pass
    
    @abstractmethod
    def get_rate_limits(self) -> Dict[str, Any]:
        """
        Get current rate limit status.
        
        Returns:
            Dictionary with rate limit information
        """
        pass
    
    @abstractmethod
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate if symbols are supported by this data source.
        
        Args:
            symbols: List of symbols to validate
            
        Returns:
            Dictionary mapping symbols to validation status
        """
        pass
    
    def get_collector_info(self) -> Dict[str, Any]:
        """
        Get information about this collector.
        
        Returns:
            Dictionary with collector metadata
        """
        return {
            "name": self.name,
            "source": self.source_name,
            "supported_data_types": self.supported_data_types,
            "requires_api_key": self.requires_api_key,
            "authenticated": self._authenticated,
            "config": {
                "timeout": self.config.timeout,
                "max_retries": self.config.max_retries,
                "rate_limit_enabled": self.config.rate_limit_enabled,
                "cache_enabled": self.config.cache_enabled
            }
        }
    
    def __str__(self) -> str:
        """String representation of the collector."""
        return f"{self.name}(source={self.source_name}, authenticated={self._authenticated})"
    
    def __repr__(self) -> str:
        """Detailed representation of the collector."""
        return (f"{self.name}(source={self.source_name}, "
                f"data_types={self.supported_data_types}, "
                f"authenticated={self._authenticated})")