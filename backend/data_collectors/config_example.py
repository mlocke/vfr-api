"""
Configuration Examples for Financial Data Collectors

This file provides configuration examples for all data collectors,
including required API keys and optimal settings for different use cases.
"""

import os
from datetime import date, timedelta
from .base import CollectorConfig, DateRange, DataFrequency

# Import centralized configuration
try:
    from ..config.env_loader import Config
except ImportError:
    # Fallback for testing
    class Config:
        @classmethod
        def get_api_key(cls, service):
            return os.getenv(f'{service.upper()}_API_KEY')

# Environment variables for API keys
# Copy these to your .env file with actual values

EXAMPLE_ENV_VARS = """
# Government APIs (some free, some require registration)
FRED_API_KEY=your_fred_api_key_here

# Market Data APIs (require paid subscriptions)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
IEX_CLOUD_API_KEY=your_iex_cloud_key_here
POLYGON_API_KEY=your_polygon_key_here
NEWS_API_KEY=your_news_api_key_here
QUANDL_API_KEY=your_quandl_key_here

# Social/Alternative Data APIs
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
"""

# Configuration examples for different collector types

# Government Collectors (Free/Low-cost)
GOVERNMENT_CONFIGS = {
    "sec_edgar": CollectorConfig(
        # No API key required
        api_key=None,
        base_url="https://data.sec.gov/",
        timeout=30,
        max_retries=3,
        requests_per_minute=600,  # 10 per second limit
        cache_enabled=True,
        cache_ttl=3600,  # 1 hour cache for SEC data
        validate_data=True
    ),
    
    "fred": CollectorConfig(
        api_key=Config.get_api_key("fred"),  # Free API key required
        base_url="https://api.stlouisfed.org/fred/",
        timeout=30,
        max_retries=3,
        requests_per_minute=120,  # Conservative rate
        cache_enabled=True,
        cache_ttl=1800,  # 30 minute cache
        validate_data=True
    ),
    
    "treasury_direct": CollectorConfig(
        # No API key required
        api_key=None,
        base_url="https://api.fiscaldata.treasury.gov/services/api/fiscal_service/",
        timeout=30,
        max_retries=3,
        requests_per_minute=60,  # Conservative rate
        cache_enabled=True,
        cache_ttl=3600,  # 1 hour cache
        validate_data=True
    )
}

# Market Data Collectors (Paid services)
MARKET_DATA_CONFIGS = {
    "alpha_vantage": CollectorConfig(
        api_key=Config.get_api_key("alpha_vantage"),
        base_url="https://www.alphavantage.co/query",
        timeout=30,
        max_retries=3,
        requests_per_minute=5,  # 5 calls per minute for free tier
        cache_enabled=True,
        cache_ttl=300,  # 5 minute cache for real-time data
        validate_data=True
    ),
    
    "iex_cloud": CollectorConfig(
        api_key=Config.get_api_key("iex_cloud"),
        base_url="https://cloud.iexapis.com/stable/",
        timeout=30,
        max_retries=3,
        requests_per_minute=100,  # Varies by plan
        cache_enabled=True,
        cache_ttl=60,  # 1 minute cache
        validate_data=True
    ),
    
    "polygon": CollectorConfig(
        api_key=Config.get_api_key("polygon"),
        base_url="https://api.polygon.io/",
        timeout=30,
        max_retries=3,
        requests_per_minute=5,  # Free tier limit
        cache_enabled=True,
        cache_ttl=60,
        validate_data=True
    )
}

# News and Sentiment Collectors
NEWS_CONFIGS = {
    "news_api": CollectorConfig(
        api_key=Config.get_api_key("news_api"),
        base_url="https://newsapi.org/v2/",
        timeout=30,
        max_retries=3,
        requests_per_minute=60,  # 1000 requests per day free
        cache_enabled=True,
        cache_ttl=600,  # 10 minute cache for news
        validate_data=True
    )
}

# Different configuration profiles for different use cases

# Development/Testing Configuration
DEV_CONFIG = CollectorConfig(
    timeout=10,
    max_retries=1,
    requests_per_minute=30,  # Lower rate for development
    cache_enabled=True,
    cache_ttl=600,
    validate_data=True,
    log_level="DEBUG"
)

# Production Configuration
PROD_CONFIG = CollectorConfig(
    timeout=30,
    max_retries=5,
    requests_per_minute=100,
    cache_enabled=True,
    cache_ttl=300,
    validate_data=True,
    log_level="INFO"
)

