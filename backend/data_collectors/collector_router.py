"""
Collector Router System - MCP-Native Four-Quadrant Smart Routing

This module implements intelligent routing of data requests across the four-quadrant
architecture: Government API, Government MCP, Commercial API, and Commercial MCP.

MCP-First Philosophy:
1. Protocol Selection: Prefers MCP over traditional API when available
2. Cost Optimization: Routes to free government sources before commercial
3. Quality Prioritization: Balances cost vs data quality and completeness
4. Smart Fallback: Graceful degradation when preferred sources unavailable

Architecture:
- Filter Analysis: Determines request type and specificity
- Four-Quadrant Routing: Government/Commercial × API/MCP selection
- Cost-Aware Selection: Optimizes commercial API usage
- Performance Optimization: Avoids unnecessary API calls
"""

import logging
from typing import Dict, List, Any, Optional, Type, Union
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

# Government MCP collector imports
try:
    from .government.mcp.data_gov_mcp_collector import DataGovMCPCollector
    from .government.mcp.sec_edgar_mcp_collector import SECEdgarMCPCollector
    from .government.mcp.treasury_mcp_collector import TreasuryMCPCollector
    GOVERNMENT_MCP_AVAILABLE = True
except ImportError:
    DataGovMCPCollector = None
    SECEdgarMCPCollector = None
    TreasuryMCPCollector = None
    GOVERNMENT_MCP_AVAILABLE = False

# Commercial collector imports
try:
    from .commercial.base.commercial_collector_interface import CommercialCollectorInterface
    from .commercial.base.mcp_collector_base import MCPCollectorBase
    from .commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector
    from .commercial.mcp.polygon_mcp_collector import PolygonMCPCollector
    from .commercial.mcp.yahoo_finance_mcp_collector import YahooFinanceMCPCollector
    COMMERCIAL_COLLECTORS_AVAILABLE = True
except ImportError:
    CommercialCollectorInterface = None
    MCPCollectorBase = None
    AlphaVantageMCPCollector = None
    PolygonMCPCollector = None
    YahooFinanceMCPCollector = None
    COMMERCIAL_COLLECTORS_AVAILABLE = False

logger = logging.getLogger(__name__)


class DataSourceType(Enum):
    """Data source classification for four-quadrant routing."""
    GOVERNMENT_API = "government_api"
    GOVERNMENT_MCP = "government_mcp"  # Future expansion
    COMMERCIAL_API = "commercial_api"
    COMMERCIAL_MCP = "commercial_mcp"


class CollectorQuadrant(Enum):
    """Four-quadrant collector classification."""
    GOVERNMENT_FREE = "government_free"  # Government APIs (free)
    GOVERNMENT_MCP = "government_mcp"    # Government MCP servers (future)
    COMMERCIAL_API = "commercial_api"    # Commercial REST APIs
    COMMERCIAL_MCP = "commercial_mcp"    # Commercial MCP servers (preferred)


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
    """Defines a collector's capabilities and optimal use cases for four-quadrant routing."""
    collector_class: Type[DataCollectorInterface]
    quadrant: CollectorQuadrant
    primary_use_cases: List[RequestType]
    strengths: List[str]
    limitations: List[str]
    max_companies: Optional[int] = None
    requires_specific_companies: bool = False
    
    # Cost and performance metrics
    cost_per_request: float = 0.0  # USD per request
    monthly_quota: Optional[int] = None
    rate_limit_per_second: Optional[float] = None
    
    # Protocol information
    supports_mcp: bool = False
    mcp_tool_count: Optional[int] = None
    protocol_preference: int = 50  # 0-100, higher = more preferred
    
    # Quality and reliability metrics
    data_freshness: str = "unknown"  # "real_time", "daily", "weekly", "monthly"
    reliability_score: int = 95  # 0-100, based on uptime and consistency
    coverage_score: int = 80  # 0-100, based on data breadth and depth

