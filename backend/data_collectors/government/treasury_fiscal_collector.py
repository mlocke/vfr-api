"""
Treasury Fiscal Data Collector

Collects U.S. government fiscal and debt data from the Treasury's Fiscal Data API,
containing comprehensive federal financial information including debt, spending, and revenue.

Data Sources:
- Daily Treasury Statement (government cash operations)
- Debt to the Penny (federal debt outstanding)
- Monthly Treasury Statement (detailed spending/revenue)
- Federal Revenue and Spending (fiscal operations)
- Treasury Securities Data (auction results, yields)

API Documentation: https://fiscaldata.treasury.gov/api-documentation/
Rate Limits: No explicit limits (reasonable use expected)
Authentication: None required (public data)
User-Agent: Recommended for identification

Key Fiscal Data Available:
- Federal debt levels and trends
- Government spending by category
- Federal revenue sources
- Treasury securities auction data
- Cash flow operations
"""

import pandas as pd
import requests
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Iterator, Optional, Union
from urllib.parse import urljoin, urlencode
import time
import json
import logging

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
    AuthenticationError,
    DataValidationError
)

logger = logging.getLogger(__name__)

class TreasuryFiscalCollector(DataCollectorInterface):
    """
    Treasury Fiscal Data API collector for government financial data.
    
    Specializes in fiscal/treasury analysis requests and only activates when
    specific treasury data is requested (fiscal indicators, debt data, etc.).
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """Initialize Treasury Fiscal collector."""
        if config is None:
            config = CollectorConfig()
            config.base_url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/"
            config.timeout = 30
            config.user_agent = "StockPicker/1.0 Treasury Fiscal Collector"
        
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': self.config.user_agent,
            'Accept': 'application/json'
        })
        
        # Rate limiter (conservative approach - no official limits)
        self.rate_limiter = RateLimiter(
            RateLimitConfig(
                requests_per_second=5,
                requests_per_minute=300,
                requests_per_hour=18000
            )
        )
        
        # Available endpoints for fiscal data
        self.endpoints = {
            'debt_to_penny': 'v2/accounting/od/debt_to_penny',
            'daily_treasury_statement': 'v1/accounting/dts/dts_table_1',
            'monthly_treasury_statement': 'v1/accounting/mts/mts_table_5',
            'federal_revenue': 'v1/accounting/mts/mts_table_4',
            'federal_spending': 'v1/accounting/mts/mts_table_2',
            'interest_rates': 'v1/accounting/od/rates_of_exchange',
            'treasury_operating_cash_balance': 'v1/accounting/dts/operating_cash_balance'
        }
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if Treasury Fiscal collector should handle the request.
        
        Activates for:
        - treasury_series requests 
        - fiscal_data requests
        - debt analysis
        - government spending analysis
        """
        # Check for treasury-specific request patterns
        treasury_indicators = [
            'treasury_series', 'fiscal_data', 'debt_data', 
            'government_spending', 'federal_revenue', 'treasury_debt'
        ]
        
        # Check if any treasury indicators are present
        for key in filter_criteria:
            if any(indicator in key.lower() for indicator in treasury_indicators):
                return True
                
        # Check for specific treasury data types
        if 'data_type' in filter_criteria:
            data_type = filter_criteria['data_type'].lower()
            if any(indicator in data_type for indicator in treasury_indicators):
                return True
        
        # Don't activate for individual company requests (SEC EDGAR territory)
        if any(key in filter_criteria for key in ['companies', 'symbols', 'tickers', 'ciks']):
            return False
            
        # Don't activate for broad economic indicators (FRED territory)
        if any(key in filter_criteria for key in ['fred_series', 'economic_series']):
            return False
            
        return False
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Return priority level for Treasury Fiscal collector (0-100).
        
        Priority 90: Specific treasury/fiscal data requests
        Priority 0: Not applicable for this request type
        """
        if not self.should_activate(filter_criteria):
            return 0
            
        # High priority for treasury-specific requests
        treasury_indicators = ['treasury_series', 'fiscal_data', 'debt_data']
        if any(key in filter_criteria for key in treasury_indicators):
            return 90
            
        # Medium priority for government financial data
        govt_indicators = ['government_spending', 'federal_revenue']
        if any(key in filter_criteria for key in govt_indicators):
            return 80
            
        return 70  # Default for other fiscal requests

    @with_error_handling
    def get_debt_to_penny(self, start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
        """
        Get federal debt outstanding data (Debt to the Penny).
        
        Args:
            start_date: Start date (YYYY-MM-DD format)
            end_date: End date (YYYY-MM-DD format) 
            limit: Maximum number of records to return
            
        Returns:
            Dictionary containing debt data and metadata
        """
        time.sleep(0.2)  # Simple rate limiting - 5 requests per second
        
        params = {
            'page[size]': min(limit, 10000),  # API maximum
            'sort': '-record_date'  # Most recent first
        }
        
        # Add date filters if provided
        if start_date and end_date:
            params['filter'] = f'record_date:gte:{start_date},record_date:lte:{end_date}'
        elif start_date:
            params['filter'] = f'record_date:gte:{start_date}'
        elif end_date:
            params['filter'] = f'record_date:lte:{end_date}'
        
        endpoint = self.endpoints['debt_to_penny']
        url = urljoin(self.config.base_url, endpoint)
        
        try:
            response = self.session.get(url, params=params, timeout=self.config.timeout)
            response.raise_for_status()
            data = response.json()
            
            # Process and structure the data
            if 'data' in data and data['data']:
                debt_records = data['data']
                
                # Extract latest debt amount
                latest_record = debt_records[0] if debt_records else {}
                latest_debt = float(latest_record.get('tot_pub_debt_out_amt', 0))
                
                # Calculate trends if we have multiple records
                debt_trend = self._calculate_debt_trend(debt_records) if len(debt_records) > 1 else None
                
                result = {
                    'data_type': 'Treasury Debt to the Penny',
                    'source': 'U.S. Treasury Fiscal Data',
                    'timestamp': datetime.now().isoformat(),
                    'latest_debt': {
                        'amount': latest_debt,
                        'date': latest_record.get('record_date'),
                        'formatted_amount': f"${latest_debt:,.0f}",
                        'amount_trillions': f"${latest_debt/1_000_000_000_000:.2f}T"
                    },
                    'trend_analysis': debt_trend,
                    'records_count': len(debt_records),
                    'raw_data': debt_records[:10],  # Store sample for reference
                    'metadata': {
                        'query_params': params,
                        'total_records_available': len(debt_records)
                    }
                }
                
                return result
            else:
                raise DataValidationError("No debt data returned from Treasury API")
                
        except requests.exceptions.RequestException as e:
            raise NetworkError(f"Failed to fetch Treasury debt data: {e}")
    
    @with_error_handling  
    def get_daily_treasury_statement(self, start_date: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        """
        Get Daily Treasury Statement data (government cash operations).
        
        Args:
            start_date: Start date (YYYY-MM-DD format)
            limit: Maximum number of records
            
        Returns:
            Dictionary containing daily treasury operations data
        """
        time.sleep(0.2)  # Simple rate limiting - 5 requests per second
        
        params = {
            'page[size]': min(limit, 1000),
            'sort': '-record_date'
        }
        
        if start_date:
            params['filter'] = f'record_date:gte:{start_date}'
        
        # Try primary endpoint first
        endpoint = self.endpoints['daily_treasury_statement']
        url = urljoin(self.config.base_url, endpoint)
        
        try:
            response = self.session.get(url, params=params, timeout=self.config.timeout)
            response.raise_for_status()
            data = response.json()
            
            if 'data' in data and data['data']:
                treasury_records = data['data']
                
                # Process daily operations data
                processed_data = []
                for record in treasury_records[:10]:  # Process top 10 for summary
                    processed_record = {
                        'date': record.get('record_date'),
                        'opening_balance': record.get('open_today_bal', 0),
                        'closing_balance': record.get('close_today_bal', 0),
                        'receipts': record.get('total_receipts', 0),
                        'withdrawals': record.get('total_withdrawals', 0),
                        'net_change': record.get('net_change', 0)
                    }
                    processed_data.append(processed_record)
                
                result = {
                    'data_type': 'Daily Treasury Statement',
                    'source': 'U.S. Treasury Fiscal Data', 
                    'timestamp': datetime.now().isoformat(),
                    'summary': {
                        'latest_date': processed_data[0]['date'] if processed_data else None,
                        'latest_balance': processed_data[0]['closing_balance'] if processed_data else 0,
                        'records_analyzed': len(processed_data)
                    },
                    'daily_operations': processed_data,
                    'metadata': {
                        'total_records': len(treasury_records),
                        'query_params': params,
                        'endpoint_used': 'primary'
                    }
                }
                
                return result
            else:
                raise DataValidationError("No daily treasury data returned")
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"Primary treasury operations endpoint failed: {e}")
            
            # Fallback: return simplified treasury operations based on debt data trends
            try:
                logger.info("Attempting fallback treasury operations using debt data")
                debt_data = self.get_debt_to_penny(start_date=start_date, limit=min(limit, 10))
                
                if debt_data and 'raw_data' in debt_data:
                    # Create simplified operations from debt data
                    processed_data = []
                    for record in debt_data['raw_data'][:5]:
                        processed_record = {
                            'date': record.get('record_date'),
                            'opening_balance': 'N/A - Using Fallback Data',
                            'closing_balance': 'N/A - Using Fallback Data',
                            'receipts': 'N/A - Using Fallback Data', 
                            'withdrawals': 'N/A - Using Fallback Data',
                            'debt_amount': float(record.get('tot_pub_debt_out_amt', 0))
                        }
                        processed_data.append(processed_record)
                    
                    result = {
                        'data_type': 'Daily Treasury Statement (Fallback)',
                        'source': 'U.S. Treasury Fiscal Data (Debt-based fallback)', 
                        'timestamp': datetime.now().isoformat(),
                        'summary': {
                            'latest_date': processed_data[0]['date'] if processed_data else None,
                            'latest_balance': 'Fallback mode - operations data unavailable',
                            'records_analyzed': len(processed_data)
                        },
                        'daily_operations': processed_data,
                        'metadata': {
                            'total_records': len(processed_data),
                            'query_params': params,
                            'endpoint_used': 'fallback',
                            'fallback_reason': f'Primary endpoint failed: {e}'
                        }
                    }
                    
                    return result
                else:
                    raise NetworkError(f"Both primary and fallback treasury operations failed: {e}")
                    
            except Exception as fallback_error:
                raise NetworkError(f"Failed to fetch daily treasury data: {e}. Fallback also failed: {fallback_error}")
    
    @with_error_handling
    def get_federal_spending(self, fiscal_year: Optional[int] = None, limit: int = 100) -> Dict[str, Any]:
        """
        Get federal spending data by category.
        
        Args:
            fiscal_year: Specific fiscal year to analyze
            limit: Maximum number of records
            
        Returns:
            Dictionary containing federal spending breakdown
        """
        time.sleep(0.2)  # Simple rate limiting - 5 requests per second
        
        params = {
            'page[size]': min(limit, 1000),
            'sort': '-record_date'
        }
        
        if fiscal_year:
            params['filter'] = f'record_fiscal_year:eq:{fiscal_year}'
        
        endpoint = self.endpoints['federal_spending']
        url = urljoin(self.config.base_url, endpoint)
        
        try:
            response = self.session.get(url, params=params, timeout=self.config.timeout)
            response.raise_for_status()
            data = response.json()
            
            if 'data' in data and data['data']:
                spending_records = data['data']
                
                # Aggregate spending by category
                spending_summary = self._analyze_spending_data(spending_records)
                
                result = {
                    'data_type': 'Federal Government Spending',
                    'source': 'U.S. Treasury Fiscal Data',
                    'timestamp': datetime.now().isoformat(),
                    'spending_analysis': spending_summary,
                    'sample_records': spending_records[:5],
                    'metadata': {
                        'fiscal_year': fiscal_year,
                        'total_records': len(spending_records),
                        'query_params': params
                    }
                }
                
                return result
            else:
                raise DataValidationError("No federal spending data returned")
                
        except requests.exceptions.RequestException as e:
            raise NetworkError(f"Failed to fetch federal spending data: {e}")
    
    @with_error_handling
    def get_comprehensive_fiscal_summary(self, date_range_days: int = 30) -> Dict[str, Any]:
        """
        Get comprehensive fiscal data summary combining multiple endpoints.
        
        Args:
            date_range_days: Number of days of historical data to analyze
            
        Returns:
            Dictionary containing comprehensive fiscal analysis
        """
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=date_range_days)
        
        logger.info(f"Generating comprehensive fiscal summary for {date_range_days} days")
        
        try:
            # Gather data from multiple endpoints
            debt_data = self.get_debt_to_penny(
                start_date=start_date.isoformat(),
                limit=date_range_days
            )
            
            daily_operations = self.get_daily_treasury_statement(
                start_date=start_date.isoformat(),
                limit=date_range_days
            )
            
            # Create comprehensive summary
            summary = {
                'analysis_type': 'Comprehensive Treasury Fiscal Analysis',
                'source': 'U.S. Treasury Fiscal Data API',
                'timestamp': datetime.now().isoformat(),
                'analysis_period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(), 
                    'days_analyzed': date_range_days
                },
                'fiscal_highlights': {
                    'current_total_debt': debt_data['latest_debt'],
                    'debt_trend': debt_data.get('trend_analysis'),
                    'daily_operations': daily_operations['summary'],
                },
                'data_sources': {
                    'debt_to_penny': debt_data,
                    'daily_treasury_operations': daily_operations
                },
                'investment_context': {
                    'debt_implications': self._analyze_debt_implications(debt_data),
                    'fiscal_health_score': self._calculate_fiscal_health_score(debt_data, daily_operations),
                    'market_considerations': self._generate_market_considerations(debt_data)
                }
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Failed to generate comprehensive fiscal summary: {e}")
            raise DataValidationError(f"Comprehensive analysis failed: {e}")
    
    def _calculate_debt_trend(self, debt_records: List[Dict]) -> Dict[str, Any]:
        """Calculate debt trend analysis from historical records."""
        if len(debt_records) < 2:
            return None
            
        try:
            # Get first and last records for trend
            latest = float(debt_records[0].get('tot_pub_debt_out_amt', 0))
            oldest = float(debt_records[-1].get('tot_pub_debt_out_amt', 0))
            
            change = latest - oldest
            change_percent = (change / oldest * 100) if oldest > 0 else 0
            
            return {
                'period_change': change,
                'period_change_percent': round(change_percent, 2),
                'period_change_formatted': f"${change:,.0f}",
                'direction': 'increasing' if change > 0 else 'decreasing' if change < 0 else 'stable',
                'daily_average_change': change / len(debt_records) if len(debt_records) > 0 else 0
            }
        except (ValueError, TypeError):
            return {'error': 'Unable to calculate debt trend'}
    
    def _analyze_spending_data(self, spending_records: List[Dict]) -> Dict[str, Any]:
        """Analyze federal spending data for insights."""
        if not spending_records:
            return {'error': 'No spending data available'}
            
        try:
            total_spending = 0
            spending_by_category = {}
            
            for record in spending_records:
                amount = float(record.get('current_month_total_receipts', 0))
                category = record.get('classification_desc', 'Unknown')
                
                total_spending += amount
                spending_by_category[category] = spending_by_category.get(category, 0) + amount
            
            # Sort categories by spending amount
            top_categories = sorted(spending_by_category.items(), 
                                  key=lambda x: x[1], reverse=True)[:5]
            
            return {
                'total_spending': total_spending,
                'total_spending_formatted': f"${total_spending:,.0f}",
                'top_spending_categories': [
                    {'category': cat, 'amount': amt, 'formatted': f"${amt:,.0f}"}
                    for cat, amt in top_categories
                ],
                'categories_analyzed': len(spending_by_category)
            }
        except (ValueError, TypeError):
            return {'error': 'Unable to analyze spending data'}
    
    def _analyze_debt_implications(self, debt_data: Dict) -> Dict[str, Any]:
        """Analyze debt data for investment implications."""
        current_debt = debt_data['latest_debt']['amount']
        
        implications = {
            'debt_level_assessment': 'Very High' if current_debt > 30_000_000_000_000 else 'High',
            'key_concerns': [
                'Interest rate sensitivity - higher rates increase debt servicing costs',
                'Inflationary pressure from government spending',
                'Potential for fiscal consolidation measures'
            ],
            'sector_impacts': {
                'financials': 'May benefit from higher interest rates',
                'government_contractors': 'Vulnerable to spending cuts',
                'infrastructure': 'May benefit from fiscal spending programs'
            }
        }
        
        return implications
    
    def _calculate_fiscal_health_score(self, debt_data: Dict, operations_data: Dict) -> int:
        """Calculate a fiscal health score (1-100)."""
        # Simplified scoring based on debt trends and operations
        base_score = 50  # Neutral starting point
        
        debt_trend = debt_data.get('trend_analysis')
        if debt_trend:
            if debt_trend['direction'] == 'increasing':
                base_score -= 10
            elif debt_trend['direction'] == 'decreasing':
                base_score += 15
        
        # Ensure score is within bounds
        return max(1, min(100, base_score))
    
    def _generate_market_considerations(self, debt_data: Dict) -> List[str]:
        """Generate market considerations based on fiscal data."""
        considerations = [
            "Monitor Treasury yield movements for debt sustainability signals",
            "Watch for Federal Reserve policy responses to fiscal conditions", 
            "Consider inflation hedges if debt monetization increases",
            "Evaluate currency strength implications of fiscal policy"
        ]
        
        return considerations

    # Data collection interface methods
    def authenticate(self) -> bool:
        """Authentication not required for Treasury Fiscal Data API."""
        return True
        
    def collect_batch(self, symbols: List[str], date_range: DateRange) -> pd.DataFrame:
        """Collect batch fiscal data - adapted for treasury series."""
        # Treasury API uses different identifiers than stock symbols
        # This method adapts the interface for fiscal data requests
        results = []
        
        for series_type in symbols:  # Treat as fiscal data series types
            if 'debt' in series_type.lower():
                data = self.get_debt_to_penny(
                    start_date=date_range.start.isoformat(),
                    end_date=date_range.end.isoformat()
                )
                results.append(data)
                
        return pd.DataFrame(results) if results else pd.DataFrame()
    
    def collect_realtime(self, symbols: List[str]) -> Iterator[Dict]:
        """Collect real-time fiscal data."""
        for series_type in symbols:
            if 'debt' in series_type.lower():
                yield self.get_debt_to_penny(limit=1)
            elif 'operations' in series_type.lower():
                yield self.get_daily_treasury_statement(limit=1)
    
    def get_rate_limits(self) -> RateLimitConfig:
        """Return current rate limit configuration."""
        return self.rate_limiter.config
    
    def validate_data(self, data: Dict) -> Dict[str, Any]:
        """Validate Treasury fiscal data."""
        validation_result = {
            'is_valid': True,
            'errors': [],
            'warnings': []
        }
        
        # Check for required fields
        if not data.get('data_type'):
            validation_result['errors'].append('Missing data_type field')
            validation_result['is_valid'] = False
            
        if not data.get('timestamp'):
            validation_result['warnings'].append('Missing timestamp')
            
        return validation_result
    
    # Required abstract methods from DataCollectorInterface
    @property
    def source_name(self) -> str:
        """Return the name of this data source."""
        return "U.S. Treasury Fiscal Data"
    
    @property 
    def requires_api_key(self) -> bool:
        """Treasury Fiscal Data API does not require an API key."""
        return False
    
    @property
    def supported_data_types(self) -> List[str]:
        """Return list of supported fiscal data types."""
        return [
            'debt_to_penny',
            'daily_treasury_statement', 
            'federal_spending',
            'federal_revenue',
            'fiscal_operations',
            'treasury_securities'
        ]
    
    def get_available_symbols(self) -> List[str]:
        """
        Get available fiscal data series identifiers.
        For Treasury data, these are fiscal series types rather than stock symbols.
        """
        return [
            'DEBT_TOTAL',           # Total federal debt
            'DEBT_PUBLIC',          # Debt held by public
            'DEBT_INTERGOVERNMENTAL', # Intragovernmental debt
            'TREASURY_BALANCE',     # Daily treasury balance
            'FEDERAL_RECEIPTS',     # Government receipts
            'FEDERAL_OUTLAYS',      # Government outlays
            'NET_OPERATING_COST',   # Net operating cost
            'BUDGET_DEFICIT',       # Budget deficit/surplus
            'INTEREST_EXPENSE'      # Interest on debt
        ]
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate fiscal data series symbols.
        
        Args:
            symbols: List of fiscal series identifiers to validate
            
        Returns:
            Dictionary mapping each symbol to validation status
        """
        available_symbols = self.get_available_symbols()
        return {
            symbol: symbol in available_symbols or any(
                keyword in symbol.upper() 
                for keyword in ['DEBT', 'TREASURY', 'FISCAL', 'FEDERAL', 'BUDGET']
            )
            for symbol in symbols
        }
    
    def test_connection(self) -> bool:
        """
        Test connection to Treasury Fiscal Data API.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Test with a simple debt query
            test_url = urljoin(self.config.base_url, self.endpoints['debt_to_penny'])
            params = {'page[size]': 1}
            
            response = self.session.get(test_url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            return 'data' in data and isinstance(data['data'], list)
            
        except Exception:
            return False