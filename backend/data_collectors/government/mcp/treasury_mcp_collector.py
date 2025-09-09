"""
Treasury MCP Collector

Government Treasury data collector leveraging Treasury MCP tools through 
MCP (Model Context Protocol) server integration. Provides AI-native access
to yield curves, interest rates, economic cycle analysis, and rate sensitivity
calculations using official Treasury data sources.

Features:
- Economic cycle detection and analysis
- Yield curve analysis with recession signals
- Interest rate sensitivity calculations
- Rate impact predictions for portfolios
- AI-optimized MCP tools for macroeconomic analysis

This collector establishes Treasury-specific macroeconomic analysis capabilities
through the existing Data.gov MCP infrastructure.
"""

import os
import sys
import json
import time
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from pathlib import Path
import aiohttp

# Add path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from base.collector_interface import DataCollectorInterface, CollectorConfig
from commercial.base.mcp_collector_base import MCPError

# Import Treasury MCP tools
try:
    from .tools.treasury_macro_tools import (
        detect_economic_cycle,
        get_yield_curve_analysis,
        calculate_rate_sensitivity,
        predict_rate_impact,
        get_yield_curve,
        analyze_interest_rate_trends,
        get_federal_debt_analysis,
        calculate_economic_indicators
    )
    TREASURY_TOOLS_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import Treasury MCP tools: {e}")
    TREASURY_TOOLS_AVAILABLE = False

logger = logging.getLogger(__name__)


