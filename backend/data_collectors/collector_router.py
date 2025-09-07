"""
Collector Router System - Smart Data Source Selection

This module implements intelligent routing of data requests to the most appropriate
collectors based on filter criteria specificity and data source strengths.

Architecture:
- Filter Analysis: Determines request type and specificity
- Collector Selection: Routes to optimal data sources  
- Priority Management: Handles overlapping capabilities
- Performance Optimization: Avoids unnecessary API calls
"""

import logging
from typing import Dict, List, Any, Optional, Type
from dataclasses import dataclass
from enum import Enum

from .base import DataCollectorInterface
from .government.sec_edgar_collector import SECEdgarCollector
from .government.treasury_fiscal_collector import TreasuryFiscalCollector
from .government.treasury_direct_collector import TreasuryDirectCollector
from .government.bea_collector import BEACollector
from .government.bls_collector import BLSCollector
from .government.eia_collector import EIACollector
from .government.fdic_collector import FDICCollector
# from .government.fred_collector import FREDCollector  # When implemented
# from .market.alpha_vantage_collector import AlphaVantageCollector  # When implemented

logger = logging.getLogger(__name__)

class RequestType(Enum):
    """Types of data requests that can be made."""
    INDIVIDUAL_COMPANY = "individual_company"
    COMPANY_COMPARISON = "company_comparison"
    SECTOR_ANALYSIS = "sector_analysis"
    INDEX_ANALYSIS = "index_analysis"
    ECONOMIC_DATA = "economic_data"
    FISCAL_DATA = "fiscal_data"
    EMPLOYMENT_DATA = "employment_data"
    INFLATION_DATA = "inflation_data"
    ENERGY_DATA = "energy_data"
    COMMODITY_DATA = "commodity_data"
    BANKING_DATA = "banking_data"
    MARKET_SCREENING = "market_screening"
    TECHNICAL_ANALYSIS = "technical_analysis"

@dataclass
class CollectorCapability:
    """Defines a collector's capabilities and optimal use cases."""
    collector_class: Type[DataCollectorInterface]
    primary_use_cases: List[RequestType]
    strengths: List[str]
    limitations: List[str]
    max_companies: Optional[int] = None
    requires_specific_companies: bool = False

