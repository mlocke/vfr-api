"""
Financial Analysis MCP Tools

MCP tools for SEC financial data analysis leveraging data.gov datasets.
Provides AI-native access to quarterly financial statements, trend analysis,
and peer comparisons using XBRL and SEC EDGAR data.

Tools:
- get_quarterly_financials: Retrieve quarterly financial statements
- analyze_financial_trends: Analyze financial metrics over time  
- compare_peer_metrics: Compare financial metrics across companies
- get_xbrl_facts: Extract specific XBRL facts from filings
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import aiohttp
import zipfile
import io
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)


@dataclass
class FinancialMetric:
    """Financial metric data structure."""
    name: str
    value: Optional[float]
    period: str
    unit: str
    filing_date: Optional[str] = None
    context: Optional[str] = None


@dataclass
class CompanyFinancials:
    """Company financial statements structure."""
    ticker: str
    company_name: str
    filing_date: str
    period_end: str
    period_type: str  # quarterly, annual
    
    # Income Statement
    revenue: Optional[float] = None
    gross_profit: Optional[float] = None
    operating_income: Optional[float] = None
    net_income: Optional[float] = None
    earnings_per_share: Optional[float] = None
    
    # Balance Sheet  
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    shareholders_equity: Optional[float] = None
    cash_and_equivalents: Optional[float] = None
    total_debt: Optional[float] = None
    
    # Cash Flow
    operating_cash_flow: Optional[float] = None
    investing_cash_flow: Optional[float] = None
    financing_cash_flow: Optional[float] = None
    free_cash_flow: Optional[float] = None
    
    # Calculated Ratios
    debt_to_equity: Optional[float] = None
    return_on_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    gross_margin: Optional[float] = None
    net_margin: Optional[float] = None


class SECDataExtractor:
    """SEC EDGAR data extraction utilities."""
    
    def __init__(self):
        self.sec_base_url = "https://www.sec.gov/Archives/edgar"
        self.session = aiohttp.ClientSession(
            headers={'User-Agent': 'StockPicker-DataGov-MCP/1.0'}
        )
    
    async def get_company_cik(self, ticker: str) -> Optional[str]:
        """Get CIK (Central Index Key) for a ticker symbol."""
        try:
            # Use SEC company tickers JSON
            url = "https://www.sec.gov/files/company_tickers.json"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    for company_info in data.values():
                        if company_info.get('ticker', '').upper() == ticker.upper():
                            cik = str(company_info.get('cik_str', '')).zfill(10)
                            return cik
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get CIK for {ticker}: {e}")
            return None
    
    async def get_quarterly_filings(self, cik: str, quarters: int = 4) -> List[Dict[str, Any]]:
        """Get recent quarterly filings for a company."""
        try:
            url = f"{self.sec_base_url}/data/{cik}/CIK{cik}.json"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    filings = data.get('filings', {}).get('recent', {})
                    
                    quarterly_filings = []
                    forms = filings.get('form', [])
                    dates = filings.get('filingDate', [])
                    accession_numbers = filings.get('accessionNumber', [])
                    
                    for i, form in enumerate(forms):
                        if form in ['10-Q', '10-K'] and len(quarterly_filings) < quarters:
                            quarterly_filings.append({
                                'form': form,
                                'filing_date': dates[i],
                                'accession_number': accession_numbers[i],
                                'period_type': 'quarterly' if form == '10-Q' else 'annual'
                            })
                    
                    return quarterly_filings[:quarters]
            
            return []
            
        except Exception as e:
            logger.error(f"Failed to get filings for CIK {cik}: {e}")
            return []
    
    async def extract_xbrl_data(self, cik: str, accession_number: str) -> Dict[str, Any]:
        """Extract XBRL financial data from a filing."""
        try:
            # Clean accession number for URL
            clean_accession = accession_number.replace('-', '')
            
            # XBRL facts URL
            facts_url = f"{self.sec_base_url}/data/{cik}/CIK{cik}.json"
            
            async with self.session.get(facts_url) as response:
                if response.status == 200:
                    facts_data = await response.json()
                    return self._process_xbrl_facts(facts_data)
            
            return {}
            
        except Exception as e:
            logger.error(f"Failed to extract XBRL data: {e}")
            return {}
    
    def _process_xbrl_facts(self, facts_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process XBRL facts into structured financial data."""
        try:
            facts = facts_data.get('facts', {})
            us_gaap = facts.get('us-gaap', {})
            
            financial_data = {}
            
            # Revenue (multiple possible tags)
            revenue_tags = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']
            for tag in revenue_tags:
                if tag in us_gaap:
                    financial_data['revenue'] = self._extract_latest_value(us_gaap[tag])
                    break
            
            # Net Income
            if 'NetIncomeLoss' in us_gaap:
                financial_data['net_income'] = self._extract_latest_value(us_gaap['NetIncomeLoss'])
            
            # Total Assets
            if 'Assets' in us_gaap:
                financial_data['total_assets'] = self._extract_latest_value(us_gaap['Assets'])
            
            # Total Liabilities
            if 'Liabilities' in us_gaap:
                financial_data['total_liabilities'] = self._extract_latest_value(us_gaap['Liabilities'])
            
            # Shareholders Equity
            if 'StockholdersEquity' in us_gaap:
                financial_data['shareholders_equity'] = self._extract_latest_value(us_gaap['StockholdersEquity'])
            
            # Cash and Cash Equivalents
            if 'CashAndCashEquivalentsAtCarryingValue' in us_gaap:
                financial_data['cash_and_equivalents'] = self._extract_latest_value(us_gaap['CashAndCashEquivalentsAtCarryingValue'])
            
            return financial_data
            
        except Exception as e:
            logger.error(f"Failed to process XBRL facts: {e}")
            return {}
    
    def _extract_latest_value(self, fact_data: Dict[str, Any]) -> Optional[float]:
        """Extract the most recent value from XBRL fact data."""
        try:
            units = fact_data.get('units', {})
            
            # Look for USD values
            if 'USD' in units:
                values = units['USD']
                if values:
                    # Get most recent value
                    latest_value = max(values, key=lambda x: x.get('end', ''))
                    return float(latest_value.get('val', 0))
            
            return None
            
        except Exception as e:
            logger.debug(f"Failed to extract value: {e}")
            return None
    
    async def cleanup(self):
        """Clean up HTTP session."""
        if self.session:
            await self.session.close()


