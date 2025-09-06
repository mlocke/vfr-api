"""
Error handling utilities for financial data collectors.

This module provides comprehensive error handling, retry logic, and
circuit breaker patterns for robust data collection operations.
"""

import time
import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable, Any, Type, Union
from enum import Enum
import logging
import traceback
from functools import wraps
import json

logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    """Error severity levels."""
    LOW = "low"           # Non-critical, operation can continue
    MEDIUM = "medium"     # Important, may affect data quality
    HIGH = "high"         # Critical, operation should be retried
    CRITICAL = "critical" # Fatal, operation must be aborted


class ErrorCategory(Enum):
    """Categories of errors that can occur."""
    NETWORK = "network"           # Network connectivity issues
    API_LIMIT = "api_limit"       # Rate limiting or quota exceeded
    AUTH = "authentication"       # Authentication or authorization
    DATA = "data"                # Data format or validation issues
    CONFIG = "configuration"      # Configuration or setup problems
    SYSTEM = "system"            # System resource issues
    UNKNOWN = "unknown"          # Unclassified errors


@dataclass
class ErrorDetails:
    """Detailed information about an error."""
    category: ErrorCategory
    severity: ErrorSeverity
    message: str
    timestamp: datetime
    exception_type: Optional[str] = None
    traceback_info: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    retry_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/storage."""
        return {
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
            "exception_type": self.exception_type,
            "context": self.context,
            "retry_count": self.retry_count
        }


class CollectorError(Exception):
    """Base exception for data collector errors."""
    
    def __init__(self, message: str, details: Optional[ErrorDetails] = None):
        super().__init__(message)
        self.details = details or ErrorDetails(
            category=ErrorCategory.UNKNOWN,
            severity=ErrorSeverity.MEDIUM,
            message=message,
            timestamp=datetime.now()
        )


class NetworkError(CollectorError):
    """Network-related errors."""
    
    def __init__(self, message: str, status_code: Optional[int] = None):
        details = ErrorDetails(
            category=ErrorCategory.NETWORK,
            severity=ErrorSeverity.HIGH,
            message=message,
            timestamp=datetime.now(),
            context={"status_code": status_code} if status_code else None
        )
        super().__init__(message, details)


class APILimitError(CollectorError):
    """API rate limiting or quota errors."""
    
    def __init__(self, message: str, reset_time: Optional[datetime] = None):
        details = ErrorDetails(
            category=ErrorCategory.API_LIMIT,
            severity=ErrorSeverity.HIGH,
            message=message,
            timestamp=datetime.now(),
            context={"reset_time": reset_time.isoformat() if reset_time else None}
        )
        super().__init__(message, details)


class AuthenticationError(CollectorError):
    """Authentication or authorization errors."""
    
    def __init__(self, message: str):
        details = ErrorDetails(
            category=ErrorCategory.AUTH,
            severity=ErrorSeverity.CRITICAL,
            message=message,
            timestamp=datetime.now()
        )
        super().__init__(message, details)


class DataValidationError(CollectorError):
    """Data validation or format errors."""
    
    def __init__(self, message: str, validation_details: Optional[Dict] = None):
        details = ErrorDetails(
            category=ErrorCategory.DATA,
            severity=ErrorSeverity.MEDIUM,
            message=message,
            timestamp=datetime.now(),
            context=validation_details
        )
        super().__init__(message, details)


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    initial_delay: float = 1.0
    max_delay: float = 60.0
    backoff_factor: float = 2.0
    jitter: bool = True
    retry_on: tuple = (NetworkError, APILimitError)
    
    def get_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt."""
        delay = min(self.initial_delay * (self.backoff_factor ** attempt), self.max_delay)
        
        if self.jitter:
            import random
            delay *= (0.5 + random.random() * 0.5)  # Add 0-50% jitter
        
        return delay