class CollectorRouter:
    """
    Smart router that selects the most appropriate data collectors based on request filters.
    
    Routing Philosophy:
    1. Specificity First: More specific requests get priority collectors
    2. Strength Matching: Route requests to collector strengths  
    3. Efficiency: Avoid unnecessary API calls and over-fetching
    4. Fallback Strategy: Handle cases when primary collectors fail
    """
    
    def __init__(self):
        self.collector_registry = self._initialize_collector_registry()
        
    def _initialize_collector_registry(self) -> Dict[str, CollectorCapability]:
        """Initialize the registry of available collectors and their capabilities."""
        return {
            'sec_edgar': CollectorCapability(
                collector_class=SECEdgarCollector,
                primary_use_cases=[
                    RequestType.INDIVIDUAL_COMPANY,
                    RequestType.COMPANY_COMPARISON
                ],
                strengths=[
                    'Comprehensive fundamental analysis',
                    'Historical financial data (5+ years)',
                    'Regulatory filings and compliance data',
                    'Calculated financial ratios',
                    'Free access with no API limits',
                    'Audited financial statements'
                ],
                limitations=[
                    'No real-time price data',
                    'Limited to public US companies',
                    'Rate limited (10 req/sec)',
                    'No technical analysis data'
                ],
                max_companies=20,
                requires_specific_companies=True
            ),
            
            'treasury_fiscal': CollectorCapability(
                collector_class=TreasuryFiscalCollector,
                primary_use_cases=[
                    RequestType.FISCAL_DATA,
                    RequestType.ECONOMIC_DATA
                ],
                strengths=[
                    'Real federal debt data ($37.43T current)',
                    'Government spending and revenue analysis',
                    'Treasury operations data',
                    'Investment-grade fiscal health scoring',
                    'Free access with no API keys required',
                    'Daily updated government financial data'
                ],
                limitations=[
                    'No company-specific data',
                    'US government data only',
                    'Conservative rate limiting (5 req/sec)',
                    'Some endpoints may be unavailable'
                ],
                max_companies=None,
                requires_specific_companies=False
            ),
            
            'bea': CollectorCapability(
                collector_class=BEACollector,
                primary_use_cases=[
                    RequestType.ECONOMIC_DATA
                ],
                strengths=[
                    'Comprehensive GDP components and analysis',
                    'Regional economic data (state, county, metro)',
                    'Industry-specific GDP and value-added data',
                    'Personal income and consumption metrics',
                    'International trade and investment data',
                    'Authoritative source for US economic statistics'
                ],
                limitations=[
                    'Requires free API key registration',
                    'No company-specific data',
                    'US-focused economic data only',
                    'Conservative rate limiting (2 req/sec)',
                    'Complex data structure requiring processing'
                ],
                max_companies=None,
                requires_specific_companies=False
            ),
            
            'treasury_direct': CollectorCapability(
                collector_class=TreasuryDirectCollector,
                primary_use_cases=[
                    RequestType.FISCAL_DATA
                ],
                strengths=[
                    'Treasury securities data (Bills, Notes, Bonds, TIPS)',
                    'Yield curve analysis and interest rate data',
                    'Treasury auction results and schedules',
                    'Real-time Treasury market data',
                    'Free access with no API keys required',
                    'Comprehensive maturity range coverage (1Mo-30Yr)'
                ],
                limitations=[
                    'No company-specific data',
                    'Limited to US Treasury securities only',
                    'Conservative rate limiting (1 req/sec)',
                    'No equity or corporate bond data'
                ],
                max_companies=None,
                requires_specific_companies=False
            ),
            
            'bls': CollectorCapability(
                collector_class=BLSCollector,
                primary_use_cases=[
                    RequestType.EMPLOYMENT_DATA,
                    RequestType.INFLATION_DATA,
                    RequestType.ECONOMIC_DATA
                ],
                strengths=[
                    'Official US employment and unemployment statistics',
                    'Consumer Price Index (CPI) and Producer Price Index (PPI)',
                    'Job Openings and Labor Turnover Survey (JOLTS) data',
                    'Employment Cost Index and wage data',
                    'Labor productivity and unit labor cost measures',
                    'Free access with optional API key for higher limits',
                    'Monthly release schedule with reliable data quality'
                ],
                limitations=[
                    'No company-specific data',
                    'Limited to US labor market data',
                    'Rate limited (25 req/day without API key, 500 with)',
                    'Monthly data frequency (not real-time)',
                    'No financial market or stock data'
                ],
                max_companies=None,
                requires_specific_companies=False
            ),
            
            'eia': CollectorCapability(
                collector_class=EIACollector,
                primary_use_cases=[
                    RequestType.ENERGY_DATA,
                    RequestType.COMMODITY_DATA,
                    RequestType.ECONOMIC_DATA
                ],
                strengths=[
                    'Comprehensive energy market data (oil, gas, electricity)',
                    'Real-time commodity prices (WTI crude, Henry Hub gas)',
                    'Energy production and consumption statistics',
                    'Renewable energy capacity and generation data',
                    'Electricity grid and regional power market data',
                    'Coal, nuclear, and alternative fuel statistics',
                    'Energy forecasts and market analysis',
                    'Free access with API key registration'
                ],
                limitations=[
                    'Requires free API key registration',
                    'No company-specific data (energy sector only)',
                    'US-focused energy data primarily',
                    'Conservative rate limiting (60 req/min)',
                    'Energy market focus (not broader economic data)'
                ],
                max_companies=None,
                requires_specific_companies=False
            ),
            
            'fdic': CollectorCapability(
                collector_class=FDICCollector,
                primary_use_cases=[
                    RequestType.BANKING_DATA,
                    RequestType.SECTOR_ANALYSIS  # Banking sector
                ],
                strengths=[
                    'Comprehensive banking institution data (4,000+ US banks)',
                    'Bank health scoring and risk assessment (CAMELS-style)',
                    'Regulatory status and compliance information',
                    'Geographic banking market analysis',
                    'Systematic risk assessment for banking sector',
                    'Bank failure data and early warning indicators',
                    'Free access with no API keys required',
                    'Quarterly financial data from Call Reports'
                ],
                limitations=[
                    'Banking sector only (no other companies)',
                    'Quarterly data frequency (not real-time)',
                    'No market price data for bank stocks',
                    'US banking institutions only',
                    'Limited international banking data'
                ],
                max_companies=None,  # Can analyze entire banking sector
                requires_specific_companies=False
            ),
            
            # Future collectors to be added:
            # 'fred': CollectorCapability(...),
            # 'alpha_vantage': CollectorCapability(...),
            # 'sector_screener': CollectorCapability(...),
        }
    
    def route_request(self, filter_criteria: Dict[str, Any]) -> List[DataCollectorInterface]:
        """
        Route a data request to the most appropriate collectors.
        
        Args:
            filter_criteria: Dictionary containing request parameters
            
        Returns:
            List of instantiated collectors that should handle this request
            
        Example filter_criteria:
            {
                'companies': ['AAPL', 'MSFT', 'GOOGL'],
                'analysis_type': 'fundamental',
                'time_period': '5y'
            }
        """
        logger.info(f"Routing request with filters: {filter_criteria}")
        
        # Step 1: Analyze request type and requirements
        request_analysis = self._analyze_request(filter_criteria)
        
        # Step 2: Find capable collectors
        capable_collectors = self._find_capable_collectors(filter_criteria, request_analysis)
        
        # Step 3: Select optimal collectors based on priority
        selected_collectors = self._select_optimal_collectors(capable_collectors, filter_criteria)
        
        # Step 4: Instantiate and return collectors
        active_collectors = []
        for capability in selected_collectors:
            try:
                # Try to instantiate collector without arguments first
                collector = capability.collector_class()
                active_collectors.append(collector)
            except Exception as e:
                logger.warning(f"Failed to instantiate {capability.collector_class.__name__} without config: {e}")
                try:
                    # Try with None config parameter
                    collector = capability.collector_class(config=None)
                    active_collectors.append(collector)
                except Exception as e2:
                    logger.error(f"Failed to instantiate {capability.collector_class.__name__} with None config: {e2}")
                    # Skip this collector if both methods fail
        
        logger.info(f"Selected {len(active_collectors)} collectors: {[c.__class__.__name__ for c in active_collectors]}")
        return active_collectors
    
    def _analyze_request(self, filter_criteria: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the request to determine type and requirements."""
        analysis = {
            'request_type': None,
            'specificity_level': 'unknown',
            'data_requirements': [],
            'performance_considerations': {}
        }
        
        # Determine request type based on filters
        companies = self._get_specific_companies(filter_criteria)
        
        if len(companies) == 1:
            analysis['request_type'] = RequestType.INDIVIDUAL_COMPANY
            analysis['specificity_level'] = 'very_high'
        elif 2 <= len(companies) <= 20:
            analysis['request_type'] = RequestType.COMPANY_COMPARISON
            analysis['specificity_level'] = 'high'
        elif filter_criteria.get('sector') and not companies:
            analysis['request_type'] = RequestType.SECTOR_ANALYSIS
            analysis['specificity_level'] = 'medium'
        elif filter_criteria.get('index') and not companies:
            analysis['request_type'] = RequestType.INDEX_ANALYSIS
            analysis['specificity_level'] = 'medium'
        elif filter_criteria.get('economic_indicator') or filter_criteria.get('fred_series'):
            analysis['request_type'] = RequestType.ECONOMIC_DATA
            analysis['specificity_level'] = 'high'
        elif any(key in filter_criteria for key in ['treasury_series', 'fiscal_data', 'debt_data', 'government_spending']):
            analysis['request_type'] = RequestType.FISCAL_DATA
            analysis['specificity_level'] = 'high'
        elif any(key in filter_criteria for key in ['gdp', 'nipa', 'regional', 'industry_gdp', 'personal_income', 'bea_data']):
            analysis['request_type'] = RequestType.ECONOMIC_DATA
            analysis['specificity_level'] = 'high'
        elif any(key in filter_criteria for key in ['employment', 'unemployment', 'labor_force', 'jobs', 'jolts', 'bls_series']):
            analysis['request_type'] = RequestType.EMPLOYMENT_DATA
            analysis['specificity_level'] = 'high'
        elif any(key in filter_criteria for key in ['cpi', 'ppi', 'inflation', 'consumer_price', 'producer_price']):
            analysis['request_type'] = RequestType.INFLATION_DATA
            analysis['specificity_level'] = 'high'
        elif any(key in filter_criteria for key in ['energy', 'oil', 'gas', 'petroleum', 'crude', 'electricity', 'eia_series', 'energy_sector']):
            analysis['request_type'] = RequestType.ENERGY_DATA
            analysis['specificity_level'] = 'high'
        elif any(key in filter_criteria for key in ['commodities', 'commodity', 'wti', 'henry_hub', 'natural_gas', 'renewable']):
            analysis['request_type'] = RequestType.COMMODITY_DATA
            analysis['specificity_level'] = 'high'
        elif any(key in filter_criteria for key in ['banking_sector', 'bank_health', 'banking', 'banks', 'financial_institutions', 'fdic', 'institution_analysis', 'banking_market']):
            analysis['request_type'] = RequestType.BANKING_DATA
            analysis['specificity_level'] = 'high'
        else:
            analysis['request_type'] = RequestType.MARKET_SCREENING
            analysis['specificity_level'] = 'low'
        
        # Determine data requirements
        if filter_criteria.get('analysis_type') == 'fundamental':
            analysis['data_requirements'].append('financial_statements')
            analysis['data_requirements'].append('calculated_ratios')
        
        if filter_criteria.get('analysis_type') == 'technical':
            analysis['data_requirements'].append('price_data')
            analysis['data_requirements'].append('volume_data')
        
        # Performance considerations
        analysis['performance_considerations'] = {
            'company_count': len(companies),
            'time_sensitivity': filter_criteria.get('real_time', False),
            'data_depth': filter_criteria.get('analysis_depth', 'standard')
        }
        
        logger.debug(f"Request analysis: {analysis}")
        return analysis
    
    def _find_capable_collectors(self, filter_criteria: Dict[str, Any], 
                               request_analysis: Dict[str, Any]) -> List[CollectorCapability]:
        """Find collectors capable of handling this request."""
        capable_collectors = []
        
        for collector_name, capability in self.collector_registry.items():
            # Check if collector can handle this request type
            if request_analysis['request_type'] in capability.primary_use_cases:
                
                # Check specific requirements
                try:
                    collector_instance = capability.collector_class()
                except Exception:
                    try:
                        collector_instance = capability.collector_class(config=None)
                    except Exception:
                        logger.warning(f"Cannot instantiate {capability.collector_class.__name__} for activation check")
                        continue
                
                if hasattr(collector_instance, 'should_activate'):
                    if collector_instance.should_activate(filter_criteria):
                        capable_collectors.append(capability)
                        logger.debug(f"{collector_name} can handle request")
                    else:
                        logger.debug(f"{collector_name} declined to handle request")
                else:
                    # Fallback for collectors without should_activate method
                    capable_collectors.append(capability)
                    logger.debug(f"{collector_name} added as capable (no should_activate method)")
        
        return capable_collectors
    
    def _select_optimal_collectors(self, capable_collectors: List[CollectorCapability],
                                 filter_criteria: Dict[str, Any]) -> List[CollectorCapability]:
        """Select the optimal collectors from those capable of handling the request."""
        if not capable_collectors:
            logger.warning("No capable collectors found for request")
            return []
        
        # Calculate priority scores for each collector
        collector_scores = []
        
        for capability in capable_collectors:
            try:
                collector_instance = capability.collector_class()
            except Exception:
                try:
                    collector_instance = capability.collector_class(config=None)
                except Exception:
                    logger.warning(f"Cannot instantiate {capability.collector_class.__name__} for priority check")
                    continue
            
            if hasattr(collector_instance, 'get_activation_priority'):
                priority = collector_instance.get_activation_priority(filter_criteria)
            else:
                # Default priority based on use case match
                priority = 50  # Medium priority
            
            collector_scores.append((capability, priority))
            logger.debug(f"{capability.collector_class.__name__} priority: {priority}")
        
        # Sort by priority (highest first)
        collector_scores.sort(key=lambda x: x[1], reverse=True)
        
        # For now, return only the highest priority collector
        # Future: Could return multiple collectors for data enrichment
        if collector_scores[0][1] > 0:
            return [collector_scores[0][0]]
        else:
            logger.warning("No collectors willing to handle request")
            return []
    
    def _get_specific_companies(self, filter_criteria: Dict[str, Any]) -> List[str]:
        """Extract all specific company identifiers from filter criteria."""
        companies = []
        
        # Collect from various possible field names
        for field in ['companies', 'symbols', 'tickers', 'ciks']:
            values = filter_criteria.get(field, [])
            if isinstance(values, list):
                companies.extend(values)
            elif values:  # Single string value
                companies.append(values)
        
        return list(set(companies))  # Remove duplicates
    
    def get_collector_info(self) -> Dict[str, Dict[str, Any]]:
        """Get information about all registered collectors."""
        info = {}
        
        for collector_name, capability in self.collector_registry.items():
            info[collector_name] = {
                'class_name': capability.collector_class.__name__,
                'primary_use_cases': [uc.value for uc in capability.primary_use_cases],
                'strengths': capability.strengths,
                'limitations': capability.limitations,
                'max_companies': capability.max_companies,
                'requires_specific_companies': capability.requires_specific_companies
            }
        
        return info
    
    def validate_request(self, filter_criteria: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a request and provide guidance on optimal filtering.
        
        Returns:
            Dictionary with validation results and recommendations
        """
        validation = {
            'is_valid': True,
            'warnings': [],
            'recommendations': [],
            'expected_collectors': []
        }
        
        # Get expected routing
        try:
            collectors = self.route_request(filter_criteria)
            validation['expected_collectors'] = [c.__class__.__name__ for c in collectors]
        except Exception as e:
            validation['is_valid'] = False
            validation['warnings'].append(f"Routing failed: {e}")
        
        # Check for common issues
        companies = self._get_specific_companies(filter_criteria)
        
        if len(companies) > 50:
            validation['warnings'].append(f"Large company count ({len(companies)}) may be slow")
            validation['recommendations'].append("Consider breaking into smaller batches")
        
        if not companies and not filter_criteria.get('sector') and not filter_criteria.get('index'):
            validation['warnings'].append("No specific companies or sectors specified")
            validation['recommendations'].append("Add 'companies', 'sector', or 'index' filters")
        
        return validation

# Convenience function for easy integration
def route_data_request(filter_criteria: Dict[str, Any]) -> List[DataCollectorInterface]:
    """
    Convenience function to route a data request.
    
    Args:
        filter_criteria: Dictionary containing request parameters
        
    Returns:
        List of instantiated collectors to handle the request
        
    Example:
        collectors = route_data_request({
            'companies': ['AAPL', 'MSFT'],
            'analysis_type': 'fundamental'
        })
    """
    router = CollectorRouter()
    return router.route_request(filter_criteria)