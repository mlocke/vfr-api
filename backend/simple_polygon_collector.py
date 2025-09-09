#!/usr/bin/env python3
"""
Simple Polygon.io MCP Collector - Week 1 Implementation

A simplified version for testing and validation during Week 1.
This version focuses on core functionality and API connectivity.
"""

import requests
import os
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Any, Optional

# Import centralized configuration
try:
    from backend.config.env_loader import Config
except ImportError:
    # Fallback for testing
    class Config:
        @classmethod
        def get_api_key(cls, service):
            return os.getenv(f'{service.upper()}_API_KEY')

logger = logging.getLogger(__name__)


class PolygonTier(Enum):
    FREE = "free"
    STARTER = "starter" 
    DEVELOPER = "developer"
    ADVANCED = "advanced"


class SimplePolygonCollector:
    """
    Simple Polygon.io collector for Week 1 testing.
    Uses direct API calls with rate limiting support.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the collector with API key"""
        self.api_key = api_key or Config.get_api_key('polygon')
        if not self.api_key:
            raise ValueError("API key required. Set POLYGON_API_KEY or provide api_key parameter.")
        
        self.base_url = "https://api.polygon.io"
        self.session = requests.Session()
        self.tier = self._detect_tier()
        self.calls_made = []
        
        # Rate limits by tier (calls per minute)
        self.rate_limits = {
            PolygonTier.FREE: 5,
            PolygonTier.STARTER: float('inf'),
            PolygonTier.DEVELOPER: float('inf'), 
            PolygonTier.ADVANCED: float('inf')
        }
        
        print(f"✅ Polygon collector initialized with {self.tier.value} tier")
    
    def _detect_tier(self) -> PolygonTier:
        """Detect subscription tier by testing API"""
        try:
            response = self.session.get(
                f"{self.base_url}/v3/reference/tickers",
                params={'apikey': self.api_key, 'limit': 1},
                timeout=10
            )
            
            if response.status_code == 200:
                # For now, assume free tier
                # Real implementation would check response headers or test premium endpoints
                return PolygonTier.FREE
            else:
                print(f"⚠️ API validation warning: {response.status_code}")
                return PolygonTier.FREE
        except Exception as e:
            print(f"⚠️ Tier detection failed: {e}")
            return PolygonTier.FREE
    
    def _can_make_call(self) -> bool:
        """Check if we can make an API call within rate limits"""
        now = datetime.now()
        minute_ago = now - timedelta(minutes=1)
        
        # Clean old calls
        self.calls_made = [call_time for call_time in self.calls_made if call_time > minute_ago]
        
        limit = self.rate_limits[self.tier]
        return len(self.calls_made) < limit
    
    def _record_call(self):
        """Record that we made an API call"""
        self.calls_made.append(datetime.now())
    
    def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make an API request with rate limiting"""
        if not self._can_make_call():
            return {"error": "Rate limit exceeded", "tier": self.tier.value, "limit": self.rate_limits[self.tier]}
        
        # Add API key to params
        params['apikey'] = self.api_key
        
        try:
            response = self.session.get(f"{self.base_url}{endpoint}", params=params, timeout=30)
            self._record_call()
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "error": f"HTTP {response.status_code}",
                    "message": response.text[:200]
                }
        except requests.RequestException as e:
            return {"error": f"Request failed: {e}"}
    
    def get_market_status(self) -> Dict[str, Any]:
        """Get current market status"""
        return self._make_request("/v1/marketstatus/now", {})
    
    def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        """Get latest stock data for symbol"""
        return self._make_request(f"/v2/aggs/ticker/{symbol}/prev", {})
    
    def get_stock_details(self, symbol: str) -> Dict[str, Any]:
        """Get company details for symbol"""
        return self._make_request(f"/v3/reference/tickers/{symbol}", {})
    
    def get_stock_news(self, symbol: str, limit: int = 5) -> Dict[str, Any]:
        """Get recent news for symbol"""
        return self._make_request(f"/v2/reference/news", {
            'ticker': symbol,
            'limit': limit
        })
    
    def get_rate_limit_status(self) -> Dict[str, Any]:
        """Get current rate limiting status"""
        now = datetime.now()
        minute_ago = now - timedelta(minutes=1)
        
        # Clean old calls  
        recent_calls = [call_time for call_time in self.calls_made if call_time > minute_ago]
        
        return {
            'tier': self.tier.value,
            'limit': self.rate_limits[self.tier],
            'calls_in_last_minute': len(recent_calls),
            'can_make_call': self._can_make_call(),
            'total_calls_made': len(self.calls_made)
        }