# High-frequency Trading Configuration
HFT_CONFIG = CollectorConfig(
    timeout=5,
    max_retries=2,
    requests_per_minute=1200,  # High rate for HFT
    cache_enabled=False,  # No cache for real-time data
    validate_data=False,  # Skip validation for speed
    log_level="WARNING"
)

# Batch Processing Configuration
BATCH_CONFIG = CollectorConfig(
    timeout=120,  # Longer timeout for large requests
    max_retries=5,
    requests_per_minute=30,  # Lower rate for batch jobs
    cache_enabled=True,
    cache_ttl=3600,  # Long cache for historical data
    validate_data=True,
    log_level="INFO"
)

# Example date ranges for different use cases
DATE_RANGES = {
    "last_week": DateRange(
        start_date=date.today() - timedelta(days=7),
        end_date=date.today()
    ),
    
    "last_month": DateRange(
        start_date=date.today() - timedelta(days=30),
        end_date=date.today()
    ),
    
    "last_quarter": DateRange(
        start_date=date.today() - timedelta(days=90),
        end_date=date.today()
    ),
    
    "last_year": DateRange(
        start_date=date.today() - timedelta(days=365),
        end_date=date.today()
    ),
    
    "ytd": DateRange(
        start_date=date(date.today().year, 1, 1),
        end_date=date.today()
    ),
    
    "financial_crisis": DateRange(
        start_date=date(2007, 1, 1),
        end_date=date(2009, 12, 31)
    ),
    
    "covid_period": DateRange(
        start_date=date(2020, 1, 1),
        end_date=date(2021, 12, 31)
    )
}

# Popular symbol lists for different markets
SYMBOL_LISTS = {
    "sp500_top10": [
        "AAPL", "MSFT", "AMZN", "GOOGL", "TSLA",
        "GOOG", "NVDA", "BRK.B", "UNH", "JNJ"
    ],
    
    "dow_industrials": [
        "AAPL", "MSFT", "UNH", "GS", "HD",
        "MCD", "AMGN", "CAT", "V", "CRM"
    ],
    
    "tech_giants": [
        "AAPL", "MSFT", "AMZN", "GOOGL", "META",
        "TSLA", "NVDA", "ORCL", "CRM", "ADBE"
    ],
    
    "financial_sector": [
        "JPM", "BAC", "WFC", "GS", "MS",
        "C", "USB", "PNC", "TFC", "COF"
    ],
    
    "fred_economic_indicators": [
        "GDP", "UNRATE", "CPIAUCSL", "FEDFUNDS",
        "DGS10", "DGS3MO", "PAYEMS", "INDPRO"
    ],
    
    "treasury_maturities": [
        "1 Mo", "3 Mo", "6 Mo", "1 Yr", "2 Yr",
        "5 Yr", "10 Yr", "20 Yr", "30 Yr"
    ]
}

def get_config_for_collector(collector_type: str, environment: str = "prod") -> CollectorConfig:
    """
    Get appropriate configuration for a collector type and environment.
    
    Args:
        collector_type: Type of collector (e.g., "sec_edgar", "fred")
        environment: Environment type ("dev", "prod", "hft", "batch")
        
    Returns:
        CollectorConfig instance
    """
    # Base configurations by collector type
    base_configs = {**GOVERNMENT_CONFIGS, **MARKET_DATA_CONFIGS, **NEWS_CONFIGS}
    
    # Environment configurations
    env_configs = {
        "dev": DEV_CONFIG,
        "prod": PROD_CONFIG,
        "hft": HFT_CONFIG,
        "batch": BATCH_CONFIG
    }
    
    # Get base config for collector
    base_config = base_configs.get(collector_type, CollectorConfig())
    
    # Get environment config
    env_config = env_configs.get(environment, PROD_CONFIG)
    
    # Merge configurations (base config takes precedence for API-specific settings)
    merged_config = CollectorConfig(
        api_key=base_config.api_key,
        base_url=base_config.base_url,
        timeout=env_config.timeout,
        max_retries=env_config.max_retries,
        requests_per_minute=min(base_config.requests_per_minute, env_config.requests_per_minute),
        cache_enabled=env_config.cache_enabled,
        cache_ttl=base_config.cache_ttl if base_config.cache_ttl else env_config.cache_ttl,
        validate_data=env_config.validate_data,
        log_level=env_config.log_level
    )
    
    return merged_config