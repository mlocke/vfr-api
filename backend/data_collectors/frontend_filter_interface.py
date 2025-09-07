"""
Frontend Filter Interface

Unified interface for translating frontend filter requests to collector-specific formats
and providing filter option discovery for dynamic frontend components.

This module bridges the gap between frontend filter selections and backend collector
capabilities, ensuring optimal routing and comprehensive filtering support.

Features:
- Filter translation from frontend format to collector format
- Available filter option discovery for frontend dropdowns/selectors
- Filter combination validation and suggestion
- Error handling for invalid filter combinations
- Performance optimization through filter result caching
"""

from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, date, timedelta
import logging

from .collector_router import CollectorRouter, RequestType
from .base import DataCollectorInterface

logger = logging.getLogger(__name__)


class FilterType(Enum):
    """Types of filters available for frontend use."""
    COMPANIES = "companies"
    ECONOMIC_SECTORS = "economic_sectors"
    GEOGRAPHIC = "geographic"
    ECONOMIC_INDICATORS = "economic_indicators"
    TREASURY_SECURITIES = "treasury_securities"
    ENERGY_DATA = "energy_data"
    COMMODITY_DATA = "commodity_data"
    TIME_PERIOD = "time_period"
    ANALYSIS_TYPE = "analysis_type"
    FINANCIAL_METRICS = "financial_metrics"


@dataclass
class FilterOption:
    """Represents a single filter option available to the frontend."""
    value: str
    label: str
    description: str
    category: FilterType
    applicable_collectors: List[str] = field(default_factory=list)
    requires_additional_params: bool = False
    example_usage: Optional[str] = None


@dataclass 
class FilterValidationResult:
    """Result of filter combination validation."""
    is_valid: bool
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    expected_collectors: List[str] = field(default_factory=list)
    estimated_performance: str = "unknown"  # fast, medium, slow
    data_availability: str = "unknown"      # high, medium, low