class CollectorRouter:
    """
    MCP-Native Four-Quadrant Smart Router for financial data collection.
    
    Four-Quadrant Routing Philosophy:
    1. MCP Preference: Prefer MCP protocol over traditional APIs when available
    2. Cost Optimization: Route to free government sources before commercial
    3. Quality Balance: Optimize for data quality vs cost tradeoffs
    4. Smart Fallback: Graceful degradation across quadrants when needed
    
    Quadrant Priority (highest to lowest):
    1. Government Free (SEC, FRED, BEA, etc.) - Cost: $0, Quality: High
    2. Commercial MCP (Alpha Vantage MCP) - Cost: Variable, Quality: Premium
    3. Commercial API (Traditional REST) - Cost: Variable, Quality: Standard
    4. Government MCP (Future) - Cost: $0, Quality: Enhanced
    
    Selection Factors:
    - Request specificity and data requirements
    - User budget constraints and cost limits
    - Data freshness requirements (real-time vs historical)
    - Protocol availability and performance
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
        """Initialize the registry of available collectors with four-quadrant classification."""
        registry = {
            # QUADRANT 1: Government Free APIs (Highest Priority)
            'sec_edgar': CollectorCapability(
                collector_class=SECEdgarCollector,
                quadrant=CollectorQuadrant.GOVERNMENT_FREE,
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
                supports_mcp=False,
                protocol_preference=85,
                data_freshness="daily",
                reliability_score=98,
                coverage_score=95
            ),
            
            'treasury_fiscal': CollectorCapability(
                collector_class=TreasuryFiscalCollector,
                quadrant=CollectorQuadrant.GOVERNMENT_FREE,
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
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=None,
                rate_limit_per_second=5.0,
                supports_mcp=False,
                protocol_preference=90,
                data_freshness="daily",
                reliability_score=96,
                coverage_score=85
            ),
            
            'treasury_direct': CollectorCapability(
                collector_class=TreasuryDirectCollector,
                quadrant=CollectorQuadrant.GOVERNMENT_FREE,
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
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=None,
                rate_limit_per_second=1.0,
                supports_mcp=False,
                protocol_preference=88,
                data_freshness="real_time",
                reliability_score=97,
                coverage_score=82
            ),
            
            'bea': CollectorCapability(
                collector_class=BEACollector,
                quadrant=CollectorQuadrant.GOVERNMENT_FREE,
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
                supports_mcp=False,
                protocol_preference=92,
                data_freshness="monthly",
                reliability_score=99,
                coverage_score=98
            ),
            
            'bls': CollectorCapability(
                collector_class=BLSCollector,
                quadrant=CollectorQuadrant.GOVERNMENT_FREE,
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
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=500,
                rate_limit_per_second=0.1,  # 500 per month ≈ 0.2 per sec
                supports_mcp=False,
                protocol_preference=89,
                data_freshness="monthly",
                reliability_score=99,
                coverage_score=93
            ),
            
            'eia': CollectorCapability(
                collector_class=EIACollector,
                quadrant=CollectorQuadrant.GOVERNMENT_FREE,
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
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=5000,
                rate_limit_per_second=1.0,
                supports_mcp=False,
                protocol_preference=87,
                data_freshness="daily",
                reliability_score=98,
                coverage_score=88
            ),
            
            'fdic': CollectorCapability(
                collector_class=FDICCollector,
                quadrant=CollectorQuadrant.GOVERNMENT_FREE,
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
                requires_specific_companies=False,
                cost_per_request=0.0,
                monthly_quota=None,
                rate_limit_per_second=2.0,
                supports_mcp=False,
                protocol_preference=86,
                data_freshness="monthly",
                reliability_score=97,
                coverage_score=91
            )
        }
        
        # Add government MCP collectors if available
        if GOVERNMENT_MCP_AVAILABLE:
            registry.update(self._get_government_mcp_collector_registry())
        
        # Add commercial collectors if available
        if COMMERCIAL_COLLECTORS_AVAILABLE:
            registry.update(self._get_commercial_collector_registry())
        
        return registry
    
    def _get_government_mcp_collector_registry(self) -> Dict[str, CollectorCapability]:
        """Get government MCP collector registry entries including Data.gov MCP collector."""
        registry = {}
        
        # Add Data.gov MCP collector if available
        if DataGovMCPCollector:
            registry['data_gov_mcp'] = CollectorCapability(
                collector_class=DataGovMCPCollector,
                quadrant=CollectorQuadrant.GOVERNMENT_MCP,
                primary_use_cases=[
                    RequestType.INDIVIDUAL_COMPANY,
                    RequestType.COMPANY_COMPARISON,
                    RequestType.ECONOMIC_DATA,
                    RequestType.FISCAL_DATA
                ],
                strengths=[
                    'SEC XBRL financial statements (15+ years historical data)',
                    'Form 13F institutional holdings tracking',
                    'Treasury yield curve and interest rate analysis',
                    'Federal Reserve economic indicators',
                    'Fund flow analysis (N-PORT mutual fund data)',
                    'MCP protocol optimization for AI consumption',
                    'Free government data with no API keys required',
                    'AI-native tools for financial analysis',
                    'Smart money tracking and institutional sentiment',
                    'Comprehensive macroeconomic context integration'
                ],
                limitations=[
                    'Requires local MCP server setup',
                    'Quarterly data lag (45-90 days for SEC filings)',
                    'US-focused data (limited international coverage)',
                    'No real-time price data',
                    'Complex data parsing requirements'
                ],
                max_companies=50,  # Reasonable limit for MCP processing
                requires_specific_companies=False,  # Can do broad analysis
                cost_per_request=0.0,  # Government data is free
                monthly_quota=None,  # No limits on government data
                rate_limit_per_second=1.0,  # Respectful usage
                supports_mcp=True,  # This IS an MCP collector
                protocol_preference=95,  # High preference for MCP protocol
                data_freshness="quarterly",
                reliability_score=96,  # Government data is very reliable
                coverage_score=88   # Excellent coverage for government data
            )
        
        # Add SEC EDGAR MCP collector if available
        if SECEdgarMCPCollector:
            registry['sec_edgar_mcp'] = CollectorCapability(
                collector_class=SECEdgarMCPCollector,
                quadrant=CollectorQuadrant.GOVERNMENT_MCP,
                primary_use_cases=[
                    RequestType.INDIVIDUAL_COMPANY,
                    RequestType.COMPANY_COMPARISON,
                    RequestType.SEC_FILINGS,
                    RequestType.INSIDER_TRADING
                ],
                strengths=[
                    'Official SEC EDGAR filing data with XBRL precision',
                    'Complete company fundamentals and financial statements',
                    'Real-time insider trading activity (Forms 3/4/5)',
                    'Historical filing analysis (10-K, 10-Q, 8-K)',
                    'MCP protocol optimized for AI-native access',
                    'No authentication required - public data',
                    'Hybrid MCP/REST API fallback architecture',
                    'SEC compliance with 10 req/sec rate limiting',
                    'Exact financial precision from XBRL parsing',
                    'Comprehensive filing metadata and document analysis'
                ],
                limitations=[
                    'Requires valid User-Agent with email contact',
                    'US public companies only (no international)',
                    'No real-time stock prices or market data',
                    'Filing lag (typically 1-4 business days)',
                    'Limited to 1-20 companies for optimal performance'
                ],
                max_companies=20,  # SEC EDGAR MCP optimized for specific analysis
                requires_specific_companies=True,  # Activation follows filtering guidelines
                cost_per_request=0.0,  # SEC data is free
                monthly_quota=None,  # No limits on SEC data
                rate_limit_per_second=10.0,  # SEC guideline compliance
                supports_mcp=True,  # Primary MCP collector
                protocol_preference=100,  # Highest preference for SEC filing requests
                data_freshness="daily",  # Filings updated daily
                reliability_score=98,  # Official SEC data source
                coverage_score=95   # Excellent coverage for SEC filing data
            )
        
        # Add Treasury MCP collector if available
        if TreasuryMCPCollector:
            registry['treasury_mcp'] = CollectorCapability(
                collector_class=TreasuryMCPCollector,
                quadrant=CollectorQuadrant.GOVERNMENT_MCP,
                primary_use_cases=[
                    RequestType.ECONOMIC_DATA,
                    RequestType.FISCAL_DATA,
                    RequestType.MACROECONOMIC_ANALYSIS,
                    RequestType.INTEREST_RATES,
                    RequestType.RECESSION_INDICATORS
                ],
                strengths=[
                    'Economic cycle detection and analysis (NBER-quality)',
                    'Treasury yield curve analysis with recession signals',
                    'Interest rate sensitivity calculations for portfolios',
                    'Rate impact predictions across asset classes',
                    'Federal debt analysis and fiscal health indicators',
                    'AI-optimized MCP tools for macroeconomic analysis',
                    'Official Treasury data sources (no API keys required)',
                    'Professional-grade investment timing intelligence',
                    'Sector rotation guidance based on economic cycles',
                    'Real-time economic phase classification'
                ],
                limitations=[
                    'US-focused macroeconomic data only',
                    'No international economic indicators',
                    'Limited to government economic data sources',
                    'Economic cycle detection requires historical context'
                ],
                max_companies=None,  # Macroeconomic analysis not company-specific
                requires_specific_companies=False,  # Broad economic analysis
                cost_per_request=0.0,  # Government Treasury data is free
                monthly_quota=None,  # No limits on Treasury data
                rate_limit_per_second=1.0,  # Respectful usage of government APIs
                supports_mcp=True,  # Native MCP tool integration
                protocol_preference=90,  # High preference for Treasury analysis
                data_freshness="daily",  # Treasury data updated daily
                reliability_score=97,  # Official Treasury data sources
                coverage_score=85   # Excellent coverage for US macroeconomic data
            )
        
        return registry
        
    def _get_commercial_collector_registry(self) -> Dict[str, CollectorCapability]:
        """Get commercial collector registry entries including Alpha Vantage MCP collector."""
        registry = {}
        
        # Add Alpha Vantage MCP collector if available
        if AlphaVantageMCPCollector:
            registry['alpha_vantage_mcp'] = CollectorCapability(
                collector_class=AlphaVantageMCPCollector,
                quadrant=CollectorQuadrant.COMMERCIAL_MCP,
                primary_use_cases=[
                    RequestType.REAL_TIME_PRICES,
                    RequestType.TECHNICAL_ANALYSIS,
                    RequestType.INTRADAY_DATA,
                    RequestType.INDIVIDUAL_COMPANY,
                    RequestType.COMPANY_COMPARISON,
                    RequestType.FOREX_DATA,
                    RequestType.CRYPTO_DATA,
                    RequestType.MARKET_SENTIMENT,
                    RequestType.NEWS_ANALYSIS,
                    RequestType.EARNINGS_ESTIMATES
                ],
                strengths=[
                    '79 AI-optimized MCP tools for financial analysis',
                    'Real-time and historical market data',
                    'Advanced technical indicators and overlays',
                    'Global market coverage (stocks, forex, crypto)',
                    'MCP protocol optimization for AI consumption',
                    'Comprehensive fundamental data integration',
                    'News sentiment analysis and market intelligence',
                    'Premium earnings and analyst data',
                    'High-frequency intraday data support'
                ],
                limitations=[
                    'Requires paid subscription for full access',
                    'Rate limits based on subscription tier',
                    'Higher cost for premium features',
                    'API key required for authentication'
                ],
                max_companies=None,  # No hard limit
                requires_specific_companies=True,
                cost_per_request=0.01,  # Base rate $0.01 per request
                monthly_quota=25000,    # Premium tier limit
                rate_limit_per_second=5.0,
                supports_mcp=True,
                mcp_tool_count=79,
                protocol_preference=95,  # MCP strongly preferred
                data_freshness="real_time",
                reliability_score=95,
                coverage_score=99
            )
        
        # Add Polygon.io MCP collector if available
        if PolygonMCPCollector:
            registry['polygon_mcp'] = CollectorCapability(
                collector_class=PolygonMCPCollector,
                quadrant=CollectorQuadrant.COMMERCIAL_MCP,
                primary_use_cases=[
                    RequestType.REAL_TIME_PRICES,
                    RequestType.INTRADAY_DATA,
                    RequestType.INDIVIDUAL_COMPANY,
                    RequestType.COMPANY_COMPARISON,
                    RequestType.OPTIONS_DATA,
                    RequestType.FOREX_DATA,
                    RequestType.CRYPTO_DATA,
                    RequestType.MARKET_SENTIMENT,
                    RequestType.NEWS_ANALYSIS
                ],
                strengths=[
                    '40+ MCP tools for institutional-grade financial data',
                    'Real-time stock quotes and historical market data',
                    'Complete options chains and derivatives data',
                    'Forex and cryptocurrency market coverage',
                    'Futures contracts and commodities data',
                    'News integration via Benzinga partnership',
                    'Market status and reference data',
                    'Automatic subscription tier detection',
                    'Direct API fallback for reliability'
                ],
                limitations=[
                    'Free tier limited to 5 requests/minute',
                    'Real-time data requires paid subscription',
                    'Historical data depth varies by tier',
                    'API key required for authentication'
                ],
                max_companies=None,  # No hard limit
                requires_specific_companies=True,
                cost_per_request=0.0,   # Free tier default
                monthly_quota=1000,     # Free tier practical limit
                rate_limit_per_second=0.083,  # 5 requests per minute
                supports_mcp=True,
                mcp_tool_count=40,
                protocol_preference=90,  # MCP preferred
                data_freshness="real_time_paid",  # Real-time for paid tiers
                reliability_score=92,
                coverage_score=95
            )
        
        # Add Yahoo Finance MCP collector if available (FREE tier!)
        if YahooFinanceMCPCollector:
            registry['yahoo_finance_mcp'] = CollectorCapability(
                collector_class=YahooFinanceMCPCollector,
                quadrant=CollectorQuadrant.COMMERCIAL_MCP,
                primary_use_cases=[
                    RequestType.INDIVIDUAL_COMPANY,
                    RequestType.COMPANY_COMPARISON,
                    RequestType.REAL_TIME_PRICES,
                    RequestType.OPTIONS_DATA,
                    RequestType.NEWS_ANALYSIS,
                    RequestType.ANALYST_RATINGS,
                    RequestType.MARKET_SENTIMENT,
                    RequestType.STOCK_SCREENING
                ],
                strengths=[
                    '10 core MCP tools - COMPLETELY FREE',
                    'No API key required - zero authentication',
                    'No rate limits or quotas - unlimited requests',
                    'Comprehensive options chain data with Greeks',
                    'Detailed institutional and insider holder information',
                    'Financial statements (annual and quarterly)',
                    'Analyst recommendations and rating changes',
                    'Dividend and split history',
                    'Real-time news coverage',
                    'Perfect fallback when premium APIs hit quotas'
                ],
                limitations=[
                    'Limited to 10 core tools (vs 79 for Alpha Vantage)',
                    'No advanced technical indicators',
                    'Less granular intraday data',
                    'Limited to major exchanges'
                ],
                max_companies=None,  # No limit
                requires_specific_companies=True,
                cost_per_request=0.0,  # COMPLETELY FREE!
                monthly_quota=None,    # NO QUOTA LIMITS
                rate_limit_per_second=None,  # NO RATE LIMITS
                supports_mcp=True,
                mcp_tool_count=10,
                protocol_preference=100,  # Highest preference - it's FREE!
                data_freshness="real_time",
                reliability_score=90,  # Slightly lower due to local server
                coverage_score=85  # Good coverage for core data
            )
        
        return registry
    
    def route_request(self, filter_criteria: Dict[str, Any]) -> List[DataCollectorInterface]:
        """
        Route a data request to the most appropriate collectors using four-quadrant logic.
        
        Four-Quadrant Priority:
        1. Government Free APIs: Always preferred when applicable (cost = $0)
        2. Commercial MCP: Premium quality when budget allows
        3. Commercial API: Standard quality fallback
        4. Government MCP: Future enhanced free sources
        
        Args:
            filter_criteria: Dictionary containing request parameters
            
        Returns:
            List of instantiated collectors that should handle this request
        """
        logger.info(f"Four-quadrant routing for: {filter_criteria}")
        
        # Step 1: Analyze request type and requirements
        request_analysis = self._analyze_request(filter_criteria)
        
        # Step 2: Apply four-quadrant selection logic
        selected_collectors = self._select_four_quadrant_collectors(filter_criteria, request_analysis)
        
        # Step 3: Instantiate and return collectors
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
        
        quadrant_summary = {}
        for collector in active_collectors:
            collector_name = collector.__class__.__name__
            capability = self._get_capability_for_collector(collector.__class__)
            if capability:
                quadrant = capability.quadrant.value
                if quadrant not in quadrant_summary:
                    quadrant_summary[quadrant] = []
                quadrant_summary[quadrant].append(collector_name)
        
        logger.info(f"Selected {len(active_collectors)} collectors across quadrants: {quadrant_summary}")
        return active_collectors
    
    def _select_four_quadrant_collectors(
        self, 
        filter_criteria: Dict[str, Any], 
        request_analysis: Dict[str, Any]
    ) -> List[CollectorCapability]:
        """
        Select collectors using four-quadrant priority logic.
        
        Priority Order:
        1. Government Free (cost=$0, quality=high)
        2. Commercial MCP (cost=variable, quality=premium, protocol=MCP)
        3. Commercial API (cost=variable, quality=standard, protocol=REST)
        4. Government MCP (future: cost=$0, quality=enhanced, protocol=MCP)
        """
        # Find all capable collectors
        capable_collectors = self._find_capable_collectors(filter_criteria, request_analysis)
        
        if not capable_collectors:
            logger.warning("No capable collectors found for request")
            return []
        
        # Group collectors by quadrant
        quadrant_groups = {
            CollectorQuadrant.GOVERNMENT_FREE: [],
            CollectorQuadrant.COMMERCIAL_MCP: [],
            CollectorQuadrant.COMMERCIAL_API: [],
            CollectorQuadrant.GOVERNMENT_MCP: []
        }
        
        for capability in capable_collectors:
            quadrant_groups[capability.quadrant].append(capability)
        
        # Apply four-quadrant selection logic
        selected_collectors = []
        
        # PRIORITY 1: Government Free APIs (always preferred when applicable)
        government_free = quadrant_groups[CollectorQuadrant.GOVERNMENT_FREE]
        if government_free:
            # Sort by protocol preference and reliability
            government_free.sort(key=lambda c: (c.protocol_preference, c.reliability_score), reverse=True)
            selected_collectors.extend(government_free)
            logger.info(f"Selected {len(government_free)} government free collectors")
            
            # Check if government sources satisfy the request
            if self._government_sources_sufficient(filter_criteria, government_free):
                logger.info("Government sources sufficient, skipping commercial sources")
                return selected_collectors
        
        # PRIORITY 2: Free Commercial MCP (Yahoo Finance - always try first!)
        commercial_mcp = quadrant_groups[CollectorQuadrant.COMMERCIAL_MCP]
        if commercial_mcp and self._requires_commercial_data(filter_criteria):
            # First, try FREE Yahoo Finance MCP
            yahoo_finance = None
            for capability in commercial_mcp:
                if capability.cost_per_request == 0.0 and 'yahoo' in capability.collector_class.__name__.lower():
                    yahoo_finance = capability
                    break
            
            if yahoo_finance:
                selected_collectors.append(yahoo_finance)
                logger.info(f"Selected FREE commercial MCP: Yahoo Finance (cost: $0.00)")
                
                # Check if Yahoo Finance satisfies the request
                if self._yahoo_finance_sufficient(filter_criteria):
                    logger.info("Yahoo Finance sufficient for request")
                    return selected_collectors
        
        # PRIORITY 3: Paid Commercial MCP (if budget allows and data needed)
        if self.budget_limit > 0:
            if commercial_mcp and self._requires_advanced_commercial_data(filter_criteria):
                # Sort by protocol preference and coverage (excluding Yahoo which we already added)
                paid_mcp = [c for c in commercial_mcp if c.cost_per_request > 0]
                paid_mcp.sort(key=lambda c: (c.protocol_preference, c.coverage_score), reverse=True)
                
                # Select based on budget
                for capability in paid_mcp:
                    estimated_cost = self._estimate_monthly_cost(capability, filter_criteria)
                    if estimated_cost <= self.budget_limit:
                        selected_collectors.append(capability)
                        logger.info(f"Selected paid commercial MCP: {capability.collector_class.__name__} (est. ${estimated_cost:.2f}/month)")
                        break
        
        # PRIORITY 3: Commercial API (fallback if MCP not available)
        if not any(c.quadrant == CollectorQuadrant.COMMERCIAL_MCP for c in selected_collectors):
            if self.budget_limit > 0:
                commercial_api = quadrant_groups[CollectorQuadrant.COMMERCIAL_API]
                if commercial_api and self._requires_commercial_data(filter_criteria):
                    # Sort by cost-effectiveness (quality per dollar)
                    commercial_api.sort(key=lambda c: c.coverage_score / max(c.cost_per_request * 100, 1), reverse=True)
                    
                    for capability in commercial_api:
                        estimated_cost = self._estimate_monthly_cost(capability, filter_criteria)
                        if estimated_cost <= self.budget_limit:
                            selected_collectors.append(capability)
                            logger.info(f"Selected commercial API: {capability.collector_class.__name__} (est. ${estimated_cost:.2f}/month)")
                            break
        
        # PRIORITY 4: Government MCP (future - enhanced free sources)
        government_mcp = quadrant_groups[CollectorQuadrant.GOVERNMENT_MCP]
        if government_mcp:
            government_mcp.sort(key=lambda c: (c.protocol_preference, c.coverage_score), reverse=True)
            selected_collectors.extend(government_mcp)
            logger.info(f"Selected {len(government_mcp)} government MCP collectors")
        
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
            
        # Intraday data requires commercial sources
        if any(keyword in str(filter_criteria).lower() for keyword in [
            'intraday', 'minute', 'hourly', 'real-time', 'live'
        ]):
            return False
            
        # Check if request types can be handled by government sources
        government_request_types = set()
        for capability in government_collectors:
            government_request_types.update(capability.primary_use_cases)
        
        # Basic company fundamentals can be handled by SEC
        company_requests = [RequestType.INDIVIDUAL_COMPANY, RequestType.COMPANY_COMPARISON]
        if any(rt in government_request_types for rt in company_requests):
            if filter_criteria.get('companies') or filter_criteria.get('analysis_type') == 'fundamental':
                return True
        
        # Economic data can be fully handled by government sources
        econ_requests = [
            RequestType.ECONOMIC_DATA, RequestType.FISCAL_DATA, 
            RequestType.EMPLOYMENT_DATA, RequestType.ENERGY_DATA,
            RequestType.BANKING_DATA, RequestType.COMMODITY_DATA
        ]
        if any(rt in government_request_types for rt in econ_requests):
            return True
            
        return False
    
    def _yahoo_finance_sufficient(self, filter_criteria: Dict[str, Any]) -> bool:
        """Check if Yahoo Finance can satisfy the request without paid sources."""
        # Yahoo Finance can handle basic stock data, options, and news
        request_type = filter_criteria.get('data_type', '')
        
        # Yahoo Finance is good for these data types
        yahoo_supported = [
            'stock_info', 'historical_prices', 'options', 'news',
            'financial_statements', 'holders', 'recommendations',
            'dividends', 'splits'
        ]
        
        if any(supported in str(request_type).lower() for supported in yahoo_supported):
            # Check if advanced technical indicators are needed (Yahoo doesn't have these)
            if 'technical' in str(filter_criteria).lower():
                indicators = filter_criteria.get('indicators', [])
                # Yahoo only has basic price data, not advanced indicators
                advanced_indicators = ['rsi', 'macd', 'bbands', 'sma', 'ema', 'stoch']
                if any(ind in str(indicators).lower() for ind in advanced_indicators):
                    return False
            return True
        
        return False
    
    def _requires_commercial_data(self, filter_criteria: Dict[str, Any]) -> bool:
        """Check if request requires commercial data sources."""
        # Real-time requirements
        if filter_criteria.get('real_time', False):
            return True
            
        # Technical analysis
        if filter_criteria.get('analysis_type') == 'technical':
            return True
    
    def _requires_advanced_commercial_data(self, filter_criteria: Dict[str, Any]) -> bool:
        """Check if request requires PAID commercial data (beyond Yahoo Finance capabilities)."""
        # Advanced technical indicators
        if 'technical' in str(filter_criteria).lower():
            indicators = filter_criteria.get('indicators', [])
            advanced_indicators = ['rsi', 'macd', 'bbands', 'sma', 'ema', 'stoch', 'adx', 'cci']
            if any(ind in str(indicators).lower() for ind in advanced_indicators):
                return True
        
        # High-frequency intraday data
        if any(keyword in str(filter_criteria).lower() for keyword in ['1m', '5m', '15m', 'tick']):
            return True
        
        # Forex or crypto (Yahoo has limited coverage)
        if filter_criteria.get('market_type') in ['forex', 'crypto']:
            return True
        
        # Advanced market data (Level 2, order book, etc.)
        if any(keyword in str(filter_criteria).lower() for keyword in ['level2', 'order_book', 'depth']):
            return True
        
        return False
            
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
        # Base cost per request
        base_cost = capability.cost_per_request
        
        # Estimate requests per month based on usage pattern
        companies = self._get_specific_companies(filter_criteria)
        company_count = max(len(companies), 1)
        
        # Estimate frequency based on analysis type
        if filter_criteria.get('real_time'):
            daily_requests = company_count * 10  # 10 requests per company per day
        elif filter_criteria.get('analysis_type') == 'technical':
            daily_requests = company_count * 5   # 5 requests per company per day  
        else:
            daily_requests = company_count * 1   # 1 request per company per day
        
        monthly_requests = daily_requests * 30
        monthly_cost = monthly_requests * base_cost
        
        return min(monthly_cost, capability.monthly_quota * base_cost if capability.monthly_quota else monthly_cost)
    
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
                        try:
                            # Handle MCP collectors that need API keys
                            if 'MCP' in capability.collector_class.__name__:
                                collector_instance = capability.collector_class(api_key="test_key_for_routing")
                            else:
                                collector_instance = capability.collector_class(api_key="test_key_for_routing")
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
    
    def _get_capability_for_collector(self, collector_class: Type[DataCollectorInterface]) -> Optional[CollectorCapability]:
        """Get capability info for a collector class."""
        for capability in self.collector_registry.values():
            if capability.collector_class == collector_class:
                return capability
        return None
        
    def _analyze_request(self, filter_criteria: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the request to determine type and requirements."""
        analysis = {
            'request_type': None,
            'specificity_level': 'unknown',
            'data_requirements': [],
            'performance_considerations': {},
            'commercial_data_needed': False
        }
        
        # Determine request type based on filters
        companies = self._get_specific_companies(filter_criteria)
        
        # Check for commercial-only data requirements
        analysis['commercial_data_needed'] = self._requires_commercial_data(filter_criteria)
        
        # PRIORITY 1: Commercial-specific data types override company analysis
        if filter_criteria.get('real_time') or 'intraday' in str(filter_criteria).lower():
            analysis['request_type'] = RequestType.REAL_TIME_PRICES
            analysis['specificity_level'] = 'high'
            analysis['commercial_data_needed'] = True
        elif any(key in filter_criteria for key in ['options', 'derivatives', 'options_chain', 'options_data']):
            analysis['request_type'] = RequestType.OPTIONS_DATA
            analysis['specificity_level'] = 'high'
            analysis['commercial_data_needed'] = True
        elif any(key in filter_criteria for key in ['forex', 'currency', 'fx']):
            analysis['request_type'] = RequestType.FOREX_DATA
            analysis['specificity_level'] = 'high'
            analysis['commercial_data_needed'] = True
        elif any(key in filter_criteria for key in ['crypto', 'bitcoin', 'ethereum', 'cryptocurrency']):
            analysis['request_type'] = RequestType.CRYPTO_DATA
            analysis['specificity_level'] = 'high'
            analysis['commercial_data_needed'] = True
        elif filter_criteria.get('analysis_type') == 'technical':
            analysis['request_type'] = RequestType.TECHNICAL_ANALYSIS
            analysis['specificity_level'] = 'high'
            analysis['commercial_data_needed'] = True
        elif filter_criteria.get('include_sentiment', False) or any(
            key in filter_criteria for key in ['news_analysis', 'sentiment', 'benzinga']
        ):
            analysis['request_type'] = RequestType.NEWS_ANALYSIS
            analysis['specificity_level'] = 'high'
            analysis['commercial_data_needed'] = True
        # PRIORITY 2: Company-specific analysis for fundamental data
        elif len(companies) == 1:
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
        elif any(key in filter_criteria for key in ['forex', 'currency', 'fx']):
            analysis['request_type'] = RequestType.FOREX_DATA
            analysis['specificity_level'] = 'high'
            analysis['commercial_data_needed'] = True
        elif any(key in filter_criteria for key in ['crypto', 'bitcoin', 'ethereum', 'cryptocurrency']):
            analysis['request_type'] = RequestType.CRYPTO_DATA
            analysis['specificity_level'] = 'high'
            analysis['commercial_data_needed'] = True
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
            analysis['commercial_data_needed'] = True
        
        # Performance considerations
        analysis['performance_considerations'] = {
            'company_count': len(companies),
            'time_sensitivity': filter_criteria.get('real_time', False),
            'data_depth': filter_criteria.get('analysis_depth', 'standard')
        }
        
        logger.debug(f"Request analysis: {analysis}")
        return analysis
    
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
    
    def get_quadrant_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get summary of collectors by quadrant."""
        quadrant_summary = {}
        
        for quadrant in CollectorQuadrant:
            collectors = [
                (name, capability) for name, capability in self.collector_registry.items()
                if capability.quadrant == quadrant
            ]
            
            if collectors:
                quadrant_summary[quadrant.value] = {
                    'count': len(collectors),
                    'collectors': [name for name, _ in collectors],
                    'total_tools': sum(
                        capability.mcp_tool_count or 0 
                        for _, capability in collectors
                    ),
                    'avg_cost_per_request': sum(
                        capability.cost_per_request 
                        for _, capability in collectors
                    ) / len(collectors),
                    'avg_reliability': sum(
                        capability.reliability_score 
                        for _, capability in collectors
                    ) / len(collectors)
                }
        
        return quadrant_summary
    
    def get_collector_info(self) -> Dict[str, Dict[str, Any]]:
        """Get information about all registered collectors with quadrant details."""
        info = {}
        
        for collector_name, capability in self.collector_registry.items():
            info[collector_name] = {
                'class_name': capability.collector_class.__name__,
                'quadrant': capability.quadrant.value,
                'primary_use_cases': [uc.value for uc in capability.primary_use_cases],
                'strengths': capability.strengths,
                'limitations': capability.limitations,
                'max_companies': capability.max_companies,
                'requires_specific_companies': capability.requires_specific_companies,
                'cost_per_request': capability.cost_per_request,
                'monthly_quota': capability.monthly_quota,
                'rate_limit_per_second': capability.rate_limit_per_second,
                'supports_mcp': capability.supports_mcp,
                'mcp_tool_count': capability.mcp_tool_count,
                'protocol_preference': capability.protocol_preference,
                'data_freshness': capability.data_freshness,
                'reliability_score': capability.reliability_score,
                'coverage_score': capability.coverage_score
            }
        
        return info
    
    def validate_request(self, filter_criteria: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a request and provide guidance on optimal filtering with quadrant insights.
        
        Returns:
            Dictionary with validation results and four-quadrant recommendations
        """
        validation = {
            'is_valid': True,
            'warnings': [],
            'recommendations': [],
            'expected_collectors': [],
            'quadrant_analysis': {},
            'cost_estimate': 0.0
        }
        
        # Get expected routing
        try:
            collectors = self.route_request(filter_criteria)
            validation['expected_collectors'] = [c.__class__.__name__ for c in collectors]
            
            # Analyze by quadrant
            quadrant_counts = {}
            total_cost = 0.0
            
            for collector in collectors:
                capability = self._get_capability_for_collector(collector.__class__)
                if capability:
                    quadrant = capability.quadrant.value
                    quadrant_counts[quadrant] = quadrant_counts.get(quadrant, 0) + 1
                    total_cost += self._estimate_monthly_cost(capability, filter_criteria)
            
            validation['quadrant_analysis'] = quadrant_counts
            validation['cost_estimate'] = total_cost
            
        except Exception as e:
            validation['is_valid'] = False
            validation['warnings'].append(f"Routing failed: {e}")
        
        # Four-quadrant specific recommendations
        if validation['cost_estimate'] > self.budget_limit > 0:
            validation['warnings'].append(f"Estimated cost ${validation['cost_estimate']:.2f} exceeds budget ${self.budget_limit:.2f}")
            validation['recommendations'].append("Consider increasing budget or using only government sources")
        
        # Check for optimal quadrant usage
        if 'government_free' not in validation['quadrant_analysis'] and not self._requires_commercial_data(filter_criteria):
            validation['recommendations'].append("Consider using free government sources for cost optimization")
        
        return validation


# Convenience function for easy integration
def route_data_request(filter_criteria: Dict[str, Any], budget_limit: float = 0.0) -> List[DataCollectorInterface]:
    """
    Convenience function to route a data request with four-quadrant logic.
    
    Args:
        filter_criteria: Dictionary containing request parameters
        budget_limit: Monthly budget limit for commercial APIs (USD)
        
    Returns:
        List of instantiated collectors to handle the request
        
    Example:
        # Route with budget for commercial sources
        collectors = route_data_request({
            'companies': ['AAPL', 'MSFT'],
            'real_time': True
        }, budget_limit=50.0)
        
        # Route using only free government sources  
        collectors = route_data_request({
            'companies': ['AAPL'],
            'analysis_type': 'fundamental'
        })
    """
    router = CollectorRouter(budget_limit=budget_limit)
    return router.route_request(filter_criteria)