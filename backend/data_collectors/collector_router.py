"""
Collector Router System - Direct API Smart Routing

This module implements intelligent routing of data requests across financial data sources
using direct API integrations for optimal cost and performance.

Cost-First Philosophy:
1. Cost Optimization: Routes to free government sources before commercial APIs
2. Quality Prioritization: Balances cost vs data quality and completeness
3. Smart Fallback: Graceful degradation when preferred sources unavailable
4. Direct Integration: Uses reliable REST API connections

Architecture:
- Filter Analysis: Determines request type and specificity
- Two-Tier Routing: Government (free) vs Commercial (paid) API selection
- Cost-Aware Selection: Optimizes commercial API usage
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

logger = logging.getLogger(__name__)


class DataSourceType(Enum):
    """Data source classification for two-tier routing."""
    GOVERNMENT_API = "government_api"
    COMMERCIAL_API = "commercial_api"


class CollectorTier(Enum):
    """Two-tier collector classification."""
    GOVERNMENT_FREE = "government_free"  # Government APIs (free)
    COMMERCIAL_API = "commercial_api"    # Commercial REST APIs


class RequestType(Enum):
    """Types of data requests that can be made."""
    # Core company analysis
    INDIVIDUAL_COMPANY = "individual_company"
    COMPANY_COMPARISON = "company_comparison"
    SECTOR_ANALYSIS = "sector_analysis"
    INDEX_ANALYSIS = "index_analysis"

    # Government data (free sources)
    ECONOMIC_DATA = "economic_data"
    FISCAL_DATA = "fiscal_data"
    EMPLOYMENT_DATA = "employment_data"
    INFLATION_DATA = "inflation_data"
    ENERGY_DATA = "energy_data"
    COMMODITY_DATA = "commodity_data"
    BANKING_DATA = "banking_data"
    SEC_FILINGS = "sec_filings"
    INSIDER_TRADING = "insider_trading"
    MACROECONOMIC_ANALYSIS = "macroeconomic_analysis"
    INTEREST_RATES = "interest_rates"
    RECESSION_INDICATORS = "recession_indicators"

    # Commercial data (paid sources)
    REAL_TIME_PRICES = "real_time_prices"
    INTRADAY_DATA = "intraday_data"
    TECHNICAL_ANALYSIS = "technical_analysis"
    MARKET_SENTIMENT = "market_sentiment"
    NEWS_ANALYSIS = "news_analysis"
    EARNINGS_ESTIMATES = "earnings_estimates"
    ANALYST_RATINGS = "analyst_ratings"
    OPTIONS_DATA = "options_data"
    FOREX_DATA = "forex_data"
    CRYPTO_DATA = "crypto_data"

    # Screening and discovery
    MARKET_SCREENING = "market_screening"
    STOCK_SCREENING = "stock_screening"


@dataclass
class CollectorCapability:
    """Defines a collector's capabilities and optimal use cases for two-tier routing."""
    collector_class: Type[DataCollectorInterface]
    tier: CollectorTier
    primary_use_cases: List[RequestType]
    strengths: List[str]
    limitations: List[str]
    max_companies: Optional[int] = None
    requires_specific_companies: bool = False

    # Cost and performance metrics
    cost_per_request: float = 0.0  # USD per request
    monthly_quota: Optional[int] = None
    rate_limit_per_second: Optional[float] = None

    # Quality and reliability metrics
    data_freshness: str = "unknown"  # "real_time", "daily", "weekly", "monthly"
    reliability_score: int = 95  # 0-100, based on uptime and consistency
    coverage_score: int = 80  # 0-100, based on data breadth and depth