class FrontendFilterInterface:
    """
    Unified interface for frontend filtering capabilities.
    
    Provides translation between frontend filter format and collector-specific
    formats while offering filter discovery and validation services.
    """
    
    def __init__(self):
        self.router = CollectorRouter()
        self._filter_cache: Dict[str, Any] = {}
        
        # Initialize available filter options
        self._available_filters = self._initialize_available_filters()
        
    def _initialize_available_filters(self) -> Dict[FilterType, List[FilterOption]]:
        """Initialize all available filter options from collectors."""
        filters = {filter_type: [] for filter_type in FilterType}
        
        # Company filters (SEC EDGAR)
        filters[FilterType.COMPANIES].extend([
            FilterOption(
                value="AAPL,MSFT,GOOGL",
                label="Tech Giants (FAANG)",
                description="Apple, Microsoft, Google for technology sector analysis",
                category=FilterType.COMPANIES,
                applicable_collectors=["sec_edgar"],
                example_usage="Individual company analysis or small group comparison"
            ),
            FilterOption(
                value="JPM,BAC,WMT",
                label="Financial & Retail Leaders", 
                description="JPMorgan, Bank of America, Walmart for diversified analysis",
                category=FilterType.COMPANIES,
                applicable_collectors=["sec_edgar"],
                example_usage="Cross-sector fundamental analysis"
            )
        ])
        
        # Economic sector filters (BEA + SEC EDGAR)
        filters[FilterType.ECONOMIC_SECTORS].extend([
            FilterOption(
                value="3571,3572,7372",
                label="Technology Sector",
                description="Computer hardware, software, and IT services (SIC codes)",
                category=FilterType.ECONOMIC_SECTORS,
                applicable_collectors=["sec_edgar", "bea"],
                example_usage="Technology sector screening and economic impact analysis"
            ),
            FilterOption(
                value="6021,6022,6029",
                label="Banking & Finance",
                description="Commercial banks and financial institutions",
                category=FilterType.ECONOMIC_SECTORS,
                applicable_collectors=["sec_edgar", "bea"],
                example_usage="Financial sector health and performance analysis"
            ),
            FilterOption(
                value="2834,3841,8731",
                label="Healthcare & Pharmaceuticals",
                description="Drug manufacturing, medical devices, research services",
                category=FilterType.ECONOMIC_SECTORS,
                applicable_collectors=["sec_edgar", "bea"],
                example_usage="Healthcare industry analysis and drug development tracking"
            )
        ])
        
        # Geographic filters (BEA + FRED)
        filters[FilterType.GEOGRAPHIC].extend([
            FilterOption(
                value="CA,NY,TX,FL",
                label="Major Economic States",
                description="California, New York, Texas, Florida economic data",
                category=FilterType.GEOGRAPHIC,
                applicable_collectors=["bea", "fred"],
                example_usage="State-level economic performance comparison"
            ),
            FilterOption(
                value="northeast,southeast,midwest,west",
                label="US Economic Regions",
                description="Regional economic analysis by geographic area",
                category=FilterType.GEOGRAPHIC,
                applicable_collectors=["bea", "fred"],
                example_usage="Regional economic trend analysis"
            ),
            FilterOption(
                value="31080,35620,16980,19100",
                label="Major Metro Areas", 
                description="Los Angeles, New York, Chicago, Dallas metro economic data",
                category=FilterType.GEOGRAPHIC,
                applicable_collectors=["bea"],
                example_usage="Metropolitan area economic performance analysis"
            )
        ])
        
        # Economic indicators (FRED + BEA)
        filters[FilterType.ECONOMIC_INDICATORS].extend([
            FilterOption(
                value="GDP,GDPC1,GDPPOT",
                label="GDP Indicators",
                description="Gross Domestic Product metrics and potential GDP",
                category=FilterType.ECONOMIC_INDICATORS,
                applicable_collectors=["fred", "bea"],
                example_usage="Economic growth and output analysis"
            ),
            FilterOption(
                value="UNRATE,CIVPART,PAYEMS",
                label="Employment Indicators",
                description="Unemployment rate, labor participation, payroll employment",
                category=FilterType.ECONOMIC_INDICATORS,
                applicable_collectors=["fred"],
                example_usage="Labor market health and employment trend analysis"
            ),
            FilterOption(
                value="CPIAUCSL,CPILFESL,PCEPI",
                label="Inflation Indicators",
                description="Consumer price index, core CPI, PCE price index",
                category=FilterType.ECONOMIC_INDICATORS,
                applicable_collectors=["fred"],
                example_usage="Inflation tracking and monetary policy analysis"
            ),
            FilterOption(
                value="FEDFUNDS,DGS10,DGS30",
                label="Interest Rate Indicators",
                description="Federal funds rate, 10-year and 30-year Treasury rates",
                category=FilterType.ECONOMIC_INDICATORS,
                applicable_collectors=["fred"],
                example_usage="Monetary policy and yield curve analysis"
            )
        ])
        
        # Treasury securities (Treasury Direct + Treasury Fiscal)
        filters[FilterType.TREASURY_SECURITIES].extend([
            FilterOption(
                value="bills,notes,bonds",
                label="Treasury Securities Types",
                description="Treasury Bills, Notes, and Bonds analysis",
                category=FilterType.TREASURY_SECURITIES,
                applicable_collectors=["treasury_direct"],
                example_usage="Treasury securities performance and auction analysis"
            ),
            FilterOption(
                value="1 Yr,5 Yr,10 Yr,30 Yr",
                label="Key Treasury Maturities",
                description="Benchmark Treasury yield curve maturities",
                category=FilterType.TREASURY_SECURITIES,
                applicable_collectors=["treasury_direct"],
                example_usage="Yield curve analysis and interest rate trends"
            ),
            FilterOption(
                value="tips,frns",
                label="Inflation-Protected Securities",
                description="Treasury Inflation-Protected Securities and Floating Rate Notes",
                category=FilterType.TREASURY_SECURITIES,
                applicable_collectors=["treasury_direct"],
                example_usage="Inflation hedging and variable rate analysis"
            )
        ])
        
        # Energy data filters (EIA collector)
        filters[FilterType.ENERGY_DATA].extend([
            FilterOption(
                value="petroleum,natural_gas,electricity",
                label="Primary Energy Sources",
                description="Oil, natural gas, and electricity market analysis",
                category=FilterType.ENERGY_DATA,
                applicable_collectors=["eia"],
                example_usage="Comprehensive energy sector performance analysis"
            ),
            FilterOption(
                value="wti_crude,henry_hub,retail_electricity",
                label="Key Energy Prices",
                description="WTI crude oil, Henry Hub natural gas, and retail electricity prices",
                category=FilterType.ENERGY_DATA,
                applicable_collectors=["eia"],
                example_usage="Energy price trend analysis and forecasting"
            ),
            FilterOption(
                value="production,consumption,capacity",
                label="Energy Supply & Demand",
                description="Energy production, consumption, and capacity metrics",
                category=FilterType.ENERGY_DATA,
                applicable_collectors=["eia"],
                example_usage="Energy supply-demand balance and capacity utilization"
            ),
            FilterOption(
                value="renewable,coal,nuclear",
                label="Energy Sources Mix",
                description="Renewable energy, coal, and nuclear generation data",
                category=FilterType.ENERGY_DATA,
                applicable_collectors=["eia"],
                example_usage="Energy transition and fuel mix analysis"
            )
        ])
        
        # Commodity data filters (EIA collector)
        filters[FilterType.COMMODITY_DATA].extend([
            FilterOption(
                value="crude_oil,gasoline,diesel,heating_oil",
                label="Petroleum Products",
                description="Crude oil and refined petroleum product prices and inventories",
                category=FilterType.COMMODITY_DATA,
                applicable_collectors=["eia"],
                example_usage="Petroleum market analysis and refining margin tracking"
            ),
            FilterOption(
                value="natural_gas,lng,pipeline",
                label="Natural Gas Markets",
                description="Natural gas spot prices, LNG exports, and pipeline flows",
                category=FilterType.COMMODITY_DATA,
                applicable_collectors=["eia"],
                example_usage="Natural gas supply chain and export market analysis"
            ),
            FilterOption(
                value="coal,nuclear_fuel,renewable_materials",
                label="Alternative Energy Commodities",
                description="Coal, uranium, and renewable energy materials",
                category=FilterType.COMMODITY_DATA,
                applicable_collectors=["eia"],
                example_usage="Alternative fuel commodity markets and pricing"
            )
        ])
        
        # Time period filters (All collectors)
        filters[FilterType.TIME_PERIOD].extend([
            FilterOption(
                value="1y",
                label="Last 12 Months",
                description="Recent annual data for trend analysis",
                category=FilterType.TIME_PERIOD,
                applicable_collectors=["all"],
                example_usage="Recent performance and current trends"
            ),
            FilterOption(
                value="5y",
                label="5-Year Analysis",
                description="Medium-term trend analysis and cyclical patterns",
                category=FilterType.TIME_PERIOD,
                applicable_collectors=["all"],
                example_usage="Business cycle analysis and medium-term trends"
            ),
            FilterOption(
                value="10y",
                label="Decade Analysis",
                description="Long-term trend analysis and structural changes",
                category=FilterType.TIME_PERIOD,
                applicable_collectors=["all"],
                example_usage="Long-term structural analysis and major trend identification"
            )
        ])
        
        # Analysis type filters (All collectors)
        filters[FilterType.ANALYSIS_TYPE].extend([
            FilterOption(
                value="fundamental",
                label="Fundamental Analysis",
                description="Financial statement analysis, ratios, and company fundamentals",
                category=FilterType.ANALYSIS_TYPE,
                applicable_collectors=["sec_edgar"],
                example_usage="Company valuation and financial health assessment"
            ),
            FilterOption(
                value="economic",
                label="Economic Analysis",
                description="Macroeconomic indicators and economic trend analysis",
                category=FilterType.ANALYSIS_TYPE,
                applicable_collectors=["bea", "fred", "treasury_fiscal"],
                example_usage="Economic trend analysis and policy impact assessment"
            ),
            FilterOption(
                value="fiscal",
                label="Fiscal Analysis",
                description="Government fiscal policy, debt, and spending analysis",
                category=FilterType.ANALYSIS_TYPE,
                applicable_collectors=["treasury_fiscal", "treasury_direct"],
                example_usage="Government fiscal health and policy impact analysis"
            )
        ])
        
        # Financial metrics filters (SEC EDGAR)
        filters[FilterType.FINANCIAL_METRICS].extend([
            FilterOption(
                value="min_revenue:1000000000",  # $1B minimum revenue
                label="Large Cap Revenue Filter",
                description="Companies with revenue greater than $1 billion",
                category=FilterType.FINANCIAL_METRICS,
                applicable_collectors=["sec_edgar"],
                requires_additional_params=True,
                example_usage="Large company financial screening"
            ),
            FilterOption(
                value="min_roe:15,max_debt_to_equity:0.5",
                label="High Quality Metrics",
                description="Companies with ROE > 15% and low debt-to-equity ratio",
                category=FilterType.FINANCIAL_METRICS,
                applicable_collectors=["sec_edgar"],
                requires_additional_params=True,
                example_usage="Quality company screening for investment analysis"
            ),
            FilterOption(
                value="min_current_ratio:2.0,min_net_income:100000000",
                label="Financial Strength Filter",
                description="Companies with strong liquidity and profitability",
                category=FilterType.FINANCIAL_METRICS,
                applicable_collectors=["sec_edgar"], 
                requires_additional_params=True,
                example_usage="Financially robust company identification"
            )
        ])
        
        return filters
    
    def get_available_filter_options(self, filter_type: Optional[FilterType] = None) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all available filter options for frontend dropdowns and selectors.
        
        Args:
            filter_type: Optional specific filter type to retrieve
            
        Returns:
            Dictionary mapping filter types to available options
        """
        if filter_type:
            if filter_type not in self._available_filters:
                return {}
            
            return {
                filter_type.value: [
                    {
                        "value": option.value,
                        "label": option.label,
                        "description": option.description,
                        "applicable_collectors": option.applicable_collectors,
                        "requires_additional_params": option.requires_additional_params,
                        "example_usage": option.example_usage
                    }
                    for option in self._available_filters[filter_type]
                ]
            }
        
        # Return all filter options
        result = {}
        for filter_category, options in self._available_filters.items():
            result[filter_category.value] = [
                {
                    "value": option.value,
                    "label": option.label, 
                    "description": option.description,
                    "applicable_collectors": option.applicable_collectors,
                    "requires_additional_params": option.requires_additional_params,
                    "example_usage": option.example_usage
                }
                for option in options
            ]
        
        return result
    
    def translate_frontend_filters(self, frontend_filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Translate frontend filter format to collector-compatible format.
        
        Args:
            frontend_filters: Frontend filter dictionary
            
        Returns:
            Collector-compatible filter dictionary
            
        Example frontend_filters:
            {
                "companies": "AAPL,MSFT,GOOGL",
                "analysis_type": "fundamental", 
                "time_period": "5y",
                "financial_metrics": "min_roe:15,max_debt_to_equity:0.5"
            }
        """
        translated_filters = {}
        
        # Handle company filters
        if "companies" in frontend_filters:
            companies_str = frontend_filters["companies"]
            if isinstance(companies_str, str):
                translated_filters["companies"] = [c.strip() for c in companies_str.split(",")]
            elif isinstance(companies_str, list):
                translated_filters["companies"] = companies_str
        
        # Handle economic sector filters
        if "economic_sectors" in frontend_filters:
            sectors = frontend_filters["economic_sectors"]
            if isinstance(sectors, str):
                # Could be SIC codes or sector names
                if sectors.replace(",", "").replace(" ", "").isdigit():
                    translated_filters["sic_codes"] = [s.strip() for s in sectors.split(",")]
                else:
                    translated_filters["sectors"] = [s.strip() for s in sectors.split(",")]
        
        # Handle geographic filters
        if "geographic" in frontend_filters:
            geo_filter = frontend_filters["geographic"]
            if isinstance(geo_filter, str):
                geo_parts = [g.strip() for g in geo_filter.split(",")]
                
                # Determine if these are states, regions, or metro codes
                if all(len(part) == 2 and part.isupper() for part in geo_parts):
                    translated_filters["states"] = geo_parts
                elif all(part.isdigit() for part in geo_parts):
                    translated_filters["metro_areas"] = geo_parts
                else:
                    translated_filters["regions"] = geo_parts
        
        # Handle economic indicators
        if "economic_indicators" in frontend_filters:
            indicators = frontend_filters["economic_indicators"]
            if isinstance(indicators, str):
                indicator_list = [i.strip() for i in indicators.split(",")]
                translated_filters["fred_series"] = indicator_list
                # Also add to economic indicator field for other collectors
                translated_filters["economic_indicator"] = indicator_list
        
        # Handle Treasury securities
        if "treasury_securities" in frontend_filters:
            treasury = frontend_filters["treasury_securities"]
            if isinstance(treasury, str):
                treasury_parts = [t.strip() for t in treasury.split(",")]
                
                # Determine if these are security types or maturities
                security_types = ["bills", "notes", "bonds", "tips", "frns"]
                if all(part.lower() in security_types for part in treasury_parts):
                    translated_filters["security_types"] = treasury_parts
                else:
                    translated_filters["maturities"] = treasury_parts
        
        # Handle time period filters
        if "time_period" in frontend_filters:
            time_period = frontend_filters["time_period"]
            if time_period in ["1y", "5y", "10y", "all"]:
                # Convert to date range
                if time_period == "1y":
                    end_date = date.today()
                    start_date = end_date - timedelta(days=365)
                elif time_period == "5y":
                    end_date = date.today()
                    start_date = end_date - timedelta(days=1825)  # 5 years
                elif time_period == "10y":
                    end_date = date.today()
                    start_date = end_date - timedelta(days=3650)  # 10 years
                else:  # "all"
                    end_date = date.today()
                    start_date = date(2000, 1, 1)  # Default to 2000
                
                translated_filters["date_range"] = {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            elif ":" in time_period:
                # Custom date range: "2023-01-01:2024-12-31"
                start_str, end_str = time_period.split(":")
                translated_filters["date_range"] = {
                    "start_date": start_str,
                    "end_date": end_str
                }
        
        # Handle analysis type
        if "analysis_type" in frontend_filters:
            translated_filters["analysis_type"] = frontend_filters["analysis_type"]
        
        # Handle financial metrics (complex parsing)
        if "financial_metrics" in frontend_filters:
            metrics_str = frontend_filters["financial_metrics"]
            if isinstance(metrics_str, str):
                metrics_parts = [m.strip() for m in metrics_str.split(",")]
                for metric_part in metrics_parts:
                    if ":" in metric_part:
                        key, value = metric_part.split(":", 1)
                        try:
                            # Convert to appropriate numeric type
                            if "." in value:
                                translated_filters[key] = float(value)
                            else:
                                translated_filters[key] = int(value)
                        except ValueError:
                            translated_filters[key] = value
        
        # Add metadata
        translated_filters["frontend_translation"] = {
            "timestamp": datetime.now().isoformat(),
            "original_filters": frontend_filters
        }
        
        return translated_filters
    
    def validate_filter_combination(self, filters: Dict[str, Any]) -> FilterValidationResult:
        """
        Validate filter combinations and provide suggestions.
        
        Args:
            filters: Filter dictionary to validate
            
        Returns:
            FilterValidationResult with validation status and suggestions
        """
        result = FilterValidationResult(is_valid=True)
        
        try:
            # Use the collector router to validate the request
            router_validation = self.router.validate_request(filters)
            
            result.is_valid = router_validation.get("is_valid", True)
            result.warnings.extend(router_validation.get("warnings", []))
            result.suggestions.extend(router_validation.get("recommendations", []))
            result.expected_collectors = router_validation.get("expected_collectors", [])
            
            # Analyze filter complexity for performance estimation
            complexity_factors = [
                len(filters.get("companies", [])),
                len(filters.get("fred_series", [])),
                len(filters.get("sic_codes", [])),
                1 if filters.get("date_range") else 0,
                1 if any(k.startswith("min_") or k.startswith("max_") for k in filters.keys()) else 0
            ]
            
            total_complexity = sum(complexity_factors)
            if total_complexity <= 2:
                result.estimated_performance = "fast"
            elif total_complexity <= 5:
                result.estimated_performance = "medium"
            else:
                result.estimated_performance = "slow"
            
            # Estimate data availability based on collectors
            if "sec_edgar" in result.expected_collectors:
                result.data_availability = "high"  # SEC data is comprehensive
            elif any(collector in result.expected_collectors for collector in ["fred", "bea", "treasury_fiscal"]):
                result.data_availability = "high"  # Government data is reliable
            else:
                result.data_availability = "medium"
        
        except Exception as e:
            logger.error(f"Filter validation error: {e}")
            result.is_valid = False
            result.warnings.append(f"Validation error: {e}")
            
        return result
    
    def get_filter_suggestions(self, partial_filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Get filter suggestions based on partial filter input.
        
        Args:
            partial_filters: Partially completed filter dictionary
            
        Returns:
            List of suggested filter additions or modifications
        """
        suggestions = []
        
        # If companies are specified, suggest fundamental analysis
        if "companies" in partial_filters and "analysis_type" not in partial_filters:
            suggestions.append({
                "type": "add_filter",
                "filter_key": "analysis_type", 
                "suggested_value": "fundamental",
                "reason": "Fundamental analysis recommended for individual company analysis"
            })
        
        # If economic indicators are specified, suggest economic analysis
        if "fred_series" in partial_filters and "analysis_type" not in partial_filters:
            suggestions.append({
                "type": "add_filter",
                "filter_key": "analysis_type",
                "suggested_value": "economic",
                "reason": "Economic analysis recommended for FRED indicators"
            })
        
        # If no time period specified, suggest a default
        if "time_period" not in partial_filters and "date_range" not in partial_filters:
            suggestions.append({
                "type": "add_filter",
                "filter_key": "time_period",
                "suggested_value": "5y",
                "reason": "5-year period provides good balance of historical context and relevance"
            })
        
        # If Treasury securities specified, suggest fiscal analysis
        if any(key in partial_filters for key in ["treasury_securities", "security_types", "maturities"]):
            if "analysis_type" not in partial_filters:
                suggestions.append({
                    "type": "add_filter",
                    "filter_key": "analysis_type",
                    "suggested_value": "fiscal",
                    "reason": "Fiscal analysis recommended for Treasury securities analysis"
                })
        
        # If too many companies specified, suggest breaking down
        companies = partial_filters.get("companies", [])
        if len(companies) > 10:
            suggestions.append({
                "type": "modify_filter",
                "filter_key": "companies",
                "suggested_value": companies[:10],
                "reason": f"Consider analyzing {len(companies)} companies in smaller batches for better performance"
            })
        
        return suggestions
    
    def create_filter_preset(self, preset_name: str) -> Dict[str, Any]:
        """
        Create predefined filter presets for common use cases.
        
        Args:
            preset_name: Name of the preset to create
            
        Returns:
            Filter dictionary for the specified preset
        """
        presets = {
            "tech_fundamentals": {
                "companies": ["AAPL", "MSFT", "GOOGL", "NVDA", "META"],
                "analysis_type": "fundamental",
                "time_period": "5y",
                "description": "Fundamental analysis of major technology companies"
            },
            
            "economic_dashboard": {
                "fred_series": ["GDP", "UNRATE", "CPIAUCSL", "FEDFUNDS"],
                "analysis_type": "economic",
                "time_period": "10y",
                "description": "Key economic indicators dashboard"
            },
            
            "yield_curve_analysis": {
                "treasury_securities": "2 Yr,5 Yr,10 Yr,30 Yr",
                "analysis_type": "fiscal",
                "time_period": "2y",
                "description": "Treasury yield curve analysis"
            },
            
            "banking_sector": {
                "economic_sectors": "6021,6022,6029",
                "companies": ["JPM", "BAC", "WFC", "C"],
                "analysis_type": "fundamental",
                "time_period": "5y",
                "description": "Banking sector fundamental analysis"
            },
            
            "regional_economic": {
                "geographic": "CA,NY,TX,FL",
                "fred_series": ["GDP", "UNRATE"],
                "analysis_type": "economic",
                "time_period": "5y",
                "description": "Regional economic performance analysis"
            },
            
            "fiscal_health": {
                "treasury_securities": "federal_debt,government_spending",
                "analysis_type": "fiscal",
                "time_period": "10y",
                "description": "Federal fiscal health and sustainability analysis"
            }
        }
        
        return presets.get(preset_name, {})
    
    def get_all_presets(self) -> Dict[str, Dict[str, Any]]:
        """Get all available filter presets."""
        presets = [
            "tech_fundamentals", "economic_dashboard", "yield_curve_analysis",
            "banking_sector", "regional_economic", "fiscal_health"
        ]
        
        return {name: self.create_filter_preset(name) for name in presets}