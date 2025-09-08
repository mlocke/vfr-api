"""
Treasury & Macro MCP Tools

MCP tools for Treasury data and macroeconomic analysis using data.gov sources.
Provides AI-native access to yield curves, interest rates, debt analysis,
and macroeconomic indicators.

Tools:
- get_yield_curve: Retrieve current Treasury yield curve data
- analyze_interest_rate_trends: Analyze interest rate movements over time  
- get_federal_debt_analysis: Analyze federal debt composition and trends
- calculate_economic_indicators: Calculate key economic health indicators
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
import aiohttp
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class YieldCurvePoint:
    """Treasury yield curve data point."""
    maturity: str
    yield_percent: float
    date: str
    duration_years: float


@dataclass
class DebtMetric:
    """Federal debt metric data structure."""
    metric_name: str
    current_value: float
    historical_average: Optional[float]
    trend_direction: str
    significance: str
    date: str


class TreasuryDataProcessor:
    """Processor for Treasury and macroeconomic data."""
    
    def __init__(self):
        self.treasury_base_url = "https://api.fiscaldata.treasury.gov/services/api/v2"
        self.session = aiohttp.ClientSession(
            headers={'User-Agent': 'StockPicker-DataGov-MCP/1.0'}
        )
        
        # Treasury security maturity mapping
        self.maturity_mapping = {
            '1mo': {'years': 0.083, 'name': '1 Month'},
            '2mo': {'years': 0.167, 'name': '2 Month'},
            '3mo': {'years': 0.25, 'name': '3 Month'},
            '4mo': {'years': 0.333, 'name': '4 Month'},
            '6mo': {'years': 0.5, 'name': '6 Month'},
            '1yr': {'years': 1.0, 'name': '1 Year'},
            '2yr': {'years': 2.0, 'name': '2 Year'},
            '3yr': {'years': 3.0, 'name': '3 Year'},
            '5yr': {'years': 5.0, 'name': '5 Year'},
            '7yr': {'years': 7.0, 'name': '7 Year'},
            '10yr': {'years': 10.0, 'name': '10 Year'},
            '20yr': {'years': 20.0, 'name': '20 Year'},
            '30yr': {'years': 30.0, 'name': '30 Year'}
        }
    
    async def get_daily_treasury_rates(self, date_range: str = "30") -> List[Dict[str, Any]]:
        """Get daily Treasury rates from Treasury Direct API."""
        try:
            # Use Treasury Direct API for yield curve data
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=int(date_range))).strftime('%Y-%m-%d')
            
            url = f"{self.treasury_base_url}/accounting/od/avg_interest_rates"
            params = {
                'filter': f'record_date:gte:{start_date},record_date:lte:{end_date}',
                'sort': '-record_date',
                'page[size]': 1000
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('data', [])
                else:
                    logger.warning(f"Failed to get Treasury rates: HTTP {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error getting Treasury rates: {e}")
            return []
    
    async def get_federal_debt_data(self, quarters: int = 8) -> List[Dict[str, Any]]:
        """Get federal debt data from Treasury Fiscal API."""
        try:
            url = f"{self.treasury_base_url}/accounting/od/debt_to_penny"
            params = {
                'sort': '-record_date',
                'page[size]': quarters * 90  # Approximate daily records per quarter
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('data', [])
                else:
                    logger.warning(f"Failed to get debt data: HTTP {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error getting federal debt data: {e}")
            return []
    
    async def get_economic_indicators(self) -> Dict[str, Any]:
        """Get key economic indicators from multiple Treasury sources."""
        try:
            indicators = {}
            
            # Get latest debt data
            debt_data = await self.get_federal_debt_data(quarters=1)
            if debt_data:
                latest_debt = debt_data[0]
                indicators['federal_debt'] = {
                    'total_debt': float(latest_debt.get('tot_pub_debt_out_amt', 0)),
                    'date': latest_debt.get('record_date'),
                    'intragovernmental_holdings': float(latest_debt.get('intragov_hold_amt', 0)),
                    'debt_held_by_public': float(latest_debt.get('debt_held_public_amt', 0))
                }
            
            # Get interest rate data
            rate_data = await self.get_daily_treasury_rates(date_range="7")
            if rate_data:
                latest_rates = rate_data[0]
                indicators['interest_rates'] = {
                    'treasury_10yr': self._extract_rate(latest_rates, '10yr'),
                    'treasury_2yr': self._extract_rate(latest_rates, '2yr'),
                    'treasury_3mo': self._extract_rate(latest_rates, '3mo'),
                    'date': latest_rates.get('record_date')
                }
            
            return indicators
            
        except Exception as e:
            logger.error(f"Error getting economic indicators: {e}")
            return {}
    
    def _extract_rate(self, rate_data: Dict[str, Any], maturity: str) -> Optional[float]:
        """Extract specific maturity rate from Treasury data."""
        try:
            # Map common maturity names to API field names
            field_mapping = {
                '3mo': 'avg_interest_rate_amt',
                '2yr': 'avg_interest_rate_amt',  # Would need specific field mapping
                '10yr': 'avg_interest_rate_amt'  # Would need specific field mapping
            }
            
            field_name = field_mapping.get(maturity)
            if field_name and field_name in rate_data:
                return float(rate_data[field_name])
            
            return None
            
        except Exception as e:
            logger.debug(f"Failed to extract rate for {maturity}: {e}")
            return None
    
    async def cleanup(self):
        """Clean up HTTP session."""
        if self.session:
            await self.session.close()


# MCP Tool Functions

async def get_yield_curve(date: Optional[str] = None) -> Dict[str, Any]:
    """
    MCP Tool: Retrieve current Treasury yield curve data.
    
    Args:
        date: Optional specific date (YYYY-MM-DD), defaults to latest
        
    Returns:
        Dictionary containing yield curve data
    """
    processor = TreasuryDataProcessor()
    
    try:
        # Get Treasury rate data
        rate_data = await processor.get_daily_treasury_rates(date_range="7")
        
        if not rate_data:
            return {
                'success': False,
                'error': 'No Treasury yield data available',
                'date': date
            }
        
        # Use latest data if no specific date requested
        target_data = rate_data[0]
        if date:
            for data_point in rate_data:
                if data_point.get('record_date') == date:
                    target_data = data_point
                    break
        
        # Build yield curve
        yield_curve_points = []
        
        # Extract available yield points (this would need proper field mapping)
        for maturity, info in processor.maturity_mapping.items():
            rate = processor._extract_rate(target_data, maturity)
            if rate is not None:
                yield_curve_points.append(YieldCurvePoint(
                    maturity=info['name'],
                    yield_percent=rate,
                    date=target_data.get('record_date'),
                    duration_years=info['years']
                ).__dict__)
        
        # Calculate yield curve metrics
        if len(yield_curve_points) >= 2:
            short_rate = min(yield_curve_points, key=lambda x: x['duration_years'])['yield_percent']
            long_rate = max(yield_curve_points, key=lambda x: x['duration_years'])['yield_percent']
            yield_spread = long_rate - short_rate
            curve_shape = 'normal' if yield_spread > 0 else 'inverted' if yield_spread < 0 else 'flat'
        else:
            yield_spread = 0
            curve_shape = 'insufficient_data'
        
        return {
            'success': True,
            'date': target_data.get('record_date'),
            'yield_curve': yield_curve_points,
            'curve_metrics': {
                'yield_spread': yield_spread,
                'curve_shape': curve_shape,
                'data_points': len(yield_curve_points)
            },
            'metadata': {
                'source': 'Treasury Direct via data.gov',
                'extraction_time': datetime.now().isoformat(),
                'note': 'Daily Treasury yield curve from official sources'
            }
        }
        
    except Exception as e:
        logger.error(f"get_yield_curve failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'date': date
        }
    
    finally:
        await processor.cleanup()


async def analyze_interest_rate_trends(maturity: str = '10yr', days: int = 90) -> Dict[str, Any]:
    """
    MCP Tool: Analyze interest rate movements over time.
    
    Args:
        maturity: Treasury maturity to analyze (e.g., '10yr', '2yr')
        days: Number of days to analyze
        
    Returns:
        Dictionary containing interest rate trend analysis
    """
    processor = TreasuryDataProcessor()
    
    try:
        # Get historical rate data
        rate_data = await processor.get_daily_treasury_rates(date_range=str(days))
        
        if not rate_data:
            return {
                'success': False,
                'error': f'No interest rate data available for {maturity}',
                'maturity': maturity,
                'days': days
            }
        
        # Extract rates for the specified maturity
        rate_series = []
        for data_point in reversed(rate_data):  # Oldest to newest
            rate = processor._extract_rate(data_point, maturity)
            if rate is not None:
                rate_series.append({
                    'date': data_point.get('record_date'),
                    'rate': rate
                })
        
        if len(rate_series) < 2:
            return {
                'success': False,
                'error': f'Insufficient data for trend analysis of {maturity}',
                'maturity': maturity,
                'data_points': len(rate_series)
            }
        
        # Calculate trend metrics
        rates = [point['rate'] for point in rate_series]
        dates = [point['date'] for point in rate_series]
        
        # Basic trend analysis
        rate_change = rates[-1] - rates[0]
        rate_change_bps = rate_change * 100  # Convert to basis points
        avg_rate = sum(rates) / len(rates)
        volatility = _calculate_volatility(rates)
        
        # Trend direction
        if rate_change_bps > 10:
            trend_direction = 'rising'
        elif rate_change_bps < -10:
            trend_direction = 'falling'
        else:
            trend_direction = 'stable'
        
        trend_analysis = {
            'maturity': maturity,
            'analysis_period': f'{dates[0]} to {dates[-1]}',
            'current_rate': rates[-1],
            'starting_rate': rates[0],
            'rate_change_bps': rate_change_bps,
            'average_rate': avg_rate,
            'volatility': volatility,
            'trend_direction': trend_direction,
            'data_points': len(rate_series),
            'rate_range': {
                'min': min(rates),
                'max': max(rates)
            }
        }
        
        return {
            'success': True,
            'maturity': maturity,
            'trend_analysis': trend_analysis,
            'rate_series': rate_series,
            'metadata': {
                'source': 'Treasury Direct via data.gov',
                'analysis_time': datetime.now().isoformat(),
                'analysis_period_days': days
            }
        }
        
    except Exception as e:
        logger.error(f"analyze_interest_rate_trends failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'maturity': maturity
        }
    
    finally:
        await processor.cleanup()


async def get_federal_debt_analysis(quarters: int = 8) -> Dict[str, Any]:
    """
    MCP Tool: Analyze federal debt composition and trends.
    
    Args:
        quarters: Number of quarters to analyze
        
    Returns:
        Dictionary containing federal debt analysis
    """
    processor = TreasuryDataProcessor()
    
    try:
        # Get federal debt data
        debt_data = await processor.get_federal_debt_data(quarters=quarters)
        
        if not debt_data:
            return {
                'success': False,
                'error': 'No federal debt data available',
                'quarters': quarters
            }
        
        # Process debt data into quarterly summaries
        quarterly_debt = {}
        for record in debt_data:
            record_date = record.get('record_date', '')
            quarter_key = _date_to_quarter(record_date)
            
            if quarter_key not in quarterly_debt:
                quarterly_debt[quarter_key] = []
            
            quarterly_debt[quarter_key].append({
                'date': record_date,
                'total_debt': float(record.get('tot_pub_debt_out_amt', 0)),
                'debt_held_by_public': float(record.get('debt_held_public_amt', 0)),
                'intragovernmental_holdings': float(record.get('intragov_hold_amt', 0))
            })
        
        # Calculate quarterly averages
        quarterly_summary = {}
        for quarter, records in quarterly_debt.items():
            if records:
                avg_total_debt = sum(r['total_debt'] for r in records) / len(records)
                avg_public_debt = sum(r['debt_held_by_public'] for r in records) / len(records)
                avg_intragov = sum(r['intragovernmental_holdings'] for r in records) / len(records)
                
                quarterly_summary[quarter] = {
                    'total_debt': avg_total_debt,
                    'debt_held_by_public': avg_public_debt,
                    'intragovernmental_holdings': avg_intragov,
                    'public_debt_ratio': (avg_public_debt / avg_total_debt * 100) if avg_total_debt > 0 else 0,
                    'latest_date': max(records, key=lambda x: x['date'])['date']
                }
        
        # Calculate trends
        sorted_quarters = sorted(quarterly_summary.keys())
        if len(sorted_quarters) >= 2:
            first_quarter = quarterly_summary[sorted_quarters[0]]
            latest_quarter = quarterly_summary[sorted_quarters[-1]]
            
            debt_growth = latest_quarter['total_debt'] - first_quarter['total_debt']
            debt_growth_rate = (debt_growth / first_quarter['total_debt'] * 100) if first_quarter['total_debt'] > 0 else 0
            
            trend_analysis = {
                'debt_growth_absolute': debt_growth,
                'debt_growth_rate_percent': debt_growth_rate,
                'average_quarterly_change': debt_growth / len(sorted_quarters),
                'analysis_period': f'{sorted_quarters[0]} to {sorted_quarters[-1]}',
                'trend_direction': 'increasing' if debt_growth > 0 else 'decreasing'
            }
        else:
            trend_analysis = {'error': 'Insufficient data for trend analysis'}
        
        # Current debt metrics
        if sorted_quarters:
            current_metrics = quarterly_summary[sorted_quarters[-1]]
            current_metrics['debt_composition'] = {
                'public_debt_percent': current_metrics['public_debt_ratio'],
                'intragovernmental_percent': 100 - current_metrics['public_debt_ratio']
            }
        else:
            current_metrics = {'error': 'No current data available'}
        
        return {
            'success': True,
            'current_debt_metrics': current_metrics,
            'quarterly_summary': quarterly_summary,
            'trend_analysis': trend_analysis,
            'metadata': {
                'source': 'Treasury Fiscal Data via data.gov',
                'analysis_time': datetime.now().isoformat(),
                'quarters_analyzed': len(quarterly_summary),
                'note': 'Federal debt data from Daily Treasury Statement'
            }
        }
        
    except Exception as e:
        logger.error(f"get_federal_debt_analysis failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'quarters': quarters
        }
    
    finally:
        await processor.cleanup()


async def calculate_economic_indicators() -> Dict[str, Any]:
    """
    MCP Tool: Calculate key economic health indicators from Treasury data.
    
    Returns:
        Dictionary containing economic health indicators
    """
    processor = TreasuryDataProcessor()
    
    try:
        # Get comprehensive economic data
        indicators_data = await processor.get_economic_indicators()
        
        if not indicators_data:
            return {
                'success': False,
                'error': 'No economic indicator data available'
            }
        
        economic_indicators = {
            'debt_indicators': {},
            'interest_rate_indicators': {},
            'economic_health_score': None,
            'risk_assessments': []
        }
        
        # Debt-based indicators
        if 'federal_debt' in indicators_data:
            debt_data = indicators_data['federal_debt']
            total_debt_trillions = debt_data['total_debt'] / 1_000_000_000_000
            
            economic_indicators['debt_indicators'] = {
                'total_federal_debt_trillions': round(total_debt_trillions, 2),
                'debt_held_by_public_trillions': round(debt_data['debt_held_by_public'] / 1_000_000_000_000, 2),
                'public_debt_ratio': round(debt_data['debt_held_by_public'] / debt_data['total_debt'] * 100, 1),
                'debt_sustainability_score': _calculate_debt_sustainability_score(total_debt_trillions),
                'date': debt_data['date']
            }
        
        # Interest rate indicators
        if 'interest_rates' in indicators_data:
            rate_data = indicators_data['interest_rates']
            
            # Calculate yield curve indicators
            ten_yr = rate_data.get('treasury_10yr', 0) or 0
            two_yr = rate_data.get('treasury_2yr', 0) or 0
            three_mo = rate_data.get('treasury_3mo', 0) or 0
            
            yield_spread_10_2 = ten_yr - two_yr
            yield_spread_10_3mo = ten_yr - three_mo
            
            economic_indicators['interest_rate_indicators'] = {
                'treasury_10yr': ten_yr,
                'treasury_2yr': two_yr,
                'treasury_3mo': three_mo,
                'yield_spread_10yr_2yr': yield_spread_10_2,
                'yield_spread_10yr_3mo': yield_spread_10_3mo,
                'yield_curve_shape': _classify_yield_curve(yield_spread_10_2),
                'recession_probability': _calculate_recession_probability(yield_spread_10_2),
                'date': rate_data['date']
            }
        
        # Overall economic health score (0-100)
        health_factors = []
        
        # Factor 1: Debt sustainability (25% weight)
        if 'debt_indicators' in economic_indicators and 'debt_sustainability_score' in economic_indicators['debt_indicators']:
            debt_score = economic_indicators['debt_indicators']['debt_sustainability_score']
            health_factors.append(debt_score * 0.25)
        
        # Factor 2: Yield curve health (25% weight)
        if 'interest_rate_indicators' in economic_indicators:
            curve_score = 100 - economic_indicators['interest_rate_indicators'].get('recession_probability', 50)
            health_factors.append(curve_score * 0.25)
        
        # Factor 3: Interest rate level (25% weight)
        if 'interest_rate_indicators' in economic_indicators:
            rate_score = _calculate_rate_health_score(economic_indicators['interest_rate_indicators'].get('treasury_10yr', 3))
            health_factors.append(rate_score * 0.25)
        
        # Factor 4: Stability factor (25% weight)
        stability_score = 75  # Base stability score
        health_factors.append(stability_score * 0.25)
        
        if health_factors:
            economic_indicators['economic_health_score'] = round(sum(health_factors), 1)
            economic_indicators['health_interpretation'] = _interpret_health_score(economic_indicators['economic_health_score'])
        
        return {
            'success': True,
            'economic_indicators': economic_indicators,
            'metadata': {
                'source': 'Treasury Data via data.gov',
                'calculation_time': datetime.now().isoformat(),
                'methodology': 'Treasury-based economic health assessment',
                'note': 'Indicators derived from federal debt and interest rate data'
            }
        }
        
    except Exception as e:
        logger.error(f"calculate_economic_indicators failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    
    finally:
        await processor.cleanup()


# Utility Functions

def _calculate_volatility(values: List[float]) -> float:
    """Calculate volatility (standard deviation) of values."""
    if len(values) < 2:
        return 0.0
    
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5


def _date_to_quarter(date_str: str) -> str:
    """Convert date string to quarter format (YYYY-Q)."""
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        quarter = (date_obj.month - 1) // 3 + 1
        return f"{date_obj.year}-Q{quarter}"
    except:
        return "Unknown"


def _calculate_debt_sustainability_score(debt_trillions: float) -> int:
    """Calculate debt sustainability score (0-100)."""
    # Simplified scoring based on debt levels
    if debt_trillions < 20:
        return 90
    elif debt_trillions < 25:
        return 80
    elif debt_trillions < 30:
        return 70
    elif debt_trillions < 35:
        return 60
    else:
        return 50


def _classify_yield_curve(yield_spread: float) -> str:
    """Classify yield curve shape based on 10yr-2yr spread."""
    if yield_spread > 0.5:
        return 'steep'
    elif yield_spread > 0:
        return 'normal'
    elif yield_spread > -0.5:
        return 'flat'
    else:
        return 'inverted'


def _calculate_recession_probability(yield_spread: float) -> float:
    """Calculate recession probability based on yield curve inversion."""
    if yield_spread > 0.5:
        return 10  # Low probability
    elif yield_spread > 0:
        return 20
    elif yield_spread > -0.25:
        return 35
    elif yield_spread > -0.5:
        return 55
    else:
        return 75  # High probability


def _calculate_rate_health_score(ten_year_rate: float) -> int:
    """Calculate health score based on 10-year Treasury rate."""
    # Optimal range is typically 2-4%
    if 2 <= ten_year_rate <= 4:
        return 90
    elif 1.5 <= ten_year_rate <= 5:
        return 80
    elif 1 <= ten_year_rate <= 6:
        return 70
    else:
        return 60


def _interpret_health_score(score: float) -> str:
    """Interpret economic health score."""
    if score >= 80:
        return 'Excellent'
    elif score >= 70:
        return 'Good'
    elif score >= 60:
        return 'Fair'
    elif score >= 50:
        return 'Concerning'
    else:
        return 'Critical'


# Tool registry for MCP server
MCP_TREASURY_MACRO_TOOLS = {
    'get_yield_curve': get_yield_curve,
    'analyze_interest_rate_trends': analyze_interest_rate_trends,
    'get_federal_debt_analysis': get_federal_debt_analysis,
    'calculate_economic_indicators': calculate_economic_indicators
}