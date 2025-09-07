"""
FDIC BankFind Suite API Collector

Collects banking and financial institution data from the FDIC BankFind Suite API,
providing access to comprehensive banking sector analysis, institution health metrics,
and regulatory status information.

Data Sources:
- Institution financial data (4,000+ US banks and credit unions)
- Bank branch location data
- Historical institution changes and events
- Bank failure data and risk indicators
- Financial summaries and Call Report data
- Regulatory status and compliance information

API Documentation: https://api.fdic.gov/banks/docs
Rate Limits: No specific limits (reasonable usage expected)
Authentication: No API key required (open public API)
Data Updates: Quarterly (following Call Report submissions)

Key Financial Indicators:
- Return on Assets (ROA) and Return on Equity (ROE)
- Total Assets, Deposits, and Net Income
- Capital adequacy and equity ratios
- Regulatory status and enforcement actions
- Geographic and demographic classifications
"""

import pandas as pd
import requests
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Iterator, Optional, Union
from urllib.parse import urljoin
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


class FDICCollector(DataCollectorInterface):
    """
    FDIC BankFind Suite API collector.
    
    Provides access to:
    - Banking institution financial data and health metrics
    - Bank branch locations and geographic analysis
    - Historical institution changes and structure events
    - Bank failure data and risk assessment
    - Regulatory status and compliance information
    - Banking sector screening and comparative analysis
    
    No API key required - open public access to FDIC data.
    """
    
    BASE_URL = "https://api.fdic.gov/banks/"
    
    # FDIC Institution Classifications
    BANK_CLASSES = {
        'N': 'National Bank',
        'NM': 'National Bank (Mutual)',  
        'SM': 'State Mutual Savings Bank',
        'SB': 'State Savings Bank',
        'SA': 'Savings Association',
        'OI': 'Other Institution'
    }
    
    # Key financial health indicators available from FDIC API
    FINANCIAL_METRICS = {
        'ROA': 'Return on Assets',
        'ROE': 'Return on Equity',
        'ASSET': 'Total Assets',
        'DEP': 'Total Deposits', 
        'NETINC': 'Net Income',
        'EQ': 'Total Equity Capital',
        'ROAQ': 'Return on Assets Quarterly',
        'ROEQ': 'Return on Equity Quarterly'
    }
    
    # Geographic classifications
    REGULATORY_REGIONS = {
        'ATLANTA': ['AL', 'FL', 'GA', 'NC', 'SC', 'VA', 'WV'],
        'CHICAGO': ['IL', 'IN', 'IA', 'KY', 'MI', 'MN', 'ND', 'OH', 'SD', 'WI'],
        'DALLAS': ['AR', 'CO', 'LA', 'MO', 'NE', 'NM', 'OK', 'TX'],
        'KANSAS_CITY': ['KS', 'MO', 'NE', 'OK'],
        'NEW_YORK': ['CT', 'DE', 'DC', 'ME', 'MD', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
        'SAN_FRANCISCO': ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY']
    }
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """Initialize FDIC collector with configuration."""
        if config is None:
            config = CollectorConfig(
                timeout=30,
                max_retries=3,
                retry_delay=1.0,
                rate_limit_enabled=True,
                requests_per_minute=30,  # Conservative rate limiting
                validate_data=True
            )
        
        super().__init__(config)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Stock-Picker-Platform/1.0 FDIC-Banking-Analysis',
            'Accept': 'application/json'
        })
        
        # Rate limiter for API requests
        self.rate_limiter = RateLimiter(
            RateLimitConfig(
                requests_per_minute=config.requests_per_minute,
                requests_per_hour=config.requests_per_minute * 60,
                burst_limit=5
            )
        )
        
        # Error handler for robust API interaction
        retry_config = RetryConfig()
        retry_config.max_attempts = config.max_retries
        retry_config.initial_delay = config.retry_delay
        retry_config.max_delay = 30.0
        retry_config.backoff_factor = 2.0
        
        self.error_handler = ErrorHandler(retry_config)
    
    def should_activate(self, criteria: Dict[str, Any]) -> bool:
        """
        Determine if FDIC collector should activate based on filter criteria.
        
        Activates for:
        - Banking sector requests
        - Financial institution analysis
        - Banking market analysis
        - Regulatory status requests
        - Regional banking analysis
        
        Skips for:
        - Individual public company analysis (routes to SEC EDGAR)
        - Economic indicators (routes to FRED/BEA)
        - Treasury securities (routes to Treasury Direct)
        """
        criteria_str = str(criteria).lower()
        
        # Banking-specific indicators
        banking_indicators = [
            'banking', 'banks', 'financial_institutions', 'fdic', 'bank_health',
            'banking_sector', 'bank_analysis', 'institution_analysis',
            'bank_branches', 'bank_failures', 'regulatory_status',
            'banking_market', 'community_banks', 'regional_banks'
        ]
        
        # Check for banking-specific terms
        has_banking_indicators = any(indicator in criteria_str for indicator in banking_indicators)
        
        # Check for FDIC-specific criteria
        has_fdic_specific = any(key in criteria for key in [
            'banking_sector', 'bank_health', 'institution_analysis',
            'fdic_data', 'banking_market', 'bank_failures'
        ])
        
        # Don't activate for individual company analysis (SEC EDGAR territory)
        has_companies = bool(criteria.get('companies')) or bool(criteria.get('symbols'))
        has_specific_companies = has_companies and len(criteria.get('companies', criteria.get('symbols', []))) <= 20
        
        # Don't activate for economic indicators (FRED/BEA territory) 
        economic_indicators = ['gdp', 'unemployment', 'inflation', 'federal_funds', 'economic_indicators']
        has_economic_indicators = any(indicator in criteria_str for indicator in economic_indicators)
        
        # Don't activate for Treasury data (Treasury collectors territory)
        treasury_indicators = ['treasury', 'bonds', 'bills', 'notes', 'yield_curve', 'federal_debt']
        has_treasury_indicators = any(indicator in criteria_str for indicator in treasury_indicators)
        
        return (has_banking_indicators or has_fdic_specific) and \
               not has_specific_companies and \
               not has_economic_indicators and \
               not has_treasury_indicators
    
    def get_activation_priority(self, criteria: Dict[str, Any]) -> int:
        """
        Calculate activation priority for FDIC collector.
        
        Args:
            criteria: Request criteria dictionary
            
        Returns:
            Priority score (0-100, higher = more priority)
        """
        if not self.should_activate(criteria):
            return 0
        
        priority = 60  # Base priority for banking data
        
        # Very high priority for explicit FDIC/banking requests
        if criteria.get('banking_sector') or criteria.get('bank_health'):
            priority = 90
        
        # High priority for banking analysis requests
        if criteria.get('analysis_type') == 'banking':
            priority += 25
            
        # High priority for financial institution analysis
        if 'institution_analysis' in str(criteria).lower():
            priority += 20
            
        # Medium to high priority for banking market analysis
        banking_keywords = ['banking', 'banks', 'financial_institutions', 'bank_health', 'regulatory']
        criteria_str = str(criteria).lower()
        matching_keywords = sum(1 for keyword in banking_keywords if keyword in criteria_str)
        priority += matching_keywords * 3
        
        return min(priority, 100)
    
    @property
    def source_name(self) -> str:
        """Return the name of the data source."""
        return "Federal Deposit Insurance Corporation (FDIC)"
    
    @property
    def supported_data_types(self) -> List[str]:
        """Return list of supported data types."""
        return [
            "banking_institutions",     # Bank and credit union data
            "bank_financials",          # Financial performance metrics
            "bank_locations",           # Branch and location data
            "bank_failures",            # Failed institution data
            "regulatory_status",        # Regulatory and compliance data
            "banking_market_analysis",  # Market share and competition
            "bank_demographics"         # Geographic and demographic data
        ]
    
    @property
    def requires_api_key(self) -> bool:
        """FDIC API does not require API key."""
        return False
    
    @property
    def requires_authentication(self) -> bool:
        """FDIC API does not require authentication."""
        return False
    
    @with_error_handling
    def test_authentication(self) -> bool:
        """
        Test connection to FDIC API.
        
        Returns:
            True if connection is successful (no auth required)
        """
        try:
            # Simple test request to verify API availability
            test_url = f"{self.BASE_URL}institutions"
            params = {
                'limit': 1,
                'format': 'json'
            }
            
            response = self.session.get(test_url, params=params, timeout=self.config.timeout)
            response.raise_for_status()
            
            logger.info("FDIC API connection test successful")
            return True
            
        except Exception as e:
            logger.error(f"FDIC API connection test failed: {str(e)}")
            return False
    
    @with_error_handling
    def get_institutions(self, filters: Optional[str] = None, limit: int = 100, 
                        offset: int = 0) -> Dict[str, Any]:
        """
        Get banking institution data from FDIC API.
        
        Args:
            filters: FDIC API filter string (e.g., 'STNAME:California')
            limit: Maximum number of records to return
            offset: Number of records to skip
            
        Returns:
            Dictionary containing institution data and metadata
        """
        url = f"{self.BASE_URL}institutions"
        params = {
            'format': 'json',
            'limit': limit,
            'offset': offset
        }
        
        if filters:
            params['filters'] = filters
        
        # Apply rate limiting
        if self.config.rate_limit_enabled:
            self.rate_limiter.wait_if_needed()
        
        response = self.session.get(url, params=params, timeout=self.config.timeout)
        response.raise_for_status()
        
        data = response.json()
        
        logger.info(f"Retrieved {len(data.get('data', []))} institutions from FDIC API")
        return data
    
    @with_error_handling  
    def get_bank_health_analysis(self, institution_id: Optional[str] = None,
                                region: Optional[str] = None) -> Dict[str, Any]:
        """
        Perform bank health analysis using FDIC financial metrics.
        
        Args:
            institution_id: Specific institution CERT ID (optional)
            region: Geographic region for analysis (optional)
            
        Returns:
            Dictionary containing bank health analysis and scoring
        """
        filters = []
        
        if institution_id:
            filters.append(f"CERT:{institution_id}")
        
        if region:
            if region.upper() in ['CA', 'NY', 'TX', 'FL']:
                filters.append(f"STNAME:{self._get_state_name(region.upper())}")
            else:
                filters.append(f"STNAME:{region}")
        
        filter_string = " AND ".join(filters) if filters else None
        
        # Get institution data
        institutions_data = self.get_institutions(filters=filter_string, limit=1000)
        
        if not institutions_data.get('data'):
            return {
                'status': 'error',
                'message': 'No institutions found for specified criteria',
                'analysis': None
            }
        
        # Calculate health scores for institutions
        health_analysis = {
            'total_institutions': len(institutions_data['data']),
            'analysis_date': datetime.now().isoformat(),
            'health_scores': [],
            'summary_statistics': {},
            'risk_assessment': {}
        }
        
        # Process each institution (extract nested data)
        for institution_record in institutions_data['data']:
            institution = institution_record.get('data', institution_record)
            health_score = self._calculate_bank_health_score(institution)
            if health_score:
                health_analysis['health_scores'].append(health_score)
        
        # Calculate summary statistics
        if health_analysis['health_scores']:
            health_analysis['summary_statistics'] = self._calculate_health_summary(
                health_analysis['health_scores']
            )
            health_analysis['risk_assessment'] = self._assess_systematic_risk(
                health_analysis['health_scores']
            )
        
        logger.info(f"Completed bank health analysis for {health_analysis['total_institutions']} institutions")
        return health_analysis
    
    def _calculate_bank_health_score(self, institution: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Calculate CAMELS-style health score for an individual institution.
        
        Args:
            institution: Institution data from FDIC API
            
        Returns:
            Dictionary containing health score and metrics, or None if insufficient data
        """
        try:
            # Extract key financial metrics
            roa = self._safe_float(institution.get('ROA'))
            roe = self._safe_float(institution.get('ROE'))
            assets = self._safe_float(institution.get('ASSET'))
            equity = self._safe_float(institution.get('EQ'))
            net_income = self._safe_float(institution.get('NETINC'))
            
            # Calculate derived metrics
            equity_ratio = (equity / assets * 100) if assets and assets > 0 else None
            
            # CAMELS-style scoring (simplified)
            score_components = {}
            
            # Capital Adequacy (25% weight)
            if equity_ratio is not None:
                if equity_ratio >= 15:
                    score_components['capital'] = 1  # Strong
                elif equity_ratio >= 10:
                    score_components['capital'] = 2  # Satisfactory  
                elif equity_ratio >= 6:
                    score_components['capital'] = 3  # Fair
                elif equity_ratio >= 3:
                    score_components['capital'] = 4  # Marginal
                else:
                    score_components['capital'] = 5  # Unsatisfactory
            
            # Asset Quality & Management (25% weight) - Using ROA as proxy
            if roa is not None:
                if roa >= 1.5:
                    score_components['assets'] = 1
                elif roa >= 1.0:
                    score_components['assets'] = 2
                elif roa >= 0.5:
                    score_components['assets'] = 3
                elif roa >= 0:
                    score_components['assets'] = 4
                else:
                    score_components['assets'] = 5
            
            # Earnings (25% weight) - Using ROE
            if roe is not None:
                if roe >= 15:
                    score_components['earnings'] = 1
                elif roe >= 10:
                    score_components['earnings'] = 2
                elif roe >= 5:
                    score_components['earnings'] = 3
                elif roe >= 0:
                    score_components['earnings'] = 4
                else:
                    score_components['earnings'] = 5
            
            # Liquidity & Sensitivity (25% weight) - Simplified based on size
            if assets:
                if assets >= 50000:  # Large banks (>$50B)
                    score_components['liquidity'] = 2
                elif assets >= 10000:  # Regional banks ($10-50B)
                    score_components['liquidity'] = 2
                else:  # Community banks (<$10B)
                    score_components['liquidity'] = 1
            
            # Calculate composite score
            if score_components:
                composite_score = sum(score_components.values()) / len(score_components)
            else:
                composite_score = None
            
            # Determine risk category
            if composite_score:
                if composite_score <= 1.5:
                    risk_category = "Low Risk"
                elif composite_score <= 2.5:
                    risk_category = "Moderate Risk"
                elif composite_score <= 3.5:
                    risk_category = "Elevated Risk"
                elif composite_score <= 4.5:
                    risk_category = "High Risk"
                else:
                    risk_category = "Critical Risk"
            else:
                risk_category = "Insufficient Data"
            
            return {
                'institution_name': institution.get('NAME', 'Unknown'),
                'cert_id': institution.get('CERT'),
                'state': institution.get('STALP'),
                'city': institution.get('CITY'),
                'financial_metrics': {
                    'roa': roa,
                    'roe': roe,
                    'assets': assets,
                    'equity_ratio': equity_ratio,
                    'net_income': net_income
                },
                'camels_components': score_components,
                'composite_score': composite_score,
                'risk_category': risk_category,
                'analysis_date': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.warning(f"Could not calculate health score for institution {institution.get('NAME', 'Unknown')}: {str(e)}")
            return None
    
    def _calculate_health_summary(self, health_scores: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate summary statistics for health analysis."""
        valid_scores = [score for score in health_scores if score.get('composite_score') is not None]
        
        if not valid_scores:
            return {'error': 'No valid health scores available'}
        
        composite_scores = [score['composite_score'] for score in valid_scores]
        
        # Risk category distribution
        risk_distribution = {}
        for score in valid_scores:
            risk_cat = score.get('risk_category', 'Unknown')
            risk_distribution[risk_cat] = risk_distribution.get(risk_cat, 0) + 1
        
        return {
            'total_analyzed': len(valid_scores),
            'average_score': sum(composite_scores) / len(composite_scores),
            'best_score': min(composite_scores),
            'worst_score': max(composite_scores),
            'risk_distribution': risk_distribution,
            'healthy_institutions': len([s for s in valid_scores if s.get('composite_score', 5) <= 2.0]),
            'at_risk_institutions': len([s for s in valid_scores if s.get('composite_score', 0) >= 4.0])
        }
    
    def _assess_systematic_risk(self, health_scores: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assess systematic risk in the analyzed banking sector."""
        valid_scores = [score for score in health_scores if score.get('composite_score') is not None]
        
        if not valid_scores:
            return {'error': 'Insufficient data for systematic risk assessment'}
        
        # Calculate concentration risk
        total_assets = sum(score['financial_metrics'].get('assets', 0) for score in valid_scores if score['financial_metrics'].get('assets'))
        
        # Geographic concentration
        state_distribution = {}
        for score in valid_scores:
            state = score.get('state', 'Unknown')
            state_distribution[state] = state_distribution.get(state, 0) + 1
        
        # Risk level distribution
        high_risk_count = len([s for s in valid_scores if s.get('composite_score', 0) >= 4.0])
        high_risk_percentage = (high_risk_count / len(valid_scores)) * 100 if valid_scores else 0
        
        # Overall system health assessment
        if high_risk_percentage >= 25:
            system_health = "High Systematic Risk"
        elif high_risk_percentage >= 15:
            system_health = "Elevated Systematic Risk"
        elif high_risk_percentage >= 5:
            system_health = "Moderate Systematic Risk"
        else:
            system_health = "Low Systematic Risk"
        
        return {
            'system_health_assessment': system_health,
            'high_risk_percentage': high_risk_percentage,
            'geographic_concentration': state_distribution,
            'total_assets_analyzed': total_assets,
            'risk_indicators': {
                'institutions_analyzed': len(valid_scores),
                'high_risk_institutions': high_risk_count,
                'geographic_diversity': len(state_distribution),
                'average_risk_score': sum(s.get('composite_score', 5) for s in valid_scores) / len(valid_scores)
            }
        }
    
    def filter_by_bank_characteristics(self, size: Optional[str] = None,
                                     geography: Optional[str] = None,
                                     specialty: Optional[str] = None) -> str:
        """
        Build FDIC API filter string for bank characteristics.
        
        Args:
            size: Bank size category ('community', 'regional', 'large')
            geography: Geographic filter (state code or region)
            specialty: Bank specialty type
            
        Returns:
            FDIC API compatible filter string
        """
        filters = []
        
        # Size-based filtering using asset thresholds
        if size:
            if size.lower() == 'community':
                filters.append("ASSET:[0 TO 10000]")  # < $10B
            elif size.lower() == 'regional':
                filters.append("ASSET:[10000 TO 50000]")  # $10B - $50B
            elif size.lower() == 'large':
                filters.append("ASSET:[50000 TO *]")  # > $50B
        
        # Geographic filtering
        if geography:
            if len(geography) == 2:  # State code
                state_name = self._get_state_name(geography.upper())
                if state_name:
                    filters.append(f'STNAME:"{state_name}"')
                else:
                    filters.append(f'STALP:{geography.upper()}')
            else:  # Full state name or region
                filters.append(f'STNAME:"{geography}"')
        
        # Specialty filtering (basic implementation)
        if specialty:
            if specialty.lower() == 'commercial':
                filters.append("CB:1")  # Commercial banks
            elif specialty.lower() == 'savings':
                filters.append("SA:1")  # Savings associations
        
        return " AND ".join(filters) if filters else ""
    
    def _get_state_name(self, state_code: str) -> Optional[str]:
        """Convert state code to full state name for FDIC API."""
        state_mapping = {
            'CA': 'California', 'NY': 'New York', 'TX': 'Texas', 'FL': 'Florida',
            'IL': 'Illinois', 'PA': 'Pennsylvania', 'OH': 'Ohio', 'GA': 'Georgia',
            'NC': 'North Carolina', 'MI': 'Michigan', 'NJ': 'New Jersey', 'VA': 'Virginia',
            'WA': 'Washington', 'AZ': 'Arizona', 'MA': 'Massachusetts', 'TN': 'Tennessee',
            'IN': 'Indiana', 'MD': 'Maryland', 'MO': 'Missouri', 'WI': 'Wisconsin',
            'CO': 'Colorado', 'MN': 'Minnesota', 'SC': 'South Carolina', 'AL': 'Alabama',
            'LA': 'Louisiana', 'KY': 'Kentucky', 'OR': 'Oregon', 'OK': 'Oklahoma',
            'CT': 'Connecticut', 'IA': 'Iowa', 'MS': 'Mississippi', 'AR': 'Arkansas',
            'UT': 'Utah', 'NV': 'Nevada', 'NM': 'New Mexico', 'WV': 'West Virginia',
            'NE': 'Nebraska', 'ID': 'Idaho', 'HI': 'Hawaii', 'ME': 'Maine',
            'NH': 'New Hampshire', 'RI': 'Rhode Island', 'MT': 'Montana', 'DE': 'Delaware',
            'SD': 'South Dakota', 'ND': 'North Dakota', 'AK': 'Alaska', 'VT': 'Vermont',
            'WY': 'Wyoming'
        }
        return state_mapping.get(state_code)
    
    def _safe_float(self, value: Any) -> Optional[float]:
        """Safely convert value to float, returning None if not possible."""
        try:
            if value is None or value == '' or value == 'NULL':
                return None
            return float(value)
        except (ValueError, TypeError):
            return None
    
    # Required interface methods (simplified implementations)
    
    @with_error_handling
    def authenticate(self) -> bool:
        """FDIC API doesn't require authentication."""
        return True
    
    @with_error_handling
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to FDIC API."""
        try:
            success = self.test_authentication()
            return {
                'status': 'success' if success else 'failed',
                'source': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'requires_auth': self.requires_authentication,
                'message': 'FDIC API connection successful' if success else 'FDIC API connection failed'
            }
        except Exception as e:
            return {
                'status': 'error',
                'source': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }
    
    def collect_batch(self, symbols: List[str], date_range: DateRange,
                     frequency: DataFrequency = DataFrequency.QUARTERLY,
                     data_type: str = "banking") -> pd.DataFrame:
        """Collect banking data for specified criteria."""
        # For FDIC, symbols represent institution names or CERT IDs
        # Implementation would collect and return standardized banking data
        # This is a placeholder for the abstract method requirement
        logger.info(f"Batch collection not implemented for FDIC banking data")
        return pd.DataFrame()
    
    def collect_realtime(self, symbols: List[str], data_type: str = "banking") -> Iterator[Dict[str, Any]]:
        """FDIC data is updated quarterly, no real-time collection."""
        logger.info("Real-time collection not available for FDIC banking data (quarterly updates)")
        return iter([])
    
    def get_available_symbols(self, exchange: Optional[str] = None,
                            sector: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get available banking institutions as 'symbols'."""
        try:
            # Get sample of institutions to return as available symbols
            data = self.get_institutions(limit=50)
            symbols = []
            
            for institution_record in data.get('data', []):
                institution = institution_record.get('data', institution_record)
                symbols.append({
                    'symbol': institution.get('CERT', 'N/A'),
                    'name': institution.get('NAME', 'Unknown'),
                    'state': institution.get('STALP', 'N/A'),
                    'city': institution.get('CITY', 'N/A'),
                    'type': 'FDIC_INSTITUTION'
                })
            
            return symbols
            
        except Exception as e:
            logger.error(f"Error getting available institutions: {str(e)}")
            return []
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get current rate limit status."""
        return {
            'source': self.source_name,
            'rate_limit_enabled': self.config.rate_limit_enabled,
            'requests_per_minute': self.config.requests_per_minute,
            'has_limits': False,  # FDIC API has no explicit rate limits
            'message': 'FDIC API has no explicit rate limits - reasonable usage expected'
        }
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """Validate institution CERT IDs or names."""
        # Basic validation - in production, could check against FDIC database
        validation_results = {}
        for symbol in symbols:
            # Assume CERT IDs are 5-digit numbers, names are strings
            if symbol.isdigit() and len(symbol) == 5:
                validation_results[symbol] = True  # Likely valid CERT ID
            elif len(symbol) > 3 and not symbol.isdigit():
                validation_results[symbol] = True  # Likely valid institution name
            else:
                validation_results[symbol] = False
        
        return validation_results