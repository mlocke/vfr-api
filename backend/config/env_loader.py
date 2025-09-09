"""
Centralized Environment Configuration Loader
===========================================

This module provides a single point of configuration for all API keys and environment
variables used throughout the Stock Picker Platform. It ensures consistent loading
of environment variables and provides validation for required keys.

Usage:
    from backend.config.env_loader import Config
    
    # Access API keys
    polygon_key = Config.POLYGON_API_KEY
    fred_key = Config.FRED_API_KEY
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)

class ConfigurationError(Exception):
    """Raised when required configuration is missing or invalid"""
    pass

def find_and_load_dotenv():
    """Find and load .env file from project root"""
    # Start from current file location and walk up to find .env
    current_dir = Path(__file__).parent
    for parent in [current_dir] + list(current_dir.parents):
        env_file = parent / '.env'
        if env_file.exists():
            load_dotenv(env_file)
            logger.info(f"Loaded environment variables from: {env_file}")
            return str(env_file)
    
    # Fallback: try loading from current working directory
    load_dotenv()
    logger.warning("No .env file found in parent directories, using system environment")
    return None

# Load environment variables once when module is imported
env_file_path = find_and_load_dotenv()

class Config:
    """
    Centralized configuration class for all environment variables
    """
    
    # Database Configuration
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:dev_password_123@localhost:5432/stock_picker')
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
    INFLUXDB_URL = os.getenv('INFLUXDB_URL', 'http://localhost:8086')
    INFLUXDB_TOKEN = os.getenv('INFLUXDB_TOKEN')
    INFLUXDB_ORG = os.getenv('INFLUXDB_ORG', 'stock_picker_org')
    INFLUXDB_BUCKET = os.getenv('INFLUXDB_BUCKET', 'stock_data')
    
    # Financial Data API Keys
    ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')
    POLYGON_API_KEY = os.getenv('POLYGON_API_KEY')
    IEX_CLOUD_API_KEY = os.getenv('IEX_CLOUD_API_KEY')
    
    # Government Data API Keys
    FRED_API_KEY = os.getenv('FRED_API_KEY')
    BLS_API_KEY = os.getenv('BLS_API_KEY')
    DATA_GOV_API_KEY = os.getenv('DATA_GOV_API_KEY')
    
    # News and Intelligence API Keys
    NEWS_API_KEY = os.getenv('NEWS_API_KEY')
    DAPPIER_API_KEY = os.getenv('DAPPIER_API_KEY')
    
    # SEC EDGAR Configuration
    SEC_EDGAR_USER_AGENT = os.getenv('SEC_EDGAR_USER_AGENT', 'Stock-Picker Financial Analysis Platform (contact@stockpicker.com)')
    
    # Application Configuration
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    SECRET_KEY = os.getenv('SECRET_KEY')
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
    
    # API Rate Limits and Timeouts
    MAX_REQUESTS_PER_MINUTE = int(os.getenv('MAX_REQUESTS_PER_MINUTE', '60'))
    REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', '30'))
    
    # Python Path Configuration
    PYTHONPATH = os.getenv('PYTHONPATH', '.')
    
    @classmethod
    def validate_required_keys(cls, required_keys=None):
        """
        Validate that required configuration keys are present
        
        Args:
            required_keys (list): List of required configuration keys
                                If None, validates commonly required keys
        
        Raises:
            ConfigurationError: If required keys are missing
        """
        if required_keys is None:
            # Default required keys for basic operation
            required_keys = ['SECRET_KEY']
        
        missing_keys = []
        for key in required_keys:
            value = getattr(cls, key, None)
            if not value or value.startswith('your_') or value == 'demo':
                missing_keys.append(key)
        
        if missing_keys:
            raise ConfigurationError(
                f"Missing or invalid configuration keys: {missing_keys}. "
                f"Please check your .env file and ensure these keys are properly set."
            )
    
    @classmethod
    def get_api_key(cls, service_name):
        """
        Get API key for a specific service with validation
        
        Args:
            service_name (str): Name of the service (e.g., 'polygon', 'fred', 'alpha_vantage')
            
        Returns:
            str: API key for the service
            
        Raises:
            ConfigurationError: If API key is not configured
        """
        key_mapping = {
            'polygon': cls.POLYGON_API_KEY,
            'alpha_vantage': cls.ALPHA_VANTAGE_API_KEY,
            'fred': cls.FRED_API_KEY,
            'bls': cls.BLS_API_KEY,
            'iex_cloud': cls.IEX_CLOUD_API_KEY,
            'news_api': cls.NEWS_API_KEY,
            'data_gov': cls.DATA_GOV_API_KEY,
            'dappier': cls.DAPPIER_API_KEY
        }
        
        api_key = key_mapping.get(service_name.lower())
        
        if not api_key or api_key.startswith('your_') or api_key == 'demo':
            logger.warning(f"API key for {service_name} not configured or using placeholder value")
            return None
        
        return api_key
    
    @classmethod
    def is_production(cls):
        """Check if running in production environment"""
        return cls.ENVIRONMENT.lower() == 'production'
    
    @classmethod
    def is_development(cls):
        """Check if running in development environment"""
        return cls.ENVIRONMENT.lower() == 'development'
    
    @classmethod
    def get_config_summary(cls):
        """Get a summary of current configuration (without sensitive data)"""
        summary = {
            'environment': cls.ENVIRONMENT,
            'debug': cls.DEBUG,
            'log_level': cls.LOG_LEVEL,
            'database_configured': bool(cls.DATABASE_URL and not cls.DATABASE_URL.startswith('postgresql://postgres:dev')),
            'redis_configured': bool(cls.REDIS_URL),
            'api_keys_configured': {
                'polygon': bool(cls.get_api_key('polygon')),
                'alpha_vantage': bool(cls.get_api_key('alpha_vantage')),
                'fred': bool(cls.get_api_key('fred')),
                'bls': bool(cls.get_api_key('bls')),
                'news_api': bool(cls.get_api_key('news_api')),
                'data_gov': bool(cls.get_api_key('data_gov')),
                'dappier': bool(cls.get_api_key('dappier'))
            }
        }
        return summary

# Log configuration status on import
if logger.isEnabledFor(logging.INFO):
    summary = Config.get_config_summary()
    configured_apis = [k for k, v in summary['api_keys_configured'].items() if v]
    logger.info(f"Configuration loaded. Environment: {summary['environment']}, "
               f"Configured APIs: {configured_apis}")