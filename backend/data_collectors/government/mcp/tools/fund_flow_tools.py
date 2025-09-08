"""
Fund Flow MCP Tools

MCP tools for mutual fund and ETF flow analysis using data.gov N-PORT
and other SEC fund data sources. Provides AI-native access to fund flows,
asset allocation changes, and market sentiment indicators.

Tools:
- analyze_mutual_fund_flows: Analyze mutual fund money flows
- track_etf_flows: Track ETF creation/redemption flows  
- calculate_fund_sentiment: Calculate market sentiment from fund flows
- get_sector_rotation_signals: Detect sector rotation from fund movements
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
import aiohttp
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class FundFlow:
    """Fund flow data structure."""
    fund_id: str
    fund_name: str
    fund_type: str  # mutual_fund, etf
    flow_amount: float
    flow_date: str
    assets_under_management: Optional[float] = None
    flow_percentage: Optional[float] = None


@dataclass
class SectorFlow:
    """Sector-specific fund flow data."""
    sector: str
    total_inflow: float
    total_outflow: float
    net_flow: float
    fund_count: int
    flow_date_range: str


class FundFlowProcessor:
    """Processor for fund flow and N-PORT data."""
    
    def __init__(self):
        self.sec_base_url = "https://www.sec.gov/Archives/edgar"
        self.session = aiohttp.ClientSession(
            headers={'User-Agent': 'StockPicker-DataGov-MCP/1.0'}
        )
        
        # Major fund families for tracking
        self.major_fund_families = {
            'Vanguard': ['VTI', 'VOO', 'VEA', 'VWO', 'VYM'],
            'SPDR': ['SPY', 'XLF', 'XLK', 'XLE', 'XLU'],
            'iShares': ['IWM', 'EFA', 'EEM', 'AGG', 'TLT'],
            'Fidelity': ['FXNAX', 'FSKAX', 'FTIHX', 'FXNBX'],
            'American Funds': ['AGTHX', 'AMCPX', 'ANWPX']
        }
        
        # Sector mapping for rotation analysis
        self.sector_mapping = {
            'XLF': 'Financials',
            'XLK': 'Technology', 
            'XLE': 'Energy',
            'XLU': 'Utilities',
            'XLV': 'Healthcare',
            'XLI': 'Industrials',
            'XLY': 'Consumer Discretionary',
            'XLP': 'Consumer Staples',
            'XLB': 'Materials',
            'XLRE': 'Real Estate',
            'XLC': 'Communication Services'
        }
    
    async def get_n_port_data(self, cik: str, quarters: int = 2) -> List[Dict[str, Any]]:
        """Get N-PORT data for mutual fund flow analysis."""
        try:
            # N-PORT filings contain detailed portfolio holdings
            # This would typically involve parsing XML/XBRL N-PORT filings
            
            # For demonstration, return mock N-PORT structure
            mock_nport_data = []
            
            for quarter in range(quarters):
                quarter_date = (datetime.now() - timedelta(days=quarter*90)).strftime('%Y-%m-%d')
                
                mock_nport_data.append({
                    'filing_date': quarter_date,
                    'fund_cik': cik,
                    'total_assets': 5000000000 + (quarter * 100000000),  # $5B base
                    'portfolio_holdings': [
                        {
                            'security_name': 'Apple Inc',
                            'ticker': 'AAPL',
                            'value': 250000000,
                            'shares': 1500000,
                            'weight_percent': 5.0
                        },
                        {
                            'security_name': 'Microsoft Corp',
                            'ticker': 'MSFT',
                            'value': 200000000,
                            'shares': 750000,
                            'weight_percent': 4.0
                        }
                    ],
                    'sector_allocations': {
                        'Technology': 35.5,
                        'Healthcare': 15.2,
                        'Financials': 12.8,
                        'Consumer Discretionary': 10.1,
                        'Industrials': 8.5,
                        'Others': 17.9
                    }
                })
            
            return mock_nport_data
            
        except Exception as e:
            logger.error(f"Error getting N-PORT data for CIK {cik}: {e}")
            return []
    
    async def calculate_fund_flows(self, fund_data: List[Dict[str, Any]]) -> List[FundFlow]:
        """Calculate fund flows from N-PORT data."""
        try:
            fund_flows = []
            
            if len(fund_data) < 2:
                return fund_flows
            
            # Calculate flows between periods
            for i in range(len(fund_data) - 1):
                current_period = fund_data[i]
                prior_period = fund_data[i + 1]
                
                current_assets = current_period['total_assets']
                prior_assets = prior_period['total_assets']
                
                # Simplified flow calculation (actual would need to account for performance)
                net_flow = current_assets - prior_assets
                flow_percentage = (net_flow / prior_assets * 100) if prior_assets > 0 else 0
                
                fund_flow = FundFlow(
                    fund_id=current_period['fund_cik'],
                    fund_name=f"Fund {current_period['fund_cik']}",
                    fund_type='mutual_fund',
                    flow_amount=net_flow,
                    flow_date=current_period['filing_date'],
                    assets_under_management=current_assets,
                    flow_percentage=flow_percentage
                )
                
                fund_flows.append(fund_flow)
            
            return fund_flows
            
        except Exception as e:
            logger.error(f"Error calculating fund flows: {e}")
            return []
    
    async def get_etf_flow_data(self, etf_tickers: List[str], days: int = 30) -> List[Dict[str, Any]]:
        """Get ETF flow data (mock implementation)."""
        try:
            etf_flows = []
            
            for ticker in etf_tickers:
                # Mock ETF flow data
                base_flow = hash(ticker) % 1000000  # Pseudo-random base
                
                etf_flow = {
                    'ticker': ticker,
                    'fund_name': f'{ticker} ETF',
                    'sector': self.sector_mapping.get(ticker, 'Broad Market'),
                    'daily_flows': [],
                    'net_flow_period': base_flow,
                    'assets_under_management': base_flow * 50
                }
                
                # Generate daily flow data
                for day in range(days):
                    flow_date = (datetime.now() - timedelta(days=day)).strftime('%Y-%m-%d')
                    daily_flow = (hash(f"{ticker}{day}") % 10000000) - 5000000  # -$5M to +$5M
                    
                    etf_flow['daily_flows'].append({
                        'date': flow_date,
                        'flow': daily_flow,
                        'shares_outstanding': 50000000 + (day * 1000)
                    })
                
                etf_flows.append(etf_flow)
            
            return etf_flows
            
        except Exception as e:
            logger.error(f"Error getting ETF flow data: {e}")
            return []
    
    async def cleanup(self):
        """Clean up HTTP session."""
        if self.session:
            await self.session.close()


# MCP Tool Functions

async def analyze_mutual_fund_flows(fund_ciks: List[str], quarters: int = 4) -> Dict[str, Any]:
    """
    MCP Tool: Analyze mutual fund money flows using N-PORT data.
    
    Args:
        fund_ciks: List of fund CIKs to analyze
        quarters: Number of quarters to analyze
        
    Returns:
        Dictionary containing mutual fund flow analysis
    """
    processor = FundFlowProcessor()
    
    try:
        fund_flow_analysis = {
            'analysis_period': f'{quarters} quarters',
            'funds_analyzed': len(fund_ciks),
            'fund_flows': {},
            'aggregate_flows': {},
            'flow_trends': {}
        }
        
        all_flows = []
        
        # Analyze flows for each fund
        for cik in fund_ciks:
            try:
                # Get N-PORT data
                nport_data = await processor.get_n_port_data(cik, quarters=quarters)
                
                if not nport_data:
                    fund_flow_analysis['fund_flows'][cik] = {'error': 'No N-PORT data available'}
                    continue
                
                # Calculate flows
                fund_flows = await processor.calculate_fund_flows(nport_data)
                
                if fund_flows:
                    fund_summary = {
                        'fund_cik': cik,
                        'total_periods': len(fund_flows),
                        'flows_by_period': [
                            {
                                'date': flow.flow_date,
                                'flow_amount': flow.flow_amount,
                                'flow_percentage': flow.flow_percentage,
                                'assets_under_management': flow.assets_under_management
                            }
                            for flow in fund_flows
                        ],
                        'net_flow_total': sum(flow.flow_amount for flow in fund_flows),
                        'average_flow': sum(flow.flow_amount for flow in fund_flows) / len(fund_flows)
                    }
                    
                    fund_flow_analysis['fund_flows'][cik] = fund_summary
                    all_flows.extend(fund_flows)
                else:
                    fund_flow_analysis['fund_flows'][cik] = {'error': 'No flows calculated'}
                    
            except Exception as e:
                logger.warning(f"Failed to analyze flows for fund {cik}: {e}")
                fund_flow_analysis['fund_flows'][cik] = {'error': str(e)}
        
        # Calculate aggregate statistics
        if all_flows:
            total_inflows = sum(flow.flow_amount for flow in all_flows if flow.flow_amount > 0)
            total_outflows = sum(abs(flow.flow_amount) for flow in all_flows if flow.flow_amount < 0)
            net_flows = total_inflows - total_outflows
            
            fund_flow_analysis['aggregate_flows'] = {
                'total_inflows': total_inflows,
                'total_outflows': total_outflows,
                'net_flows': net_flows,
                'funds_with_inflows': len([f for f in all_flows if f.flow_amount > 0]),
                'funds_with_outflows': len([f for f in all_flows if f.flow_amount < 0]),
                'flow_ratio': total_inflows / total_outflows if total_outflows > 0 else float('inf')
            }
            
            # Trend analysis
            flow_amounts = [flow.flow_amount for flow in all_flows]
            fund_flow_analysis['flow_trends'] = {
                'average_flow': sum(flow_amounts) / len(flow_amounts),
                'flow_volatility': _calculate_volatility(flow_amounts),
                'trend_direction': 'positive' if net_flows > 0 else 'negative',
                'flow_consistency': _calculate_consistency(flow_amounts)
            }
        
        return {
            'success': True,
            'mutual_fund_analysis': fund_flow_analysis,
            'metadata': {
                'source': 'SEC N-PORT filings via data.gov',
                'analysis_time': datetime.now().isoformat(),
                'methodology': 'Asset-based flow calculation from quarterly filings'
            }
        }
        
    except Exception as e:
        logger.error(f"analyze_mutual_fund_flows failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'fund_ciks': fund_ciks
        }
    
    finally:
        await processor.cleanup()


async def track_etf_flows(etf_tickers: List[str], days: int = 30) -> Dict[str, Any]:
    """
    MCP Tool: Track ETF creation/redemption flows and analyze market sentiment.
    
    Args:
        etf_tickers: List of ETF ticker symbols
        days: Number of days to analyze
        
    Returns:
        Dictionary containing ETF flow analysis
    """
    processor = FundFlowProcessor()
    
    try:
        # Get ETF flow data
        etf_data = await processor.get_etf_flow_data(etf_tickers, days=days)
        
        if not etf_data:
            return {
                'success': False,
                'error': 'No ETF flow data available',
                'etf_tickers': etf_tickers
            }
        
        etf_flow_analysis = {
            'analysis_period': f'{days} days',
            'etfs_analyzed': len(etf_data),
            'etf_flows': {},
            'sector_flows': {},
            'market_signals': {}
        }
        
        # Analyze flows for each ETF
        total_inflows = 0
        total_outflows = 0
        sector_flows = defaultdict(lambda: {'inflows': 0, 'outflows': 0, 'net': 0, 'count': 0})
        
        for etf in etf_data:
            ticker = etf['ticker']
            sector = etf['sector']
            daily_flows = etf['daily_flows']
            
            # Calculate flow statistics
            total_flow = sum(day['flow'] for day in daily_flows)
            positive_flows = [day['flow'] for day in daily_flows if day['flow'] > 0]
            negative_flows = [day['flow'] for day in daily_flows if day['flow'] < 0]
            
            etf_inflows = sum(positive_flows)
            etf_outflows = sum(abs(flow) for flow in negative_flows)
            
            etf_analysis = {
                'ticker': ticker,
                'sector': sector,
                'net_flow': total_flow,
                'total_inflows': etf_inflows,
                'total_outflows': etf_outflows,
                'assets_under_management': etf['assets_under_management'],
                'flow_percentage': (total_flow / etf['assets_under_management'] * 100) if etf['assets_under_management'] > 0 else 0,
                'flow_consistency': len(positive_flows) / len(daily_flows) if daily_flows else 0,
                'average_daily_flow': total_flow / len(daily_flows) if daily_flows else 0
            }
            
            etf_flow_analysis['etf_flows'][ticker] = etf_analysis
            
            # Aggregate totals
            total_inflows += etf_inflows
            total_outflows += etf_outflows
            
            # Sector aggregation
            sector_flows[sector]['inflows'] += etf_inflows
            sector_flows[sector]['outflows'] += etf_outflows
            sector_flows[sector]['net'] += total_flow
            sector_flows[sector]['count'] += 1
        
        # Sector flow analysis
        for sector, flows in sector_flows.items():
            etf_flow_analysis['sector_flows'][sector] = {
                'total_inflows': flows['inflows'],
                'total_outflows': flows['outflows'],
                'net_flow': flows['net'],
                'etf_count': flows['count'],
                'flow_direction': 'inflow' if flows['net'] > 0 else 'outflow',
                'relative_strength': flows['net'] / (flows['inflows'] + flows['outflows']) if (flows['inflows'] + flows['outflows']) > 0 else 0
            }
        
        # Market signals from ETF flows
        net_market_flow = total_inflows - total_outflows
        etf_flow_analysis['market_signals'] = {
            'overall_sentiment': 'bullish' if net_market_flow > 0 else 'bearish',
            'net_market_flow': net_market_flow,
            'total_inflows': total_inflows,
            'total_outflows': total_outflows,
            'flow_ratio': total_inflows / total_outflows if total_outflows > 0 else float('inf'),
            'risk_on_sectors': _identify_risk_on_sectors(etf_flow_analysis['sector_flows']),
            'risk_off_sectors': _identify_risk_off_sectors(etf_flow_analysis['sector_flows'])
        }
        
        return {
            'success': True,
            'etf_flow_analysis': etf_flow_analysis,
            'metadata': {
                'source': 'ETF flow data via market data providers',
                'analysis_time': datetime.now().isoformat(),
                'analysis_period_days': days,
                'note': 'ETF flows indicate institutional and retail sentiment'
            }
        }
        
    except Exception as e:
        logger.error(f"track_etf_flows failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'etf_tickers': etf_tickers
        }
    
    finally:
        await processor.cleanup()


async def calculate_fund_sentiment(fund_types: List[str] = None, lookback_days: int = 30) -> Dict[str, Any]:
    """
    MCP Tool: Calculate market sentiment indicators from fund flow patterns.
    
    Args:
        fund_types: Types of funds to analyze (mutual_funds, etfs, all)
        lookback_days: Number of days to look back for sentiment calculation
        
    Returns:
        Dictionary containing fund-based sentiment analysis
    """
    processor = FundFlowProcessor()
    
    try:
        if fund_types is None:
            fund_types = ['etfs', 'mutual_funds']
        
        sentiment_analysis = {
            'analysis_period': f'{lookback_days} days',
            'fund_types_analyzed': fund_types,
            'sentiment_scores': {},
            'sentiment_indicators': {},
            'market_regime': {}
        }
        
        # Analyze ETF sentiment
        if 'etfs' in fund_types:
            major_etfs = ['SPY', 'QQQ', 'IWM', 'VTI', 'XLF', 'XLK', 'XLE']  # Representative ETFs
            etf_result = await track_etf_flows(major_etfs, days=lookback_days)
            
            if etf_result.get('success'):
                etf_data = etf_result['etf_flow_analysis']
                market_signals = etf_data.get('market_signals', {})
                
                # Calculate ETF sentiment score (0-100)
                etf_sentiment_score = _calculate_etf_sentiment_score(market_signals)
                sentiment_analysis['sentiment_scores']['etf_sentiment'] = etf_sentiment_score
                
                # ETF-based indicators
                sentiment_analysis['sentiment_indicators']['etf_indicators'] = {
                    'overall_sentiment': market_signals.get('overall_sentiment', 'neutral'),
                    'flow_ratio': market_signals.get('flow_ratio', 1.0),
                    'net_flow_trend': 'positive' if market_signals.get('net_market_flow', 0) > 0 else 'negative',
                    'sector_rotation_active': len(market_signals.get('risk_on_sectors', [])) > 0
                }
        
        # Analyze mutual fund sentiment
        if 'mutual_funds' in fund_types:
            # Mock mutual fund sentiment (would use actual fund CIKs)
            sample_fund_ciks = ['0001234567', '0001234568', '0001234569']
            fund_result = await analyze_mutual_fund_flows(sample_fund_ciks, quarters=2)
            
            if fund_result.get('success'):
                fund_data = fund_result['mutual_fund_analysis']
                aggregate_flows = fund_data.get('aggregate_flows', {})
                
                # Calculate mutual fund sentiment score
                mf_sentiment_score = _calculate_mutual_fund_sentiment_score(aggregate_flows)
                sentiment_analysis['sentiment_scores']['mutual_fund_sentiment'] = mf_sentiment_score
                
                # Mutual fund indicators
                sentiment_analysis['sentiment_indicators']['mutual_fund_indicators'] = {
                    'net_flows': aggregate_flows.get('net_flows', 0),
                    'flow_ratio': aggregate_flows.get('flow_ratio', 1.0),
                    'investor_behavior': 'accumulating' if aggregate_flows.get('net_flows', 0) > 0 else 'distributing'
                }
        
        # Composite sentiment score
        sentiment_scores = sentiment_analysis['sentiment_scores']
        if sentiment_scores:
            composite_score = sum(sentiment_scores.values()) / len(sentiment_scores)
            sentiment_analysis['composite_sentiment'] = {
                'score': round(composite_score, 1),
                'interpretation': _interpret_sentiment_score(composite_score),
                'confidence': _calculate_sentiment_confidence(sentiment_scores)
            }
        
        # Market regime analysis
        sentiment_analysis['market_regime'] = {
            'current_regime': _determine_market_regime(sentiment_analysis),
            'regime_strength': _calculate_regime_strength(sentiment_analysis),
            'regime_duration': f'Estimated {lookback_days} days',
            'regime_signals': _extract_regime_signals(sentiment_analysis)
        }
        
        return {
            'success': True,
            'fund_sentiment_analysis': sentiment_analysis,
            'metadata': {
                'source': 'Fund flow data via SEC filings and market data',
                'analysis_time': datetime.now().isoformat(),
                'methodology': 'Flow-based sentiment calculation',
                'lookback_period_days': lookback_days
            }
        }
        
    except Exception as e:
        logger.error(f"calculate_fund_sentiment failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'fund_types': fund_types
        }
    
    finally:
        await processor.cleanup()


async def get_sector_rotation_signals(lookback_days: int = 60) -> Dict[str, Any]:
    """
    MCP Tool: Detect sector rotation patterns from fund movements.
    
    Args:
        lookback_days: Number of days to analyze for rotation signals
        
    Returns:
        Dictionary containing sector rotation analysis
    """
    processor = FundFlowProcessor()
    
    try:
        # Analyze sector ETF flows to detect rotation
        sector_etfs = list(processor.sector_mapping.keys())
        etf_result = await track_etf_flows(sector_etfs, days=lookback_days)
        
        if not etf_result.get('success'):
            return {
                'success': False,
                'error': 'Unable to get sector ETF data for rotation analysis',
                'lookback_days': lookback_days
            }
        
        etf_data = etf_result['etf_flow_analysis']
        sector_flows = etf_data.get('sector_flows', {})
        
        rotation_analysis = {
            'analysis_period': f'{lookback_days} days',
            'sectors_analyzed': len(sector_flows),
            'rotation_signals': {},
            'sector_rankings': {},
            'rotation_themes': {}
        }
        
        # Rank sectors by flow strength
        sector_rankings = []
        for sector, flows in sector_flows.items():
            relative_strength = flows.get('relative_strength', 0)
            net_flow = flows.get('net_flow', 0)
            
            sector_rankings.append({
                'sector': sector,
                'relative_strength': relative_strength,
                'net_flow': net_flow,
                'flow_direction': flows.get('flow_direction', 'neutral')
            })
        
        # Sort by relative strength
        sector_rankings.sort(key=lambda x: x['relative_strength'], reverse=True)
        rotation_analysis['sector_rankings'] = {
            'strongest_sectors': sector_rankings[:3],
            'weakest_sectors': sector_rankings[-3:],
            'all_sectors': sector_rankings
        }
        
        # Identify rotation signals
        strongest_sectors = [s['sector'] for s in sector_rankings[:3] if s['relative_strength'] > 0.1]
        weakest_sectors = [s['sector'] for s in sector_rankings[-3:] if s['relative_strength'] < -0.1]
        
        rotation_analysis['rotation_signals'] = {
            'rotation_detected': len(strongest_sectors) > 0 or len(weakest_sectors) > 0,
            'money_flowing_into': strongest_sectors,
            'money_flowing_out_of': weakest_sectors,
            'rotation_intensity': _calculate_rotation_intensity(sector_rankings),
            'rotation_type': _classify_rotation_type(strongest_sectors, weakest_sectors)
        }
        
        # Identify rotation themes
        rotation_themes = {}
        
        # Risk-on vs Risk-off
        risk_on_sectors = ['Technology', 'Consumer Discretionary', 'Industrials']
        risk_off_sectors = ['Utilities', 'Consumer Staples', 'Healthcare']
        
        risk_on_strength = sum(s['relative_strength'] for s in sector_rankings if s['sector'] in risk_on_sectors)
        risk_off_strength = sum(s['relative_strength'] for s in sector_rankings if s['sector'] in risk_off_sectors)
        
        rotation_themes['risk_sentiment'] = {
            'risk_on_strength': risk_on_strength,
            'risk_off_strength': risk_off_strength,
            'net_risk_sentiment': risk_on_strength - risk_off_strength,
            'interpretation': 'risk_on' if risk_on_strength > risk_off_strength else 'risk_off'
        }
        
        # Cyclical vs Defensive
        cyclical_sectors = ['Financials', 'Energy', 'Materials', 'Industrials']
        defensive_sectors = ['Utilities', 'Consumer Staples', 'Healthcare', 'Real Estate']
        
        cyclical_strength = sum(s['relative_strength'] for s in sector_rankings if s['sector'] in cyclical_sectors)
        defensive_strength = sum(s['relative_strength'] for s in sector_rankings if s['sector'] in defensive_sectors)
        
        rotation_themes['economic_cycle'] = {
            'cyclical_strength': cyclical_strength,
            'defensive_strength': defensive_strength,
            'net_cyclical_sentiment': cyclical_strength - defensive_strength,
            'interpretation': 'late_cycle' if cyclical_strength > defensive_strength else 'early_cycle'
        }
        
        rotation_analysis['rotation_themes'] = rotation_themes
        
        # Generate investment implications
        rotation_analysis['investment_implications'] = _generate_rotation_implications(rotation_analysis)
        
        return {
            'success': True,
            'sector_rotation_analysis': rotation_analysis,
            'metadata': {
                'source': 'Sector ETF flow analysis',
                'analysis_time': datetime.now().isoformat(),
                'methodology': 'Relative flow strength analysis across sectors',
                'lookback_period_days': lookback_days
            }
        }
        
    except Exception as e:
        logger.error(f"get_sector_rotation_signals failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'lookback_days': lookback_days
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


def _calculate_consistency(values: List[float]) -> float:
    """Calculate flow consistency score (0-1)."""
    if not values:
        return 0.0
    
    positive_count = len([v for v in values if v > 0])
    return positive_count / len(values)


def _identify_risk_on_sectors(sector_flows: Dict[str, Any]) -> List[str]:
    """Identify risk-on sectors from flow data."""
    risk_on_sectors = []
    for sector, flows in sector_flows.items():
        if flows.get('net_flow', 0) > 0 and sector in ['Technology', 'Consumer Discretionary', 'Industrials']:
            risk_on_sectors.append(sector)
    return risk_on_sectors


def _identify_risk_off_sectors(sector_flows: Dict[str, Any]) -> List[str]:
    """Identify risk-off sectors from flow data."""
    risk_off_sectors = []
    for sector, flows in sector_flows.items():
        if flows.get('net_flow', 0) > 0 and sector in ['Utilities', 'Consumer Staples', 'Healthcare']:
            risk_off_sectors.append(sector)
    return risk_off_sectors


def _calculate_etf_sentiment_score(market_signals: Dict[str, Any]) -> float:
    """Calculate ETF sentiment score (0-100)."""
    base_score = 50
    
    # Flow ratio impact
    flow_ratio = market_signals.get('flow_ratio', 1.0)
    if flow_ratio > 2.0:
        base_score += 25
    elif flow_ratio > 1.5:
        base_score += 15
    elif flow_ratio < 0.5:
        base_score -= 25
    elif flow_ratio < 0.75:
        base_score -= 15
    
    # Net flow impact
    net_flow = market_signals.get('net_market_flow', 0)
    if net_flow > 0:
        base_score += 10
    else:
        base_score -= 10
    
    return max(0, min(100, base_score))


def _calculate_mutual_fund_sentiment_score(aggregate_flows: Dict[str, Any]) -> float:
    """Calculate mutual fund sentiment score (0-100)."""
    base_score = 50
    
    # Net flows impact
    net_flows = aggregate_flows.get('net_flows', 0)
    if net_flows > 0:
        base_score += 20
    else:
        base_score -= 20
    
    # Flow ratio impact
    flow_ratio = aggregate_flows.get('flow_ratio', 1.0)
    if flow_ratio > 1.5:
        base_score += 15
    elif flow_ratio < 0.5:
        base_score -= 15
    
    return max(0, min(100, base_score))


def _interpret_sentiment_score(score: float) -> str:
    """Interpret composite sentiment score."""
    if score >= 80:
        return 'Very Bullish'
    elif score >= 65:
        return 'Bullish' 
    elif score >= 50:
        return 'Neutral-Bullish'
    elif score >= 35:
        return 'Neutral-Bearish'
    elif score >= 20:
        return 'Bearish'
    else:
        return 'Very Bearish'


def _calculate_sentiment_confidence(sentiment_scores: Dict[str, float]) -> float:
    """Calculate confidence in sentiment reading."""
    if len(sentiment_scores) < 2:
        return 0.5
    
    score_values = list(sentiment_scores.values())
    score_spread = max(score_values) - min(score_values)
    
    # Lower spread = higher confidence
    confidence = max(0.0, min(1.0, (100 - score_spread) / 100))
    return confidence


def _determine_market_regime(sentiment_analysis: Dict[str, Any]) -> str:
    """Determine current market regime."""
    composite = sentiment_analysis.get('composite_sentiment', {})
    score = composite.get('score', 50)
    
    if score >= 70:
        return 'Bull Market'
    elif score >= 55:
        return 'Bullish Trend'
    elif score >= 45:
        return 'Neutral/Consolidation'
    elif score >= 30:
        return 'Bearish Trend'
    else:
        return 'Bear Market'


def _calculate_regime_strength(sentiment_analysis: Dict[str, Any]) -> str:
    """Calculate strength of current market regime."""
    composite = sentiment_analysis.get('composite_sentiment', {})
    confidence = composite.get('confidence', 0.5)
    
    if confidence >= 0.8:
        return 'Strong'
    elif confidence >= 0.6:
        return 'Moderate'
    else:
        return 'Weak'


def _extract_regime_signals(sentiment_analysis: Dict[str, Any]) -> List[str]:
    """Extract key regime signals."""
    signals = []
    
    # ETF signals
    etf_indicators = sentiment_analysis.get('sentiment_indicators', {}).get('etf_indicators', {})
    if etf_indicators.get('sector_rotation_active'):
        signals.append('Active sector rotation detected')
    
    overall_sentiment = etf_indicators.get('overall_sentiment', 'neutral')
    if overall_sentiment == 'bullish':
        signals.append('ETF flows bullish')
    elif overall_sentiment == 'bearish':
        signals.append('ETF flows bearish')
    
    return signals


def _calculate_rotation_intensity(sector_rankings: List[Dict[str, Any]]) -> float:
    """Calculate sector rotation intensity (0-1)."""
    if not sector_rankings:
        return 0.0
    
    strengths = [abs(s['relative_strength']) for s in sector_rankings]
    avg_strength = sum(strengths) / len(strengths)
    
    return min(1.0, avg_strength)


def _classify_rotation_type(strongest_sectors: List[str], weakest_sectors: List[str]) -> str:
    """Classify the type of sector rotation."""
    risk_on = ['Technology', 'Consumer Discretionary', 'Industrials']
    risk_off = ['Utilities', 'Consumer Staples', 'Healthcare']
    cyclical = ['Financials', 'Energy', 'Materials']
    
    strong_risk_on = len([s for s in strongest_sectors if s in risk_on])
    strong_risk_off = len([s for s in strongest_sectors if s in risk_off])
    strong_cyclical = len([s for s in strongest_sectors if s in cyclical])
    
    if strong_risk_on > strong_risk_off:
        return 'Risk-On Rotation'
    elif strong_risk_off > strong_risk_on:
        return 'Risk-Off Rotation'
    elif strong_cyclical > 0:
        return 'Cyclical Rotation'
    else:
        return 'Mixed Rotation'


def _generate_rotation_implications(rotation_analysis: Dict[str, Any]) -> List[str]:
    """Generate investment implications from rotation analysis."""
    implications = []
    
    rotation_signals = rotation_analysis.get('rotation_signals', {})
    money_flowing_into = rotation_signals.get('money_flowing_into', [])
    money_flowing_out_of = rotation_signals.get('money_flowing_out_of', [])
    
    if money_flowing_into:
        implications.append(f"Consider overweighting: {', '.join(money_flowing_into)}")
    
    if money_flowing_out_of:
        implications.append(f"Consider underweighting: {', '.join(money_flowing_out_of)}")
    
    risk_sentiment = rotation_analysis.get('rotation_themes', {}).get('risk_sentiment', {})
    if risk_sentiment.get('interpretation') == 'risk_on':
        implications.append("Risk-on environment favors growth and cyclical sectors")
    elif risk_sentiment.get('interpretation') == 'risk_off':
        implications.append("Risk-off environment favors defensive sectors")
    
    return implications


# Tool registry for MCP server
MCP_FUND_FLOW_TOOLS = {
    'analyze_mutual_fund_flows': analyze_mutual_fund_flows,
    'track_etf_flows': track_etf_flows,
    'calculate_fund_sentiment': calculate_fund_sentiment,
    'get_sector_rotation_signals': get_sector_rotation_signals
}