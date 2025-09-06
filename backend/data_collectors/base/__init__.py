"""
Base utilities and interfaces for financial data collectors.
"""

from .collector_interface import (
    DataCollectorInterface, 
    CollectorConfig, 
    DateRange, 
    DataFrequency
)
from .rate_limiter import RateLimiter, RateLimitConfig
from .data_validator import DataValidator, ValidationReport
from .error_handler import (
    ErrorHandler, 
    CollectorError,
    NetworkError,
    AuthenticationError,
    DataValidationError,
    APILimitError,
    with_error_handling,
    with_retry_handling,
    RetryConfig
)

__all__ = [
    "DataCollectorInterface",
    "CollectorConfig",
    "DateRange", 
    "DataFrequency",
    "RateLimiter",
    "RateLimitConfig",
    "DataValidator", 
    "ValidationReport",
    "ErrorHandler",
    "CollectorError",
    "NetworkError",
    "AuthenticationError", 
    "DataValidationError",
    "APILimitError",
    "with_error_handling",
    "with_retry_handling",
    "RetryConfig"
]