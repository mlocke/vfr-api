"""
Rate limiting utilities for financial data collectors.

This module provides rate limiting functionality to ensure compliance with
API quotas and prevent throttling or blocking by data providers.
"""

import time
import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable, Any
from collections import defaultdict, deque
import threading
import logging

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    requests_per_second: Optional[float] = None
    requests_per_minute: Optional[int] = None
    requests_per_hour: Optional[int] = None
    requests_per_day: Optional[int] = None
    burst_limit: Optional[int] = None
    cooldown_period: float = 1.0
    
    def __post_init__(self):
        """Validate configuration."""
        limits = [
            self.requests_per_second,
            self.requests_per_minute, 
            self.requests_per_hour,
            self.requests_per_day
        ]
        if not any(limits):
            raise ValueError("At least one rate limit must be specified")


class RateLimiter:
    """
    Thread-safe rate limiter supporting multiple time windows.
    
    Features:
    - Multiple time windows (second, minute, hour, day)
    - Burst handling
    - Exponential backoff on limit exceeded
    - Thread-safe operations
    - Detailed logging and monitoring
    """
    
    def __init__(self, config: RateLimitConfig, name: str = "default"):
        """
        Initialize rate limiter.
        
        Args:
            config: Rate limiting configuration
            name: Name for logging and identification
        """
        self.config = config
        self.name = name
        
        # Request tracking with thread safety
        self._lock = threading.RLock()
        self._request_times: Dict[str, deque] = defaultdict(lambda: deque())
        
        # Time windows in seconds
        self._windows = {}
        if config.requests_per_second:
            self._windows["second"] = (1.0, config.requests_per_second)
        if config.requests_per_minute:
            self._windows["minute"] = (60.0, config.requests_per_minute)
        if config.requests_per_hour:
            self._windows["hour"] = (3600.0, config.requests_per_hour)
        if config.requests_per_day:
            self._windows["day"] = (86400.0, config.requests_per_day)
        
        # Burst handling
        self._burst_count = 0
        self._last_burst_reset = time.time()
        
        logger.info(f"Rate limiter '{name}' initialized with windows: {list(self._windows.keys())}")
    
    def can_proceed(self, endpoint: str = "default") -> tuple[bool, Optional[float]]:
        """
        Check if a request can proceed without violating rate limits.
        
        Args:
            endpoint: Specific endpoint identifier for separate limiting
            
        Returns:
            Tuple of (can_proceed, wait_time_seconds)
        """
        with self._lock:
            now = time.time()
            wait_time = 0.0
            
            # Clean old requests and check limits
            for window_name, (window_seconds, limit) in self._windows.items():
                requests = self._request_times[f"{endpoint}_{window_name}"]
                
                # Remove requests outside window
                cutoff = now - window_seconds
                while requests and requests[0] <= cutoff:
                    requests.popleft()
                
                # Check if we're at limit
                if len(requests) >= limit:
                    # Calculate wait time until oldest request expires
                    oldest_request = requests[0]
                    window_wait = (oldest_request + window_seconds) - now
                    wait_time = max(wait_time, window_wait)
            
            # Check burst limit
            if self.config.burst_limit:
                if now - self._last_burst_reset > 60:  # Reset burst every minute
                    self._burst_count = 0
                    self._last_burst_reset = now
                
                if self._burst_count >= self.config.burst_limit:
                    burst_wait = self.config.cooldown_period
                    wait_time = max(wait_time, burst_wait)
            
            can_proceed = wait_time <= 0
            return can_proceed, wait_time if wait_time > 0 else None
    
    def acquire(self, endpoint: str = "default", timeout: Optional[float] = None) -> bool:
        """
        Acquire permission to make a request, blocking if necessary.
        
        Args:
            endpoint: Specific endpoint identifier
            timeout: Maximum time to wait in seconds
            
        Returns:
            True if permission acquired, False if timeout exceeded
        """
        start_time = time.time()
        
        while True:
            can_proceed, wait_time = self.can_proceed(endpoint)
            
            if can_proceed:
                with self._lock:
                    now = time.time()
                    
                    # Record request in all windows
                    for window_name in self._windows.keys():
                        self._request_times[f"{endpoint}_{window_name}"].append(now)
                    
                    # Update burst count
                    if self.config.burst_limit:
                        self._burst_count += 1
                    
                    logger.debug(f"Rate limiter '{self.name}' acquired for endpoint '{endpoint}'")
                    return True
            
            if timeout and (time.time() - start_time) >= timeout:
                logger.warning(f"Rate limiter '{self.name}' timeout for endpoint '{endpoint}'")
                return False
            
            if wait_time:
                sleep_time = min(wait_time, 1.0)  # Don't sleep more than 1 second at a time
                logger.debug(f"Rate limiter '{self.name}' waiting {sleep_time:.2f}s for endpoint '{endpoint}'")
                time.sleep(sleep_time)
            else:
                time.sleep(0.1)  # Small delay to prevent busy waiting
    
    async def acquire_async(self, endpoint: str = "default", timeout: Optional[float] = None) -> bool:
        """
        Async version of acquire method.
        
        Args:
            endpoint: Specific endpoint identifier
            timeout: Maximum time to wait in seconds
            
        Returns:
            True if permission acquired, False if timeout exceeded
        """
        start_time = time.time()
        
        while True:
            can_proceed, wait_time = self.can_proceed(endpoint)
            
            if can_proceed:
                with self._lock:
                    now = time.time()
                    
                    # Record request in all windows
                    for window_name in self._windows.keys():
                        self._request_times[f"{endpoint}_{window_name}"].append(now)
                    
                    # Update burst count
                    if self.config.burst_limit:
                        self._burst_count += 1
                    
                    logger.debug(f"Rate limiter '{self.name}' acquired async for endpoint '{endpoint}'")
                    return True
            
            if timeout and (time.time() - start_time) >= timeout:
                logger.warning(f"Rate limiter '{self.name}' async timeout for endpoint '{endpoint}'")
                return False
            
            if wait_time:
                sleep_time = min(wait_time, 1.0)
                await asyncio.sleep(sleep_time)
            else:
                await asyncio.sleep(0.1)
    
    def get_status(self, endpoint: str = "default") -> Dict[str, Any]:
        """
        Get current rate limiting status.
        
        Args:
            endpoint: Specific endpoint identifier
            
        Returns:
            Dictionary with rate limiting status
        """
        with self._lock:
            now = time.time()
            status = {
                "endpoint": endpoint,
                "limiter_name": self.name,
                "can_proceed": False,
                "wait_time": None,
                "windows": {},
                "burst_count": self._burst_count if self.config.burst_limit else None,
                "burst_limit": self.config.burst_limit
            }
            
            can_proceed, wait_time = self.can_proceed(endpoint)
            status["can_proceed"] = can_proceed
            status["wait_time"] = wait_time
            
            # Status for each window
            for window_name, (window_seconds, limit) in self._windows.items():
                requests = self._request_times[f"{endpoint}_{window_name}"]
                cutoff = now - window_seconds
                
                # Count current requests in window
                current_requests = sum(1 for req_time in requests if req_time > cutoff)
                
                status["windows"][window_name] = {
                    "limit": limit,
                    "current": current_requests,
                    "remaining": max(0, limit - current_requests),
                    "reset_in": window_seconds - (now - (requests[-1] if requests else now))
                }
            
            return status
    
    def reset(self, endpoint: Optional[str] = None):
        """
        Reset rate limiter state.
        
        Args:
            endpoint: Specific endpoint to reset, or None for all endpoints
        """
        with self._lock:
            if endpoint:
                # Reset specific endpoint
                for window_name in self._windows.keys():
                    key = f"{endpoint}_{window_name}"
                    if key in self._request_times:
                        self._request_times[key].clear()
            else:
                # Reset all endpoints
                self._request_times.clear()
            
            # Reset burst counter
            self._burst_count = 0
            self._last_burst_reset = time.time()
            
            logger.info(f"Rate limiter '{self.name}' reset for endpoint '{endpoint or 'all'}'")


def rate_limited(limiter: RateLimiter, endpoint: str = "default", timeout: Optional[float] = None):
    """
    Decorator for rate limiting function calls.
    
    Args:
        limiter: RateLimiter instance
        endpoint: Endpoint identifier
        timeout: Maximum wait time
    
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            if limiter.acquire(endpoint, timeout):
                return func(*args, **kwargs)
            else:
                raise TimeoutError(f"Rate limiter timeout for endpoint '{endpoint}'")
        
        async def async_wrapper(*args, **kwargs):
            if await limiter.acquire_async(endpoint, timeout):
                return await func(*args, **kwargs)
            else:
                raise TimeoutError(f"Rate limiter timeout for endpoint '{endpoint}'")
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return wrapper
    
    return decorator