class CollectorRouter:
    """
    Direct API Two-Tier Smart Router for financial data collection.

    Two-Tier Routing Philosophy:
    1. Cost Optimization: Route to free government sources before commercial APIs
    2. Quality Balance: Optimize for data quality vs cost tradeoffs
    3. Smart Fallback: Graceful degradation when preferred sources unavailable
    4. Direct Integration: Use reliable REST API connections

    Tier Priority (highest to lowest):
    1. Government Free (SEC, FRED, BEA, etc.) - Cost: $0, Quality: High
    2. Commercial API (Traditional REST) - Cost: Variable, Quality: Standard

    Selection Factors:
    - Request specificity and data requirements
    - User budget constraints and cost limits
    - Data freshness requirements (real-time vs historical)
    - API availability and performance
    """

    def __init__(self, budget_limit: float = 0.0):
        """
        Initialize the router.

        Args:
            budget_limit: Monthly budget limit for commercial APIs (USD)
        """
        self.budget_limit = budget_limit
        self.collector_registry = self._initialize_collector_registry()

    def _initialize_collector_registry(self) -> Dict[str, CollectorCapability]:
        """Initialize the registry of available collectors with two-tier classification."""
        registry = {
            # TIER 1: Government Free APIs (Highest Priority)
            'sec_edgar': CollectorCapability(
                collector_class=SECEdgarCollector,
                tier=CollectorTier.GOVERNMENT_FREE,
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
                requires_specific_companies=True,
                cost_per_request=0.0,
                monthly_quota=None,
                rate_limit_per_second=10.0,
                data_freshness="daily",
                reliability_score=98,
                coverage_score=95
            ),

            'treasury_fiscal': CollectorCapability(
                collector_class=TreasuryFiscalCollector,
                tier=CollectorTier.GOVERNMENT_FREE,
                primary_use_cases=[
                    RequestType.FISCAL_DATA,
                    RequestType.ECONOMIC_DATA
                ],
                strengths=[
                    'Real federal debt data',
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
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=None,
                rate_limit_per_second=5.0,
                data_freshness="daily",
                reliability_score=96,
                coverage_score=85
            ),

            'bea': CollectorCapability(
                collector_class=BEACollector,
                tier=CollectorTier.GOVERNMENT_FREE,
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
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=1000,
                rate_limit_per_second=2.0,
                data_freshness="monthly",
                reliability_score=99,
                coverage_score=98
            ),

            'bls': CollectorCapability(
                collector_class=BLSCollector,
                tier=CollectorTier.GOVERNMENT_FREE,
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
                    'Free access with optional API key for higher limits'
                ],
                limitations=[
                    'No company-specific data',
                    'Limited to US labor market data',
                    'Rate limited (25 req/day without API key, 500 with)',
                    'Monthly data frequency (not real-time)',
                    'No financial market or stock data'
                ],
                max_companies=None,
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=500,
                rate_limit_per_second=0.1,
                data_freshness="monthly",
                reliability_score=99,
                coverage_score=93
            ),

            'eia': CollectorCapability(
                collector_class=EIACollector,
                tier=CollectorTier.GOVERNMENT_FREE,
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
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=5000,
                rate_limit_per_second=1.0,
                data_freshness="daily",
                reliability_score=98,
                coverage_score=88
            ),

            'fdic': CollectorCapability(
                collector_class=FDICCollector,
                tier=CollectorTier.GOVERNMENT_FREE,
                primary_use_cases=[
                    RequestType.BANKING_DATA,
                    RequestType.SECTOR_ANALYSIS
                ],
                strengths=[
                    'Comprehensive banking institution data (4,000+ US banks)',
                    'Bank health scoring and risk assessment',
                    'Regulatory status and compliance information',
                    'Geographic banking market analysis',
                    'Systematic risk assessment for banking sector',
                    'Free access with no API keys required'
                ],
                limitations=[
                    'Banking sector only (no other companies)',
                    'Quarterly data frequency (not real-time)',
                    'No market price data for bank stocks',
                    'US banking institutions only',
                    'Limited international banking data'
                ],
                max_companies=None,
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=None,
                rate_limit_per_second=2.0,
                data_freshness="monthly",
                reliability_score=97,
                coverage_score=91
            )
        }

        return registry

    def route_request(self, filter_criteria: Dict[str, Any]) -> List[DataCollectorInterface]:
        """
        Route a data request to the most appropriate collectors using two-tier logic.

        Tier Priority:
        1. Government Free APIs: Always preferred when applicable (cost = $0)
        2. Commercial API: Standard quality when budget allows

        Args:
            filter_criteria: Dictionary containing request parameters

        Returns:
            List of instantiated collectors that should handle this request
        """
        logger.info(f"Two-tier routing for: {filter_criteria}")

        # Step 1: Analyze request type and requirements
        request_analysis = self._analyze_request(filter_criteria)

        # Step 2: Apply two-tier selection logic
        selected_collectors = self._select_two_tier_collectors(filter_criteria, request_analysis)

        # Step 3: Instantiate and return collectors
        active_collectors = []
        for capability in selected_collectors:
            try:
                collector = capability.collector_class()
                active_collectors.append(collector)
            except Exception as e:
                logger.warning(f"Failed to instantiate {capability.collector_class.__name__}: {e}")

        logger.info(f"Selected {len(active_collectors)} collectors")
        return active_collectors

    def _select_two_tier_collectors(
        self,
        filter_criteria: Dict[str, Any],
        request_analysis: Dict[str, Any]
    ) -> List[CollectorCapability]:
        """
        Select collectors using two-tier priority logic.

        Priority Order:
        1. Government Free (cost=$0, quality=high)
        2. Commercial API (cost=variable, quality=standard)
        """
        # Find all capable collectors
        capable_collectors = self._find_capable_collectors(filter_criteria, request_analysis)

        if not capable_collectors:
            logger.warning("No capable collectors found for request")
            return []

        # Group collectors by tier
        tier_groups = {
            CollectorTier.GOVERNMENT_FREE: [],
            CollectorTier.COMMERCIAL_API: []
        }

        for capability in capable_collectors:
            tier_groups[capability.tier].append(capability)

        # Apply two-tier selection logic
        selected_collectors = []

        # PRIORITY 1: Government Free APIs (always preferred when applicable)
        government_free = tier_groups[CollectorTier.GOVERNMENT_FREE]
        if government_free:
            government_free.sort(key=lambda c: c.reliability_score, reverse=True)
            selected_collectors.extend(government_free)
            logger.info(f"Selected {len(government_free)} government free collectors")

            # Check if government sources satisfy the request
            if self._government_sources_sufficient(filter_criteria, government_free):
                logger.info("Government sources sufficient, skipping commercial sources")
                return selected_collectors

        # PRIORITY 2: Commercial API (if budget allows and data needed)
        if self.budget_limit > 0 and self._requires_commercial_data(filter_criteria):
            commercial_api = tier_groups[CollectorTier.COMMERCIAL_API]
            if commercial_api:
                # Sort by cost-effectiveness (quality per dollar)
                commercial_api.sort(key=lambda c: c.coverage_score / max(c.cost_per_request * 100, 1), reverse=True)

                for capability in commercial_api:
                    estimated_cost = self._estimate_monthly_cost(capability, filter_criteria)
                    if estimated_cost <= self.budget_limit:
                        selected_collectors.append(capability)
                        logger.info(f"Selected commercial API: {capability.collector_class.__name__} (est. ${estimated_cost:.2f}/month)")
                        break

        return selected_collectors

    def _government_sources_sufficient(
        self,
        filter_criteria: Dict[str, Any],
        government_collectors: List[CollectorCapability]
    ) -> bool:
        """Check if government sources can satisfy the request without commercial data."""
        # Real-time data requirements need commercial sources
        if filter_criteria.get('real_time', False):
            return False

        # Technical analysis requires commercial sources
        if filter_criteria.get('analysis_type') == 'technical':
            return False

        # Basic company fundamentals can be handled by SEC
        if filter_criteria.get('companies') or filter_criteria.get('analysis_type') == 'fundamental':
            return True

        # Economic data can be fully handled by government sources
        return True

    def _requires_commercial_data(self, filter_criteria: Dict[str, Any]) -> bool:
        """Check if request requires commercial data sources."""
        # Real-time requirements
        if filter_criteria.get('real_time', False):
            return True

        # Technical analysis
        if filter_criteria.get('analysis_type') == 'technical':
            return True

        # Specific commercial data types
        commercial_keywords = [
            'intraday', 'minute', 'sentiment', 'news', 'analyst',
            'earnings_estimate', 'options', 'forex', 'crypto'
        ]

        filter_str = str(filter_criteria).lower()
        return any(keyword in filter_str for keyword in commercial_keywords)

    def _estimate_monthly_cost(
        self,
        capability: CollectorCapability,
        filter_criteria: Dict[str, Any]
    ) -> float:
        """Estimate monthly cost for using a commercial collector."""
        base_cost = capability.cost_per_request

        # Estimate requests per month based on usage pattern
        companies = self._get_specific_companies(filter_criteria)
        company_count = max(len(companies), 1)

        # Estimate frequency based on analysis type
        if filter_criteria.get('real_time'):
            daily_requests = company_count * 10
        elif filter_criteria.get('analysis_type') == 'technical':
            daily_requests = company_count * 5
        else:
            daily_requests = company_count * 1

        monthly_requests = daily_requests * 30
        monthly_cost = monthly_requests * base_cost

        return min(monthly_cost, capability.monthly_quota * base_cost if capability.monthly_quota else monthly_cost)

    def _find_capable_collectors(self, filter_criteria: Dict[str, Any],
                               request_analysis: Dict[str, Any]) -> List[CollectorCapability]:
        """Find collectors capable of handling this request."""
        capable_collectors = []

        for collector_name, capability in self.collector_registry.items():
            if request_analysis['request_type'] in capability.primary_use_cases:
                try:
                    collector_instance = capability.collector_class()
                except Exception:
                    try:
                        collector_instance = capability.collector_class(config=None)
                    except Exception:
                        logger.warning(f"Cannot instantiate {capability.collector_class.__name__}")
                        continue

                if hasattr(collector_instance, 'should_activate'):
                    if collector_instance.should_activate(filter_criteria):
                        capable_collectors.append(capability)
                else:
                    capable_collectors.append(capability)

        return capable_collectors

    def _analyze_request(self, filter_criteria: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the request to determine type and requirements."""
        analysis = {
            'request_type': None,
            'specificity_level': 'unknown',
            'data_requirements': [],
            'commercial_data_needed': False
        }

        # Determine request type based on filters
        companies = self._get_specific_companies(filter_criteria)
        analysis['commercial_data_needed'] = self._requires_commercial_data(filter_criteria)

        # Determine request type
        if filter_criteria.get('real_time') or 'intraday' in str(filter_criteria).lower():
            analysis['request_type'] = RequestType.REAL_TIME_PRICES
        elif len(companies) == 1:
            analysis['request_type'] = RequestType.INDIVIDUAL_COMPANY
        elif 2 <= len(companies) <= 20:
            analysis['request_type'] = RequestType.COMPANY_COMPARISON
        elif filter_criteria.get('sector'):
            analysis['request_type'] = RequestType.SECTOR_ANALYSIS
        else:
            analysis['request_type'] = RequestType.ECONOMIC_DATA

        return analysis

    def _get_specific_companies(self, filter_criteria: Dict[str, Any]) -> List[str]:
        """Extract all specific company identifiers from filter criteria."""
        companies = []

        for field in ['companies', 'symbols', 'tickers', 'ciks']:
            values = filter_criteria.get(field, [])
            if isinstance(values, list):
                companies.extend(values)
            elif values:
                companies.append(values)

        return list(set(companies))


# Convenience function for easy integration
def route_data_request(filter_criteria: Dict[str, Any], budget_limit: float = 0.0) -> List[DataCollectorInterface]:
    """
    Convenience function to route a data request with two-tier logic.

    Args:
        filter_criteria: Dictionary containing request parameters
        budget_limit: Monthly budget limit for commercial APIs (USD)

    Returns:
        List of instantiated collectors to handle the request
    """
    router = CollectorRouter(budget_limit=budget_limit)
    return router.route_request(filter_criteria)