# MCP Tool Functions

async def get_quarterly_financials(ticker: str, quarters: int = 4) -> Dict[str, Any]:
    """
    MCP Tool: Retrieve quarterly financial statements for a company.
    
    Args:
        ticker: Stock ticker symbol
        quarters: Number of quarters to retrieve (default 4)
        
    Returns:
        Dictionary containing financial statements data
    """
    extractor = SECDataExtractor()
    
    try:
        # Get company CIK
        cik = await extractor.get_company_cik(ticker)
        if not cik:
            return {
                'success': False,
                'error': f'Could not find CIK for ticker {ticker}',
                'ticker': ticker
            }
        
        # Get quarterly filings
        filings = await extractor.get_quarterly_filings(cik, quarters)
        if not filings:
            return {
                'success': False,
                'error': f'No quarterly filings found for {ticker}',
                'ticker': ticker,
                'cik': cik
            }
        
        # Extract financial data from each filing
        quarterly_data = []
        
        for filing in filings:
            try:
                xbrl_data = await extractor.extract_xbrl_data(cik, filing['accession_number'])
                
                financial_statement = CompanyFinancials(
                    ticker=ticker,
                    company_name="",  # Could be extracted from company facts
                    filing_date=filing['filing_date'],
                    period_end=filing['filing_date'],  # Approximation
                    period_type=filing['period_type'],
                    **xbrl_data
                )
                
                quarterly_data.append(financial_statement.__dict__)
                
            except Exception as e:
                logger.warning(f"Failed to process filing {filing['accession_number']}: {e}")
                continue
        
        return {
            'success': True,
            'ticker': ticker,
            'cik': cik,
            'quarters_retrieved': len(quarterly_data),
            'data': quarterly_data,
            'metadata': {
                'source': 'SEC EDGAR via data.gov',
                'extraction_time': datetime.now().isoformat(),
                'data_format': 'XBRL processed'
            }
        }
        
    except Exception as e:
        logger.error(f"get_quarterly_financials failed for {ticker}: {e}")
        return {
            'success': False,
            'error': str(e),
            'ticker': ticker
        }
    
    finally:
        await extractor.cleanup()