class TreasuryMCPCollector(DataCollectorInterface):
    """
    Treasury MCP collector for government macroeconomic data.
    
    Integrates Treasury MCP tools to provide economic cycle detection,
    yield curve analysis, rate sensitivity calculations, and investment
    timing guidance using official Treasury data sources.
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """
        Initialize Treasury MCP collector.
        
        Args:
            config: Optional collector configuration
        """
        # Use default config if none provided
        if config is None:
            config = CollectorConfig(
                timeout=30,
                max_retries=3,
                requests_per_minute=60,  # Government data - no strict limits
                cache_ttl=3600  # 1 hour cache for Treasury data
            )
        
        super().__init__(config)
        
        # Required properties
        self._source_name = "Treasury MCP"
        self._supported_data_types = [
            'economic_cycle', 'yield_curve', 'rate_sensitivity', 
            'rate_impact', 'treasury_rates', 'macro_indicators'
        ]
        
        # Tool categories for optimization
        self.tool_categories = {
            'economic_cycle': [
                'detect_economic_cycle',
                'calculate_economic_indicators'
            ],
            'yield_curve': [
                'get_yield_curve_analysis',
                'get_yield_curve',
                'analyze_interest_rate_trends'
            ],
            'rate_analysis': [
                'calculate_rate_sensitivity',
                'predict_rate_impact'
            ],
            'treasury_macro': [
                'get_federal_debt_analysis',
                'calculate_economic_indicators'
            ]
        }
        
        # Treasury-specific configuration
        self.connection_established = TREASURY_TOOLS_AVAILABLE
        
    @property
    def source_name(self) -> str:
        """Get source name for this collector."""
        return self._source_name
    
    @property 
    def supported_data_types(self) -> List[str]:
        """Get list of supported data types."""
        return self._supported_data_types
        
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if this collector should activate for given criteria.
        
        Args:
            filter_criteria: Filter criteria from request
            
        Returns:
            True if collector should handle this request
        """
        if not TREASURY_TOOLS_AVAILABLE:
            return False
            
        criteria_str = str(filter_criteria).lower()
        
        # Check for Treasury-specific requests
        treasury_keywords = [
            'treasury', 'yield_curve', 'economic_cycle', 'rate_sensitivity',
            'interest_rates', 'federal_debt', 'macro_indicators', 'recession',
            'rate_impact', 'cycle_detection', 'yield_analysis'
        ]
        
        has_treasury_keyword = any(
            keyword in criteria_str for keyword in treasury_keywords
        )
        
        # Check for supported data types
        has_supported_data = any(
            data_type in criteria_str 
            for data_type in self._supported_data_types
        )
        
        # Check for macroeconomic analysis requests
        has_macro_request = any(term in criteria_str for term in [
            'macroeconomic', 'economic_analysis', 'business_cycle',
            'recession_probability', 'investment_timing', 'sector_rotation'
        ])
        
        return has_treasury_keyword or has_supported_data or has_macro_request
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Calculate activation priority for given criteria.
        
        Args:
            filter_criteria: Filter criteria from request
            
        Returns:
            Priority score (0-100)
        """
        if not TREASURY_TOOLS_AVAILABLE:
            return 0
            
        criteria_str = str(filter_criteria).lower()
        priority = 60  # Base priority for Treasury data
        
        # High priority for specific Treasury analysis requests
        if 'economic_cycle' in criteria_str or 'detect_economic_cycle' in criteria_str:
            priority += 30  # 90 total
        elif 'yield_curve_analysis' in criteria_str or 'recession_signals' in criteria_str:
            priority += 25  # 85 total
        elif 'rate_sensitivity' in criteria_str or 'rate_impact' in criteria_str:
            priority += 20  # 80 total
        elif 'treasury_rates' in criteria_str or 'interest_rates' in criteria_str:
            priority += 15  # 75 total
        elif 'federal_debt' in criteria_str or 'macro_indicators' in criteria_str:
            priority += 10  # 70 total
        
        # Bonus for government data preference
        if 'government_data' in criteria_str or 'official_data' in criteria_str:
            priority += 10
        
        # Bonus for MCP preference
        if 'mcp_preferred' in criteria_str or 'ai_native' in criteria_str:
            priority += 5
        
        return min(priority, 100)
    
    async def collect_data(self, request_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Collect Treasury data using MCP tools.
        
        Args:
            request_params: Data collection parameters
            
        Returns:
            Collected data with metadata
        """
        if not TREASURY_TOOLS_AVAILABLE:
            return {
                'success': False,
                'error': 'Treasury MCP tools not available',
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat()
            }
        
        try:
            # Parse request parameters
            data_type = request_params.get('data_type', 'yield_curve')
            analysis_options = request_params.get('analysis_options', {})
            
            # Route to appropriate collection method
            if data_type == 'economic_cycle':
                return await self._collect_economic_cycle(analysis_options)
            elif data_type == 'yield_curve':
                return await self._collect_yield_curve_analysis(analysis_options)
            elif data_type == 'rate_sensitivity':
                return await self._collect_rate_sensitivity(analysis_options)
            elif data_type == 'rate_impact':
                return await self._collect_rate_impact(analysis_options)
            elif data_type == 'treasury_rates':
                return await self._collect_treasury_rates(analysis_options)
            elif data_type == 'macro_indicators':
                return await self._collect_macro_indicators(analysis_options)
            else:
                # Default to comprehensive Treasury analysis
                return await self._collect_comprehensive_treasury_analysis(request_params)
                
        except Exception as e:
            logger.error(f"Treasury data collection failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat()
            }
    
    async def _collect_economic_cycle(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Collect economic cycle detection data."""
        try:
            lookback_months = options.get('lookback_months', 24)
            confidence_threshold = options.get('confidence_threshold', 0.7)
            
            cycle_data = await detect_economic_cycle(
                lookback_months=lookback_months,
                confidence_threshold=confidence_threshold
            )
            
            return {
                'success': True,
                'data_type': 'economic_cycle',
                'data': cycle_data,
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'parameters': {
                    'lookback_months': lookback_months,
                    'confidence_threshold': confidence_threshold
                }
            }
            
        except Exception as e:
            logger.error(f"Economic cycle collection failed: {e}")
            raise
    
    async def _collect_yield_curve_analysis(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Collect yield curve analysis data."""
        try:
            date = options.get('date')
            
            yield_curve_data = await get_yield_curve_analysis(date=date)
            
            return {
                'success': True,
                'data_type': 'yield_curve',
                'data': yield_curve_data,
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'parameters': {
                    'date': date
                }
            }
            
        except Exception as e:
            logger.error(f"Yield curve analysis collection failed: {e}")
            raise
    
    async def _collect_rate_sensitivity(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Collect rate sensitivity analysis data."""
        try:
            securities = options.get('securities')
            portfolio_weights = options.get('portfolio_weights')
            rate_change_bps = options.get('rate_change_bps', 100)
            
            rate_sensitivity_data = await calculate_rate_sensitivity(
                securities=securities,
                portfolio_weights=portfolio_weights,
                rate_change_bps=rate_change_bps
            )
            
            return {
                'success': True,
                'data_type': 'rate_sensitivity',
                'data': rate_sensitivity_data,
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'parameters': {
                    'securities': securities,
                    'portfolio_weights': portfolio_weights,
                    'rate_change_bps': rate_change_bps
                }
            }
            
        except Exception as e:
            logger.error(f"Rate sensitivity collection failed: {e}")
            raise
    
    async def _collect_rate_impact(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Collect rate impact prediction data."""
        try:
            rate_scenarios = options.get('rate_scenarios')
            asset_classes = options.get('asset_classes')
            time_horizon = options.get('time_horizon', '1_year')
            
            rate_impact_data = await predict_rate_impact(
                rate_scenarios=rate_scenarios,
                asset_classes=asset_classes,
                time_horizon=time_horizon
            )
            
            return {
                'success': True,
                'data_type': 'rate_impact',
                'data': rate_impact_data,
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'parameters': {
                    'rate_scenarios': rate_scenarios,
                    'asset_classes': asset_classes,
                    'time_horizon': time_horizon
                }
            }
            
        except Exception as e:
            logger.error(f"Rate impact collection failed: {e}")
            raise
    
    async def _collect_treasury_rates(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Collect basic Treasury rates data."""
        try:
            yield_curve_data = await get_yield_curve(date=options.get('date'))
            
            return {
                'success': True,
                'data_type': 'treasury_rates',
                'data': yield_curve_data,
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'parameters': options
            }
            
        except Exception as e:
            logger.error(f"Treasury rates collection failed: {e}")
            raise
    
    async def _collect_macro_indicators(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Collect macroeconomic indicators data."""
        try:
            indicator_type = options.get('indicator_type', 'comprehensive')
            
            macro_data = await calculate_economic_indicators(
                indicator_type=indicator_type
            )
            
            return {
                'success': True,
                'data_type': 'macro_indicators',
                'data': macro_data,
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'parameters': options
            }
            
        except Exception as e:
            logger.error(f"Macro indicators collection failed: {e}")
            raise
    
    async def _collect_comprehensive_treasury_analysis(self, request_params: Dict[str, Any]) -> Dict[str, Any]:
        """Collect comprehensive Treasury analysis combining multiple tools."""
        try:
            # Execute multiple Treasury tools in parallel for comprehensive analysis
            tasks = []
            
            # Economic cycle detection
            tasks.append(self._collect_economic_cycle({}))
            
            # Yield curve analysis
            tasks.append(self._collect_yield_curve_analysis({}))
            
            # Basic Treasury rates
            tasks.append(self._collect_treasury_rates({}))
            
            # Execute all tasks
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            comprehensive_data = {
                'economic_cycle': None,
                'yield_curve_analysis': None,
                'treasury_rates': None,
                'errors': []
            }
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    comprehensive_data['errors'].append({
                        'tool_index': i,
                        'error': str(result)
                    })
                elif result.get('success'):
                    data_type = result.get('data_type')
                    if data_type in comprehensive_data:
                        comprehensive_data[data_type] = result.get('data')
            
            return {
                'success': True,
                'data_type': 'comprehensive_treasury_analysis',
                'data': comprehensive_data,
                'collector': self.source_name,
                'timestamp': datetime.now().isoformat(),
                'parameters': request_params
            }
            
        except Exception as e:
            logger.error(f"Comprehensive Treasury analysis failed: {e}")
            raise

    # Required interface methods
    async def validate_connection(self) -> bool:
        """Validate Treasury MCP tools are available."""
        return TREASURY_TOOLS_AVAILABLE
    
    async def get_data_quality_score(self, data: Dict[str, Any]) -> float:
        """Calculate data quality score for Treasury data."""
        if not data or not data.get('success'):
            return 0.0
        
        # Treasury data is generally high quality from official sources
        base_score = 0.9
        
        # Adjust based on data completeness
        data_content = data.get('data', {})
        if isinstance(data_content, dict) and data_content:
            return min(base_score + 0.1, 1.0)
        
        return base_score
    
    def get_cost_estimate(self, request_params: Dict[str, Any]) -> float:
        """Get cost estimate for Treasury data request."""
        # Treasury data is free from government sources
        return 0.0
    
    def get_quota_status(self) -> Dict[str, Any]:
        """Get current quota status."""
        return {
            'requests_used': 0,
            'requests_remaining': 'unlimited',
            'reset_time': None,
            'quota_type': 'government_free'
        }
    
    # Required abstract methods from DataCollectorInterface
    def requires_api_key(self) -> bool:
        """Treasury data does not require API keys."""
        return False
    
    async def authenticate(self) -> bool:
        """Treasury data requires no authentication."""
        return True
    
    async def test_connection(self) -> bool:
        """Test connection to Treasury data sources."""
        return await self.validate_connection()
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get rate limiting information for Treasury APIs."""
        return {
            'requests_per_second': 1.0,
            'requests_per_minute': 60,
            'requests_per_day': None,  # No daily limits
            'concurrent_requests': 1
        }
    
    async def get_available_symbols(self, symbol_type: str = 'all') -> List[str]:
        """Get available symbols for Treasury analysis."""
        # Treasury analysis is not symbol-specific but rather economic analysis
        return [
            'economic_cycle', 'yield_curve', 'interest_rates',
            'treasury_rates', 'federal_debt', 'recession_indicators'
        ]
    
    async def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """Validate Treasury analysis types."""
        valid_analysis_types = await self.get_available_symbols()
        return {symbol: symbol in valid_analysis_types for symbol in symbols}
    
    async def collect_realtime(self, symbols: List[str], **kwargs) -> Dict[str, Any]:
        """Collect real-time Treasury data."""
        # Treasury data is not typically real-time, redirect to regular collection
        request_params = {
            'data_type': 'treasury_rates',
            'symbols': symbols,
            **kwargs
        }
        return await self.collect_data(request_params)
    
    async def collect_batch(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Collect multiple Treasury data requests in batch."""
        results = []
        for request in requests:
            try:
                result = await self.collect_data(request)
                results.append(result)
            except Exception as e:
                results.append({
                    'success': False,
                    'error': str(e),
                    'request': request,
                    'collector': self.source_name,
                    'timestamp': datetime.now().isoformat()
                })
        return results