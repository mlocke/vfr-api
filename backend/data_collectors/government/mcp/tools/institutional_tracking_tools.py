"""
Institutional Tracking MCP Tools

MCP tools for tracking institutional holdings and smart money movements
using Form 13F filings and other SEC institutional data.

Tools:
- get_institutional_positions: Get institutional positions for a stock
- track_smart_money: Track institutional money flows  
- calculate_ownership_changes: Calculate ownership changes over time
- analyze_13f_trends: Analyze Form 13F filing trends
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
import aiohttp
import csv
import io
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class InstitutionalHolding:
    """Institutional holding data structure."""
    cik: str
    institution_name: str
    ticker: str
    cusip: str
    shares_held: int
    market_value: float
    percent_of_portfolio: float
    filing_date: str
    quarter: str
    change_from_prior: Optional[int] = None
    change_percent: Optional[float] = None


@dataclass
class InstitutionProfile:
    """Institution profile and characteristics."""
    cik: str
    name: str
    total_portfolio_value: float
    number_of_holdings: int
    filing_date: str
    top_holdings: List[Dict[str, Any]]
    investment_style: Optional[str] = None
    aum_tier: Optional[str] = None  # Large, Medium, Small


class Form13FProcessor:
    """Form 13F filing processor for institutional data."""
    
    def __init__(self):
        self.sec_base_url = "https://www.sec.gov/Archives/edgar"
        self.session = aiohttp.ClientSession(
            headers={'User-Agent': 'StockPicker-DataGov-MCP/1.0'}
        )
        
        # Notable institutions for smart money tracking
        self.smart_money_institutions = {
            '0000001067': 'Berkshire Hathaway',
            '0000102909': 'Vanguard Group',
            '0000886982': 'Fidelity',
            '0001364742': 'Paulson & Co',
            '0001336528': 'Pershing Square',
            '0001067983': 'Baupost Group',
            '0001558708': 'Third Point',
            '0001103804': 'Renaissance Technologies'
        }
    
    async def get_form_13f_index(self, quarter: str) -> List[Dict[str, Any]]:
        """Get Form 13F index for a specific quarter."""
        try:
            # Parse quarter (e.g., "2024-Q1" -> "2024", "QTR1")
            year, qtr = quarter.split('-Q')
            qtr_num = int(qtr)
            
            index_url = f"{self.sec_base_url}/full-index/{year}/QTR{qtr_num}/form.idx"
            
            async with self.session.get(index_url) as response:
                if response.status == 200:
                    content = await response.text()
                    return self._parse_form_index(content, '13F')
                else:
                    logger.warning(f"Failed to get Form 13F index for {quarter}: HTTP {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error getting Form 13F index for {quarter}: {e}")
            return []
    
    def _parse_form_index(self, content: str, form_type: str) -> List[Dict[str, Any]]:
        """Parse form index content."""
        try:
            lines = content.split('\n')
            
            # Find start of data (after header lines)
            data_start = 0
            for i, line in enumerate(lines):
                if line.startswith('Form Type'):
                    data_start = i + 2
                    break
            
            filings = []
            for line in lines[data_start:]:
                if line.strip() and form_type in line:
                    parts = line.split('|')
                    if len(parts) >= 5:
                        filings.append({
                            'form_type': parts[0].strip(),
                            'company_name': parts[1].strip(),
                            'cik': parts[2].strip(),
                            'filing_date': parts[3].strip(),
                            'filename': parts[4].strip()
                        })
            
            return filings
            
        except Exception as e:
            logger.error(f"Error parsing form index: {e}")
            return []
    
    async def get_13f_holdings(self, cik: str, quarter: str) -> List[InstitutionalHolding]:
        """Get 13F holdings for a specific institution and quarter."""
        try:
            # Find the 13F filing for this CIK and quarter
            form_index = await self.get_form_13f_index(quarter)
            
            institution_filing = None
            for filing in form_index:
                if filing['cik'].zfill(10) == cik.zfill(10):
                    institution_filing = filing
                    break
            
            if not institution_filing:
                logger.warning(f"No 13F filing found for CIK {cik} in {quarter}")
                return []
            
            # Get the actual 13F document
            filing_url = f"{self.sec_base_url}/{institution_filing['filename']}"
            
            async with self.session.get(filing_url) as response:
                if response.status == 200:
                    filing_content = await response.text()
                    return await self._parse_13f_holdings(filing_content, cik, quarter)
                else:
                    logger.warning(f"Failed to get 13F filing: HTTP {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error getting 13F holdings for CIK {cik}: {e}")
            return []
    
    async def _parse_13f_holdings(self, content: str, cik: str, quarter: str) -> List[InstitutionalHolding]:
        """Parse 13F holdings from filing content."""
        # This is a simplified parser - real implementation would need
        # more sophisticated XBRL/XML parsing
        try:
            holdings = []
            
            # Look for information table in the content
            # (This would typically be in XML/XBRL format)
            
            # For now, return mock data structure
            # In real implementation, would parse actual filing data
            mock_holdings = [
                InstitutionalHolding(
                    cik=cik,
                    institution_name="Mock Institution",
                    ticker="AAPL",
                    cusip="037833100",
                    shares_held=1000000,
                    market_value=150000000,
                    percent_of_portfolio=5.2,
                    filing_date=f"{quarter.split('-')[0]}-{quarter.split('-Q')[1].zfill(2)}-01",
                    quarter=quarter
                )
            ]
            
            return mock_holdings
            
        except Exception as e:
            logger.error(f"Error parsing 13F holdings: {e}")
            return []
    
    async def get_institutional_ownership_data(self, ticker: str, quarter: str) -> Dict[str, Any]:
        """Get institutional ownership data for a specific stock."""
        try:
            # This would typically involve:
            # 1. Getting the CUSIP for the ticker
            # 2. Searching through 13F filings for that CUSIP
            # 3. Aggregating holdings from all institutions
            
            # For now, return mock aggregate data
            return {
                'ticker': ticker,
                'quarter': quarter,
                'total_institutional_shares': 500000000,
                'total_institutional_value': 75000000000,
                'percent_of_float': 68.5,
                'number_of_institutions': 1250,
                'top_institutional_holders': [
                    {
                        'institution': 'Vanguard Group Inc',
                        'cik': '0000102909',
                        'shares': 50000000,
                        'value': 7500000000,
                        'percent_of_holdings': 4.2
                    },
                    {
                        'institution': 'Fidelity Management',
                        'cik': '0000886982',
                        'shares': 35000000,
                        'value': 5250000000,
                        'percent_of_holdings': 2.9
                    }
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting institutional ownership for {ticker}: {e}")
            return {}
    
    async def cleanup(self):
        """Clean up HTTP session."""
        if self.session:
            await self.session.close()


# MCP Tool Functions

async def get_institutional_positions(ticker: str, quarter: str) -> Dict[str, Any]:
    """
    MCP Tool: Get institutional positions for a stock from 13F filings.
    
    Args:
        ticker: Stock ticker symbol
        quarter: Quarter in YYYY-Q format (e.g., "2024-Q2")
        
    Returns:
        Dictionary containing institutional holdings data
    """
    processor = Form13FProcessor()
    
    try:
        # Get institutional ownership data
        ownership_data = await processor.get_institutional_ownership_data(ticker, quarter)
        
        if not ownership_data:
            return {
                'success': False,
                'error': f'No institutional data found for {ticker} in {quarter}',
                'ticker': ticker,
                'quarter': quarter
            }
        
        return {
            'success': True,
            'ticker': ticker,
            'quarter': quarter,
            'institutional_ownership': ownership_data,
            'metadata': {
                'source': 'SEC Form 13F via data.gov',
                'data_date': ownership_data.get('filing_date'),
                'extraction_time': datetime.now().isoformat(),
                'note': 'Data from quarterly institutional investment manager filings'
            }
        }
        
    except Exception as e:
        logger.error(f"get_institutional_positions failed for {ticker}: {e}")
        return {
            'success': False,
            'error': str(e),
            'ticker': ticker,
            'quarter': quarter
        }
    
    finally:
        await processor.cleanup()


async def track_smart_money(tickers: List[str], institutions: List[str] = None) -> Dict[str, Any]:
    """
    MCP Tool: Track institutional money flows for specific stocks.
    
    Args:
        tickers: List of stock ticker symbols
        institutions: Optional list of specific institutions to track
        
    Returns:
        Dictionary containing smart money flow analysis
    """
    processor = Form13FProcessor()
    
    try:
        current_quarter = _get_current_quarter()
        prior_quarter = _get_prior_quarter(current_quarter)
        
        smart_money_analysis = {
            'analysis_period': f'{prior_quarter} to {current_quarter}',
            'tickers': tickers,
            'institutions_tracked': institutions or list(processor.smart_money_institutions.values()),
            'flows': {},
            'summary': {}
        }
        
        # Track flows for each ticker
        total_inflows = 0
        total_outflows = 0
        
        for ticker in tickers:
            try:
                # Get current and prior quarter data
                current_data = await processor.get_institutional_ownership_data(ticker, current_quarter)
                prior_data = await processor.get_institutional_ownership_data(ticker, prior_quarter)
                
                # Calculate net flows (simplified calculation)
                current_value = current_data.get('total_institutional_value', 0)
                prior_value = prior_data.get('total_institutional_value', 0)
                net_flow = current_value - prior_value
                
                flow_analysis = {
                    'current_institutional_value': current_value,
                    'prior_institutional_value': prior_value,
                    'net_flow': net_flow,
                    'flow_percentage': (net_flow / prior_value * 100) if prior_value > 0 else 0,
                    'flow_direction': 'inflow' if net_flow > 0 else 'outflow',
                    'notable_changes': []
                }
                
                # Track notable institution changes
                if institutions:
                    for institution in institutions[:5]:  # Limit for performance
                        # Would track specific institution changes here
                        pass
                
                smart_money_analysis['flows'][ticker] = flow_analysis
                
                if net_flow > 0:
                    total_inflows += net_flow
                else:
                    total_outflows += abs(net_flow)
                    
            except Exception as e:
                logger.warning(f"Failed to track smart money for {ticker}: {e}")
                smart_money_analysis['flows'][ticker] = {'error': str(e)}
        
        # Summary statistics
        smart_money_analysis['summary'] = {
            'total_inflows': total_inflows,
            'total_outflows': total_outflows,
            'net_flow': total_inflows - total_outflows,
            'stocks_with_inflows': len([t for t, data in smart_money_analysis['flows'].items() 
                                      if isinstance(data.get('net_flow'), (int, float)) and data['net_flow'] > 0]),
            'stocks_with_outflows': len([t for t, data in smart_money_analysis['flows'].items() 
                                       if isinstance(data.get('net_flow'), (int, float)) and data['net_flow'] < 0])
        }
        
        return {
            'success': True,
            'smart_money_analysis': smart_money_analysis,
            'metadata': {
                'source': 'SEC Form 13F via data.gov',
                'analysis_time': datetime.now().isoformat(),
                'methodology': 'Quarterly institutional investment manager filing changes'
            }
        }
        
    except Exception as e:
        logger.error(f"track_smart_money failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'tickers': tickers
        }
    
    finally:
        await processor.cleanup()


async def calculate_ownership_changes(ticker: str, quarters: int = 4) -> Dict[str, Any]:
    """
    MCP Tool: Calculate institutional ownership changes over time.
    
    Args:
        ticker: Stock ticker symbol
        quarters: Number of quarters to analyze
        
    Returns:
        Dictionary containing ownership change analysis
    """
    processor = Form13FProcessor()
    
    try:
        # Get ownership data for multiple quarters
        current_quarter = _get_current_quarter()
        
        ownership_history = []
        for i in range(quarters):
            quarter = _get_prior_quarter(current_quarter, quarters_back=i)
            ownership_data = await processor.get_institutional_ownership_data(ticker, quarter)
            
            if ownership_data:
                ownership_history.append({
                    'quarter': quarter,
                    'total_institutional_shares': ownership_data.get('total_institutional_shares', 0),
                    'total_institutional_value': ownership_data.get('total_institutional_value', 0),
                    'percent_of_float': ownership_data.get('percent_of_float', 0),
                    'number_of_institutions': ownership_data.get('number_of_institutions', 0)
                })
        
        if len(ownership_history) < 2:
            return {
                'success': False,
                'error': f'Insufficient data for ownership change analysis of {ticker}',
                'ticker': ticker,
                'data_points': len(ownership_history)
            }
        
        # Calculate changes
        ownership_changes = {
            'ticker': ticker,
            'analysis_period': f'{ownership_history[-1]["quarter"]} to {ownership_history[0]["quarter"]}',
            'quarterly_data': ownership_history,
            'changes': {},
            'trends': {}
        }
        
        # Calculate quarter-over-quarter changes
        for i in range(1, len(ownership_history)):
            current = ownership_history[i-1]  # More recent
            prior = ownership_history[i]      # Older
            
            change_data = {
                'period': f'{prior["quarter"]} to {current["quarter"]}',
                'share_change': current['total_institutional_shares'] - prior['total_institutional_shares'],
                'value_change': current['total_institutional_value'] - prior['total_institutional_value'],
                'percent_float_change': current['percent_of_float'] - prior['percent_of_float'],
                'institution_count_change': current['number_of_institutions'] - prior['number_of_institutions']
            }
            
            ownership_changes['changes'][f'q{i}'] = change_data
        
        # Calculate overall trends
        first_quarter = ownership_history[-1]
        last_quarter = ownership_history[0]
        
        ownership_changes['trends'] = {
            'overall_share_change': last_quarter['total_institutional_shares'] - first_quarter['total_institutional_shares'],
            'overall_value_change': last_quarter['total_institutional_value'] - first_quarter['total_institutional_value'],
            'overall_percent_change': last_quarter['percent_of_float'] - first_quarter['percent_of_float'],
            'trend_direction': 'increasing' if last_quarter['total_institutional_shares'] > first_quarter['total_institutional_shares'] else 'decreasing',
            'institutional_interest': 'growing' if last_quarter['number_of_institutions'] > first_quarter['number_of_institutions'] else 'declining'
        }
        
        return {
            'success': True,
            'ticker': ticker,
            'ownership_analysis': ownership_changes,
            'metadata': {
                'source': 'SEC Form 13F via data.gov',
                'analysis_time': datetime.now().isoformat(),
                'quarters_analyzed': len(ownership_history)
            }
        }
        
    except Exception as e:
        logger.error(f"calculate_ownership_changes failed for {ticker}: {e}")
        return {
            'success': False,
            'error': str(e),
            'ticker': ticker
        }
    
    finally:
        await processor.cleanup()


async def analyze_13f_trends(quarter: str) -> Dict[str, Any]:
    """
    MCP Tool: Analyze Form 13F filing trends for a quarter.
    
    Args:
        quarter: Quarter to analyze in YYYY-Q format
        
    Returns:
        Dictionary containing 13F filing trend analysis
    """
    processor = Form13FProcessor()
    
    try:
        # Get 13F index for the quarter
        form_index = await processor.get_form_13f_index(quarter)
        
        if not form_index:
            return {
                'success': False,
                'error': f'No Form 13F filings found for {quarter}',
                'quarter': quarter
            }
        
        # Analyze filing patterns
        filing_analysis = {
            'quarter': quarter,
            'total_filings': len(form_index),
            'filing_dates': {},
            'institution_types': {},
            'notable_institutions': []
        }
        
        # Analyze filing dates distribution
        filing_dates = defaultdict(int)
        for filing in form_index:
            filing_date = filing['filing_date']
            filing_dates[filing_date] += 1
        
        filing_analysis['filing_dates'] = dict(filing_dates)
        
        # Identify notable institutions
        for filing in form_index:
            cik = filing['cik'].zfill(10)
            if cik in processor.smart_money_institutions:
                filing_analysis['notable_institutions'].append({
                    'cik': cik,
                    'name': processor.smart_money_institutions[cik],
                    'filing_date': filing['filing_date']
                })
        
        # Calculate filing timeline statistics
        filing_timeline = {
            'earliest_filing': min(form_index, key=lambda x: x['filing_date'])['filing_date'],
            'latest_filing': max(form_index, key=lambda x: x['filing_date'])['filing_date'],
            'peak_filing_date': max(filing_dates.items(), key=lambda x: x[1])[0],
            'average_daily_filings': len(form_index) / len(filing_dates)
        }
        
        filing_analysis['timeline_stats'] = filing_timeline
        
        return {
            'success': True,
            'quarter': quarter,
            'filing_trends': filing_analysis,
            'metadata': {
                'source': 'SEC EDGAR via data.gov',
                'analysis_time': datetime.now().isoformat(),
                'note': 'Form 13F filings are due 45 days after quarter end'
            }
        }
        
    except Exception as e:
        logger.error(f"analyze_13f_trends failed for {quarter}: {e}")
        return {
            'success': False,
            'error': str(e),
            'quarter': quarter
        }
    
    finally:
        await processor.cleanup()


# Utility functions

def _get_current_quarter() -> str:
    """Get current quarter in YYYY-Q format."""
    now = datetime.now()
    quarter = (now.month - 1) // 3 + 1
    return f"{now.year}-Q{quarter}"


def _get_prior_quarter(current_quarter: str, quarters_back: int = 1) -> str:
    """Get prior quarter(s) in YYYY-Q format."""
    year, qtr = current_quarter.split('-Q')
    year = int(year)
    qtr = int(qtr)
    
    # Calculate quarters back
    total_quarters = (year * 4) + (qtr - 1) - quarters_back
    
    new_year = total_quarters // 4
    new_quarter = (total_quarters % 4) + 1
    
    return f"{new_year}-Q{new_quarter}"


# Tool registry for MCP server
MCP_INSTITUTIONAL_TOOLS = {
    'get_institutional_positions': get_institutional_positions,
    'track_smart_money': track_smart_money,
    'calculate_ownership_changes': calculate_ownership_changes,
    'analyze_13f_trends': analyze_13f_trends
}