async def analyze_financial_trends(ticker: str, metrics: List[str]) -> Dict[str, Any]:
    """
    MCP Tool: Analyze financial trends over time for specific metrics.
    
    Args:
        ticker: Stock ticker symbol
        metrics: List of financial metrics to analyze
        
    Returns:
        Dictionary containing trend analysis
    """
    # Get the base financial data first
    financials_result = await get_quarterly_financials(ticker, quarters=8)
    
    if not financials_result.get('success'):
        return financials_result
    
    try:
        quarterly_data = financials_result['data']
        trend_analysis = {
            'ticker': ticker,
            'analysis_period': f'{len(quarterly_data)} quarters',
            'metrics_analyzed': metrics,
            'trends': {}
        }
        
        # Analyze each requested metric
        for metric in metrics:
            if metric in ['revenue', 'net_income', 'total_assets', 'total_debt', 'shareholders_equity']:
                values = []
                dates = []
                
                for quarter in reversed(quarterly_data):  # Oldest to newest
                    if quarter.get(metric) is not None:
                        values.append(quarter[metric])
                        dates.append(quarter['filing_date'])
                
                if len(values) >= 2:
                    # Calculate growth rates
                    growth_rates = []
                    for i in range(1, len(values)):
                        if values[i-1] != 0:
                            growth_rate = ((values[i] - values[i-1]) / abs(values[i-1])) * 100
                            growth_rates.append(growth_rate)
                    
                    # Calculate trend statistics
                    trend_analysis['trends'][metric] = {
                        'values': values,
                        'dates': dates,
                        'growth_rates': growth_rates,
                        'average_growth': sum(growth_rates) / len(growth_rates) if growth_rates else 0,
                        'latest_value': values[-1] if values else None,
                        'trend_direction': 'increasing' if len(values) >= 2 and values[-1] > values[0] else 'decreasing',
                        'volatility': _calculate_volatility(growth_rates) if growth_rates else 0
                    }
                else:
                    trend_analysis['trends'][metric] = {
                        'error': 'Insufficient data for trend analysis',
                        'data_points': len(values)
                    }
        
        return {
            'success': True,
            'ticker': ticker,
            'trend_analysis': trend_analysis,
            'metadata': {
                'source': 'SEC EDGAR via data.gov',
                'analysis_time': datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"analyze_financial_trends failed for {ticker}: {e}")
        return {
            'success': False,
            'error': str(e),
            'ticker': ticker
        }


async def compare_peer_metrics(tickers: List[str], metric: str) -> Dict[str, Any]:
    """
    MCP Tool: Compare financial metrics across peer companies.
    
    Args:
        tickers: List of ticker symbols to compare
        metric: Financial metric for comparison
        
    Returns:
        Dictionary containing peer comparison analysis
    """
    try:
        comparison_data = {
            'metric': metric,
            'companies': {},
            'comparison_stats': {},
            'rankings': []
        }
        
        # Collect metric data for each company
        for ticker in tickers:
            financials_result = await get_quarterly_financials(ticker, quarters=1)
            
            if financials_result.get('success') and financials_result.get('data'):
                latest_quarter = financials_result['data'][0]
                metric_value = latest_quarter.get(metric)
                
                comparison_data['companies'][ticker] = {
                    'metric_value': metric_value,
                    'filing_date': latest_quarter['filing_date'],
                    'period_type': latest_quarter['period_type']
                }
            else:
                comparison_data['companies'][ticker] = {
                    'error': 'Data not available'
                }
        
        # Calculate comparison statistics
        valid_values = [
            data['metric_value'] for data in comparison_data['companies'].values() 
            if isinstance(data.get('metric_value'), (int, float))
        ]
        
        if valid_values:
            comparison_data['comparison_stats'] = {
                'average': sum(valid_values) / len(valid_values),
                'median': sorted(valid_values)[len(valid_values)//2],
                'min': min(valid_values),
                'max': max(valid_values),
                'std_deviation': _calculate_std_deviation(valid_values)
            }
            
            # Create rankings
            rankings = []
            for ticker, data in comparison_data['companies'].items():
                if isinstance(data.get('metric_value'), (int, float)):
                    rankings.append({
                        'ticker': ticker,
                        'value': data['metric_value'],
                        'percentile_rank': _calculate_percentile_rank(data['metric_value'], valid_values)
                    })
            
            comparison_data['rankings'] = sorted(rankings, key=lambda x: x['value'], reverse=True)
        
        return {
            'success': True,
            'peer_comparison': comparison_data,
            'metadata': {
                'source': 'SEC EDGAR via data.gov',
                'comparison_time': datetime.now().isoformat(),
                'companies_analyzed': len(tickers)
            }
        }
        
    except Exception as e:
        logger.error(f"compare_peer_metrics failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'tickers': tickers,
            'metric': metric
        }


async def get_xbrl_facts(ticker: str, fact_name: str) -> Dict[str, Any]:
    """
    MCP Tool: Extract specific XBRL facts from SEC filings.
    
    Args:
        ticker: Stock ticker symbol
        fact_name: Specific XBRL fact to extract
        
    Returns:
        Dictionary containing XBRL fact data
    """
    extractor = SECDataExtractor()
    
    try:
        # Get company CIK
        cik = await extractor.get_company_cik(ticker)
        if not cik:
            return {
                'success': False,
                'error': f'Could not find CIK for ticker {ticker}',
                'ticker': ticker
            }
        
        # Get company facts
        facts_url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
        
        async with extractor.session.get(facts_url) as response:
            if response.status == 200:
                facts_data = await response.json()
                
                # Extract specific fact
                us_gaap = facts_data.get('facts', {}).get('us-gaap', {})
                
                if fact_name in us_gaap:
                    fact_data = us_gaap[fact_name]
                    
                    return {
                        'success': True,
                        'ticker': ticker,
                        'cik': cik,
                        'fact_name': fact_name,
                        'fact_data': fact_data,
                        'metadata': {
                            'source': 'SEC EDGAR API',
                            'extraction_time': datetime.now().isoformat()
                        }
                    }
                else:
                    return {
                        'success': False,
                        'error': f'XBRL fact {fact_name} not found',
                        'ticker': ticker,
                        'available_facts': list(us_gaap.keys())[:20]  # Show first 20
                    }
            else:
                return {
                    'success': False,
                    'error': f'Failed to retrieve company facts (HTTP {response.status})',
                    'ticker': ticker
                }
                
    except Exception as e:
        logger.error(f"get_xbrl_facts failed for {ticker}: {e}")
        return {
            'success': False,
            'error': str(e),
            'ticker': ticker,
            'fact_name': fact_name
        }
    
    finally:
        await extractor.cleanup()


# Utility functions

def _calculate_volatility(values: List[float]) -> float:
    """Calculate volatility (standard deviation) of values."""
    if len(values) < 2:
        return 0.0
    
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5


def _calculate_std_deviation(values: List[float]) -> float:
    """Calculate standard deviation."""
    if len(values) < 2:
        return 0.0
    
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    return variance ** 0.5


def _calculate_percentile_rank(value: float, all_values: List[float]) -> float:
    """Calculate percentile rank of a value."""
    if not all_values:
        return 0.0
    
    below_count = sum(1 for v in all_values if v < value)
    return (below_count / len(all_values)) * 100


# Tool registry for MCP server
MCP_FINANCIAL_TOOLS = {
    'get_quarterly_financials': get_quarterly_financials,
    'analyze_financial_trends': analyze_financial_trends,
    'compare_peer_metrics': compare_peer_metrics,
    'get_xbrl_facts': get_xbrl_facts
}