@dataclass 
class CircuitBreakerConfig:
    """Configuration for circuit breaker pattern."""
    failure_threshold: int = 5
    timeout: float = 60.0
    expected_exception: Type[Exception] = CollectorError


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"       # Normal operation
    OPEN = "open"          # Failing, calls blocked
    HALF_OPEN = "half_open" # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker implementation for preventing cascading failures.
    
    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Service failing, requests blocked immediately  
    - HALF_OPEN: Testing recovery, limited requests allowed
    """
    
    def __init__(self, config: CircuitBreakerConfig, name: str = "default"):
        self.config = config
        self.name = name
        
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.next_attempt_time: Optional[datetime] = None
        
        logger.info(f"Circuit breaker '{name}' initialized")
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
                logger.info(f"Circuit breaker '{self.name}' entering HALF_OPEN state")
            else:
                raise CollectorError(f"Circuit breaker '{self.name}' is OPEN")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
            
        except self.config.expected_exception as e:
            self._on_failure()
            raise e
    
    async def call_async(self, func: Callable, *args, **kwargs) -> Any:
        """Async version of call method."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
                logger.info(f"Circuit breaker '{self.name}' entering HALF_OPEN state")
            else:
                raise CollectorError(f"Circuit breaker '{self.name}' is OPEN")
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
            
        except self.config.expected_exception as e:
            self._on_failure()
            raise e
    
    def _should_attempt_reset(self) -> bool:
        """Check if circuit breaker should attempt reset."""
        return (self.next_attempt_time is None or 
                datetime.now() >= self.next_attempt_time)
    
    def _on_success(self) -> None:
        """Handle successful operation."""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.CLOSED
            logger.info(f"Circuit breaker '{self.name}' reset to CLOSED state")
        
        self.failure_count = 0
        self.last_failure_time = None
        self.next_attempt_time = None
    
    def _on_failure(self) -> None:
        """Handle failed operation."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if (self.state == CircuitBreakerState.CLOSED and 
            self.failure_count >= self.config.failure_threshold):
            self.state = CircuitBreakerState.OPEN
            self.next_attempt_time = datetime.now() + timedelta(seconds=self.config.timeout)
            logger.warning(f"Circuit breaker '{self.name}' opened due to {self.failure_count} failures")
        
        elif self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.OPEN
            self.next_attempt_time = datetime.now() + timedelta(seconds=self.config.timeout)
            logger.warning(f"Circuit breaker '{self.name}' reopened")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current circuit breaker status."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "last_failure_time": self.last_failure_time.isoformat() if self.last_failure_time else None,
            "next_attempt_time": self.next_attempt_time.isoformat() if self.next_attempt_time else None
        }


class ErrorHandler:
    """
    Comprehensive error handler for data collectors.
    
    Features:
    - Automatic retry with exponential backoff
    - Circuit breaker pattern
    - Error classification and logging
    - Performance metrics
    - Custom error recovery strategies
    """
    
    def __init__(self, 
                 retry_config: Optional[RetryConfig] = None,
                 circuit_breaker_config: Optional[CircuitBreakerConfig] = None,
                 name: str = "default"):
        """
        Initialize error handler.
        
        Args:
            retry_config: Retry behavior configuration
            circuit_breaker_config: Circuit breaker configuration  
            name: Handler name for logging
        """
        self.name = name
        self.retry_config = retry_config or RetryConfig()
        self.circuit_breaker = (CircuitBreaker(circuit_breaker_config, name) 
                               if circuit_breaker_config else None)
        
        # Error tracking
        self.error_history: List[ErrorDetails] = []
        self.error_counts: Dict[str, int] = {}
        
        logger.info(f"Error handler '{name}' initialized")
    
    def handle_with_retry(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with retry logic and error handling.
        
        Args:
            func: Function to execute
            *args, **kwargs: Function arguments
            
        Returns:
            Function result
            
        Raises:
            CollectorError: If all retry attempts fail
        """
        last_exception = None
        
        for attempt in range(self.retry_config.max_attempts):
            try:
                # Use circuit breaker if configured
                if self.circuit_breaker:
                    return self.circuit_breaker.call(func, *args, **kwargs)
                else:
                    return func(*args, **kwargs)
                    
            except Exception as e:
                last_exception = e
                error_details = self._classify_error(e)
                error_details.retry_count = attempt + 1
                
                # Log error
                self._log_error(error_details)
                
                # Check if we should retry
                if not self._should_retry(e, attempt):
                    break
                
                # Wait before retry
                if attempt < self.retry_config.max_attempts - 1:
                    delay = self.retry_config.get_delay(attempt)
                    logger.info(f"Retrying in {delay:.2f}s (attempt {attempt + 1}/{self.retry_config.max_attempts})")
                    time.sleep(delay)
        
        # All retries exhausted
        if isinstance(last_exception, CollectorError):
            raise last_exception
        else:
            error_details = self._classify_error(last_exception)
            raise CollectorError(f"Operation failed after {self.retry_config.max_attempts} attempts", error_details)
    
    async def handle_with_retry_async(self, func: Callable, *args, **kwargs) -> Any:
        """Async version of handle_with_retry."""
        last_exception = None
        
        for attempt in range(self.retry_config.max_attempts):
            try:
                # Use circuit breaker if configured
                if self.circuit_breaker:
                    return await self.circuit_breaker.call_async(func, *args, **kwargs)
                else:
                    return await func(*args, **kwargs)
                    
            except Exception as e:
                last_exception = e
                error_details = self._classify_error(e)
                error_details.retry_count = attempt + 1
                
                # Log error
                self._log_error(error_details)
                
                # Check if we should retry
                if not self._should_retry(e, attempt):
                    break
                
                # Wait before retry
                if attempt < self.retry_config.max_attempts - 1:
                    delay = self.retry_config.get_delay(attempt)
                    logger.info(f"Retrying in {delay:.2f}s (attempt {attempt + 1}/{self.retry_config.max_attempts})")
                    await asyncio.sleep(delay)
        
        # All retries exhausted
        if isinstance(last_exception, CollectorError):
            raise last_exception
        else:
            error_details = self._classify_error(last_exception)
            raise CollectorError(f"Operation failed after {self.retry_config.max_attempts} attempts", error_details)
    
    def _should_retry(self, exception: Exception, attempt: int) -> bool:
        """Determine if operation should be retried."""
        if attempt >= self.retry_config.max_attempts - 1:
            return False
        
        # Check if exception type is retryable
        return isinstance(exception, self.retry_config.retry_on)
    
    def _classify_error(self, exception: Exception) -> ErrorDetails:
        """Classify and create detailed error information."""
        if isinstance(exception, CollectorError):
            return exception.details
        
        # Classify based on exception type and message
        category = ErrorCategory.UNKNOWN
        severity = ErrorSeverity.MEDIUM
        
        exception_type = type(exception).__name__
        message = str(exception)
        
        # Network errors
        if any(term in exception_type.lower() for term in ['connection', 'timeout', 'network', 'http']):
            category = ErrorCategory.NETWORK
            severity = ErrorSeverity.HIGH
        
        # Authentication errors  
        elif any(term in message.lower() for term in ['auth', 'token', 'credential', 'permission']):
            category = ErrorCategory.AUTH
            severity = ErrorSeverity.CRITICAL
        
        # Rate limiting
        elif any(term in message.lower() for term in ['rate', 'limit', 'quota', 'throttle']):
            category = ErrorCategory.API_LIMIT
            severity = ErrorSeverity.HIGH
        
        # Data issues
        elif any(term in exception_type.lower() for term in ['parse', 'json', 'value', 'type']):
            category = ErrorCategory.DATA
            severity = ErrorSeverity.MEDIUM
        
        return ErrorDetails(
            category=category,
            severity=severity, 
            message=message,
            timestamp=datetime.now(),
            exception_type=exception_type,
            traceback_info=traceback.format_exc(),
            context={"args": str(exception.args)}
        )
    
    def _log_error(self, error_details: ErrorDetails) -> None:
        """Log error with appropriate level."""
        # Track error counts
        key = f"{error_details.category.value}_{error_details.exception_type}"
        self.error_counts[key] = self.error_counts.get(key, 0) + 1
        
        # Add to history (keep last 100)
        self.error_history.append(error_details)
        if len(self.error_history) > 100:
            self.error_history.pop(0)
        
        # Log with appropriate level
        log_data = error_details.to_dict()
        
        if error_details.severity == ErrorSeverity.CRITICAL:
            logger.critical(f"Critical error in {self.name}: {error_details.message}", extra=log_data)
        elif error_details.severity == ErrorSeverity.HIGH:
            logger.error(f"High severity error in {self.name}: {error_details.message}", extra=log_data)
        elif error_details.severity == ErrorSeverity.MEDIUM:
            logger.warning(f"Medium severity error in {self.name}: {error_details.message}", extra=log_data)
        else:
            logger.info(f"Low severity error in {self.name}: {error_details.message}", extra=log_data)
    
    def get_error_stats(self) -> Dict[str, Any]:
        """Get error statistics."""
        return {
            "handler_name": self.name,
            "total_errors": len(self.error_history),
            "error_counts_by_type": dict(self.error_counts),
            "recent_errors": [e.to_dict() for e in self.error_history[-10:]],
            "circuit_breaker_status": self.circuit_breaker.get_status() if self.circuit_breaker else None
        }


def with_error_handling(func: Callable) -> Callable:
    """Simple decorator for basic error handling without retry logic."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            # Re-raise the exception but ensure it's logged
            logger.error(f"Error in {func.__name__}: {e}")
            raise
    return wrapper


def with_retry_handling(error_handler: ErrorHandler):
    """Decorator for adding error handling with retry logic."""
    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                return await error_handler.handle_with_retry_async(func, *args, **kwargs)
            return async_wrapper
        else:
            @wraps(func)
            def wrapper(*args, **kwargs):
                return error_handler.handle_with_retry(func, *args, **kwargs)
            return wrapper
    return decorator