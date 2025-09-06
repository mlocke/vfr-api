"""
Financial Data Collectors Module

This module provides a comprehensive suite of financial data collectors
for aggregating data from various public APIs and government sources.

All collectors implement a standardized interface with built-in:
- Rate limiting and API quota management
- Data validation and quality checks
- Error handling and retry mechanisms
- Caching for performance optimization
- Comprehensive logging and monitoring
"""

__version__ = "1.0.0"
__author__ = "Financial Analysis Platform"

from .base.collector_interface import DataCollectorInterface
from .base.rate_limiter import RateLimiter
from .base.data_validator import DataValidator
from .base.error_handler import ErrorHandler

__all__ = [
    "DataCollectorInterface",
    "RateLimiter", 
    "DataValidator",
    "ErrorHandler"
]