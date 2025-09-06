"""
SEC EDGAR Data Collector

Collects data from the U.S. Securities and Exchange Commission's EDGAR database,
which contains public company filings and reports required by federal securities laws.

Data Sources:
- Company Facts API: XBRL structured financial data  
- Filings API: Filing metadata and document access
- Company Tickers: Mapping of CIK to ticker symbols
- Mutual Fund Data: Investment company filings

API Documentation: https://www.sec.gov/edgar/sec-api-documentation
Rate Limits: 10 requests per second per IP (no authentication required)

Key Features:
- Access to all public company filings since 1994
- Structured financial data via XBRL
- Real-time filing notifications
- Historical company information
- Insider trading data (Form 4)
"""

import json
import pandas as pd
import requests
from datetime import datetime, date
from typing import List, Dict, Any, Iterator, Optional, Union
from urllib.parse import urljoin
import time
import re

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


class SECEdgarCollector(DataCollectorInterface):
    """
    SEC EDGAR database collector for public company filings and financial data.
    
    This collector provides access to:
    - Company financial statements and ratios
    - Filing documents (10-K, 10-Q, 8-K, etc.)
    - Insider trading information
    - Mutual fund data
    - Real-time filing notifications
    
    No API key required, but rate limited to 10 requests/second.
    """
    
    BASE_URL = "https://data.sec.gov/"
    COMPANY_FACTS_URL = "api/xbrl/companyfacts/"
    FILINGS_URL = "api/xbrl/frames/"
    TICKERS_URL = "files/company_tickers.json"
    SUBMISSIONS_URL = "api/xbrl/submissions/"
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """
        Initialize SEC EDGAR collector.
        
        Args:
            config: Collector configuration (API key not required)
        """
        # Use default config if none provided
        if config is None:
            config = CollectorConfig(
                requests_per_minute=600,  # 10 per second * 60 = 600 per minute
                timeout=30,
                max_retries=3
            )
        
        super().__init__(config)
        
        # SEC requires User-Agent header
        self.headers = {
            'User-Agent': 'Financial Analysis Platform (contact@financialplatform.com)',
            'Accept': 'application/json',
            'Host': 'data.sec.gov'
        }
        
        # Rate limiter (10 requests per second)
        rate_config = RateLimitConfig(
            requests_per_second=10.0,
            burst_limit=50,
            cooldown_period=1.0
        )
        self.rate_limiter = RateLimiter(rate_config, "sec_edgar")
        
        # Error handler
        retry_config = RetryConfig(
            max_attempts=3,
            initial_delay=1.0,
            backoff_factor=2.0,
            retry_on=(NetworkError,)
        )
        self.error_handler = ErrorHandler(retry_config, name="sec_edgar")
        
        # Cache for ticker mapping
        self._ticker_mapping: Optional[Dict[str, Any]] = None
        self._cik_mapping: Optional[Dict[str, str]] = None
        
        logger.info("SEC EDGAR collector initialized")
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "SEC EDGAR"
    
    @property 
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            "company_facts",      # Financial statements and ratios
            "filings",           # Filing documents and metadata
            "submissions",       # Company submission history
            "insider_trading",   # Form 4 insider trading data
            "mutual_funds",      # Investment company data
            "company_info"       # Basic company information
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """SEC EDGAR API does not require authentication."""
        return False
    
    def authenticate(self) -> bool:
        """
        Test connection to SEC EDGAR API.
        No authentication required, just verify API is accessible.
        """
        try:
            response = self._make_request("files/company_tickers.json")
            self._authenticated = response.status_code == 200
            
            if self._authenticated:
                logger.info("SEC EDGAR API connection verified")
            else:
                logger.error(f"SEC EDGAR API connection failed: {response.status_code}")
            
            return self._authenticated
            
        except Exception as e:
            logger.error(f"SEC EDGAR authentication failed: {e}")
            self._authenticated = False
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to SEC EDGAR API."""
        try:
            start_time = datetime.now()
            response = self._make_request("files/company_tickers.json")
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
        """Make rate-limited request to SEC EDGAR API."""
        # Apply rate limiting
        self.rate_limiter.acquire("sec_edgar_api", timeout=30)
        
        url = urljoin(self.BASE_URL, endpoint)
        
        try:
            response = requests.get(
                url,
                params=params,
                headers=self.headers,
                timeout=self.config.timeout
            )
            
            # Check for rate limiting
            if response.status_code == 429:
                raise NetworkError("SEC EDGAR rate limit exceeded", response.status_code)
            
            # Check for other HTTP errors
            if response.status_code >= 400:
                raise NetworkError(f"SEC EDGAR API error: {response.status_code}", response.status_code)
            
            return response
            
        except requests.RequestException as e:
            raise NetworkError(f"Request to SEC EDGAR failed: {e}")
    
    def get_ticker_mapping(self) -> Dict[str, Any]:
        """
        Get mapping of ticker symbols to CIK numbers.
        
        Returns:
            Dictionary mapping tickers to company information
        """
        if self._ticker_mapping is None:
            logger.info("Fetching SEC ticker mapping...")
            response = self._make_request("files/company_tickers.json")
            self._ticker_mapping = response.json()
            
            # Create reverse mapping (CIK to ticker)
            self._cik_mapping = {}
            for ticker_data in self._ticker_mapping.values():
                cik = str(ticker_data['cik_str']).zfill(10)  # Pad with zeros
                self._cik_mapping[cik] = ticker_data['ticker']
            
            logger.info(f"Loaded {len(self._ticker_mapping)} ticker mappings")
        
        return self._ticker_mapping
    
    def get_cik_from_ticker(self, ticker: str) -> Optional[str]:
        """
        Get CIK number from ticker symbol.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            CIK number as string, or None if not found
        """
        mapping = self.get_ticker_mapping()
        
        for company_data in mapping.values():
            if company_data['ticker'].upper() == ticker.upper():
                return str(company_data['cik_str']).zfill(10)
        
        return None
    
    def collect_batch(
        self, 
        symbols: List[str], 
        date_range: DateRange,
        frequency: DataFrequency = DataFrequency.QUARTERLY,
        data_type: str = "company_facts"
    ) -> pd.DataFrame:
        """
        Collect historical financial data for multiple companies.
        
        Args:
            symbols: List of ticker symbols or CIK numbers
            date_range: Date range for data collection
            frequency: Data frequency (quarterly, annually)
            data_type: Type of data to collect
            
        Returns:
            DataFrame with financial data
        """
        logger.info(f"Collecting {data_type} data for {len(symbols)} symbols")
        
        all_data = []
        
        for symbol in symbols:
            try:
                if data_type == "company_facts":
                    data = self.get_company_facts(symbol)
                    if data:
                        all_data.append(data)
                        
                elif data_type == "filings":
                    data = self.get_company_filings(symbol, date_range)
                    if data:
                        all_data.extend(data)
                        
                elif data_type == "submissions":
                    data = self.get_company_submissions(symbol)
                    if data:
                        all_data.append(data)
                
                # Small delay between companies to be respectful
                time.sleep(0.1)
                
            except Exception as e:
                logger.warning(f"Failed to collect data for {symbol}: {e}")
                continue
        
        if not all_data:
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(all_data)
        
        # Add metadata
        df['collector_source'] = self.source_name
        df['collection_timestamp'] = datetime.now()
        
        logger.info(f"Successfully collected {len(df)} records")
        return df
    
    def collect_realtime(
        self, 
        symbols: List[str],
        data_type: str = "filings"
    ) -> Iterator[Dict[str, Any]]:
        """
        SEC EDGAR doesn't provide real-time data in the traditional sense.
        This method yields recent filings for the specified companies.
        
        Args:
            symbols: List of ticker symbols
            data_type: Type of data to stream
            
        Yields:
            Dictionary with recent filing data
        """
        logger.info(f"Starting real-time monitoring for {len(symbols)} symbols")
        
        for symbol in symbols:
            try:
                cik = self.get_cik_from_ticker(symbol)
                if not cik:
                    logger.warning(f"Could not find CIK for symbol {symbol}")
                    continue
                
                # Get recent submissions
                submissions = self.get_company_submissions(cik)
                if submissions and 'filings' in submissions:
                    recent_filings = submissions['filings']['recent']
                    
                    # Yield each recent filing
                    for i in range(len(recent_filings['accessionNumber'])):
                        filing_data = {
                            'symbol': symbol,
                            'cik': cik,
                            'accession_number': recent_filings['accessionNumber'][i],
                            'form_type': recent_filings['form'][i],
                            'filing_date': recent_filings['filingDate'][i],
                            'report_date': recent_filings['reportDate'][i],
                            'acceptance_datetime': recent_filings['acceptanceDateTime'][i],
                            'timestamp': datetime.now().isoformat()
                        }
                        yield filing_data
                        
            except Exception as e:
                logger.error(f"Error in real-time collection for {symbol}: {e}")
                continue
    
    def get_company_facts(self, symbol_or_cik: str) -> Optional[Dict[str, Any]]:
        """
        Get structured financial data for a company.
        
        Args:
            symbol_or_cik: Ticker symbol or CIK number
            
        Returns:
            Dictionary with company financial facts
        """
        # Convert ticker to CIK if necessary
        if not symbol_or_cik.isdigit():
            cik = self.get_cik_from_ticker(symbol_or_cik)
            if not cik:
                logger.warning(f"Could not find CIK for symbol {symbol_or_cik}")
                return None
        else:
            cik = symbol_or_cik.zfill(10)
        
        endpoint = f"api/xbrl/companyfacts/CIK{cik}.json"
        
        try:
            response = self._make_request(endpoint)
            data = response.json()
            
            # Add our metadata
            data['symbol'] = symbol_or_cik if not symbol_or_cik.isdigit() else self._cik_mapping.get(cik, '')
            data['cik'] = cik
            data['collection_timestamp'] = datetime.now().isoformat()
            
            return data
            
        except Exception as e:
            logger.error(f"Failed to get company facts for {symbol_or_cik}: {e}")
            return None
    
    def get_company_submissions(self, symbol_or_cik: str) -> Optional[Dict[str, Any]]:
        """
        Get company submission history and metadata.
        
        Args:
            symbol_or_cik: Ticker symbol or CIK number
            
        Returns:
            Dictionary with company submissions data
        """
        # Convert ticker to CIK if necessary
        if not symbol_or_cik.isdigit():
            cik = self.get_cik_from_ticker(symbol_or_cik)
            if not cik:
                return None
        else:
            cik = symbol_or_cik.zfill(10)
        
        endpoint = f"api/xbrl/submissions/CIK{cik}.json"
        
        try:
            response = self._make_request(endpoint)
            data = response.json()
            
            # Add our metadata
            data['symbol'] = symbol_or_cik if not symbol_or_cik.isdigit() else self._cik_mapping.get(cik, '')
            data['cik'] = cik
            data['collection_timestamp'] = datetime.now().isoformat()
            
            return data
            
        except Exception as e:
            logger.error(f"Failed to get submissions for {symbol_or_cik}: {e}")
            return None
    
    def get_company_filings(self, symbol_or_cik: str, date_range: DateRange) -> List[Dict[str, Any]]:
        """
        Get company filings within date range.
        
        Args:
            symbol_or_cik: Ticker symbol or CIK number
            date_range: Date range for filings
            
        Returns:
            List of filing dictionaries
        """
        submissions = self.get_company_submissions(symbol_or_cik)
        if not submissions or 'filings' not in submissions:
            return []
        
        filings = []
        recent_filings = submissions['filings']['recent']
        
        # Filter filings by date range
        for i in range(len(recent_filings['accessionNumber'])):
            filing_date_str = recent_filings['filingDate'][i]
            filing_date = datetime.strptime(filing_date_str, '%Y-%m-%d').date()
            
            if date_range.start_date <= filing_date <= date_range.end_date:
                filing = {
                    'symbol': symbol_or_cik if not symbol_or_cik.isdigit() else self._cik_mapping.get(symbol_or_cik, ''),
                    'cik': submissions['cik'],
                    'accession_number': recent_filings['accessionNumber'][i],
                    'form_type': recent_filings['form'][i],
                    'filing_date': filing_date_str,
                    'report_date': recent_filings['reportDate'][i],
                    'acceptance_datetime': recent_filings['acceptanceDateTime'][i],
                    'act': recent_filings['act'][i],
                    'file_number': recent_filings['fileNumber'][i],
                    'primary_document': recent_filings['primaryDocument'][i],
                    'primary_doc_description': recent_filings['primaryDocDescription'][i]
                }
                filings.append(filing)
        
        return filings
    
    def get_available_symbols(
        self, 
        exchange: Optional[str] = None,
        sector: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get list of available company symbols from SEC database.
        
        Args:
            exchange: Filter by exchange (not used by SEC)
            sector: Filter by sector (not directly available)
            
        Returns:
            List of dictionaries with symbol metadata
        """
        mapping = self.get_ticker_mapping()
        
        symbols = []
        for company_data in mapping.values():
            symbol_info = {
                'symbol': company_data['ticker'],
                'name': company_data['title'],
                'cik': str(company_data['cik_str']).zfill(10),
                'exchange': None,  # Not provided by SEC
                'sector': None     # Not provided by SEC
            }
            symbols.append(symbol_info)
        
        return symbols
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get current rate limit status."""
        return self.rate_limiter.get_status("sec_edgar_api")
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate if symbols are available in SEC database.
        
        Args:
            symbols: List of symbols to validate
            
        Returns:
            Dictionary mapping symbols to validation status
        """
        mapping = self.get_ticker_mapping()
        validation_results = {}
        
        for symbol in symbols:
            # Check if it's a ticker symbol
            found = False
            for company_data in mapping.values():
                if company_data['ticker'].upper() == symbol.upper():
                    found = True
                    break
            
            # Check if it's a CIK number
            if not found and symbol.isdigit():
                cik = symbol.zfill(10)
                found = cik in self._cik_mapping
            
            validation_results[symbol] = found
        
        return validation_results