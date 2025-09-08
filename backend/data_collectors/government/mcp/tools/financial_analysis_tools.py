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
        # SEC requires proper User-Agent with contact info
        self.session = aiohttp.ClientSession(
            headers={
                'User-Agent': 'Stock Picker Platform hello@stockpicker.io',
                'Accept': 'application/json'
            },
            timeout=aiohttp.ClientTimeout(total=30)
        )
    
    async def get_company_cik(self, ticker: str) -> Optional[str]:
        """Get CIK (Central Index Key) for a ticker symbol."""
        try:
            # Add delay to respect SEC rate limits (10 requests per second max)
            await asyncio.sleep(0.1)
            
            # Use SEC company tickers JSON
            url = "https://www.sec.gov/files/company_tickers.json"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    for company_info in data.values():
                        if company_info.get('ticker', '').upper() == ticker.upper():
                            cik = str(company_info.get('cik_str', '')).zfill(10)
                            return cik
                elif response.status == 429:  # Too Many Requests
                    logger.warning(f"SEC rate limit exceeded, waiting...")
                    await asyncio.sleep(1)
                    return await self.get_company_cik(ticker)  # Retry once
                else:
                    logger.error(f"SEC request failed with status {response.status}")
                    response_text = await response.text()
                    logger.debug(f"Response: {response_text[:200]}")
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get CIK for {ticker}: {e}")
            return None
    
    async def get_company_facts(self, cik: str) -> Dict[str, Any]:
        """Get company facts data which includes recent XBRL filings data."""
        try:
            # Add delay to respect SEC rate limits
            await asyncio.sleep(0.1)
            
            url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
            logger.debug(f"Requesting SEC company facts URL: {url}")
            
            async with self.session.get(url) as response:
                logger.debug(f"SEC API response status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    logger.debug(f"Successfully retrieved company facts data for CIK {cik}")
                    return data
                elif response.status == 429:  # Too Many Requests
                    logger.warning(f"SEC rate limit exceeded for CIK {cik}, waiting...")
                    await asyncio.sleep(1)
                    return await self.get_company_facts(cik)  # Retry once
                else:
                    logger.error(f"SEC request failed with status {response.status} for CIK {cik}")
                    response_text = await response.text()
                    logger.error(f"Response body: {response_text[:500]}")
            
            return {}
            
        except Exception as e:
            logger.error(f"Failed to get company facts for CIK {cik}: {e}")
            return {}
    
    def extract_recent_financials(self, facts_data: Dict[str, Any], quarters: int = 4) -> List[Dict[str, Any]]:
        """Extract recent financial data from company facts."""
        try:
            us_gaap = facts_data.get('facts', {}).get('us-gaap', {})
            
            # Get recent quarterly data from key financial metrics
            quarterly_data = []
            
            # Find revenue data points to use as the basis for quarters
            revenue_data = None
            for tag in ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']:
                if tag in us_gaap and 'units' in us_gaap[tag] and 'USD' in us_gaap[tag]['units']:
                    revenue_data = us_gaap[tag]['units']['USD']
                    break
            
            if not revenue_data:
                return []
            
            # Sort by end date (most recent first) and get quarterly filings
            sorted_data = sorted(revenue_data, key=lambda x: x.get('end', ''), reverse=True)
            
            # Extract recent quarters (filter for quarterly data)
            for item in sorted_data[:quarters*2]:  # Get extra to filter
                if len(quarterly_data) >= quarters:
                    break
                    
                # Look for quarterly filings (10-Q) or annual (10-K)
                form = item.get('form', '')
                if form in ['10-Q', '10-K']:
                    quarter_financials = self._extract_quarter_financials(us_gaap, item.get('end'))
                    if quarter_financials:
                        quarterly_data.append({
                            'period_end': item.get('end'),
                            'filing_date': item.get('filed'),
                            'form': form,
                            'period_type': 'quarterly' if form == '10-Q' else 'annual',
                            **quarter_financials
                        })
            
            return quarterly_data[:quarters]
            
        except Exception as e:
            logger.error(f"Failed to extract recent financials: {e}")
            return []
    
    def _extract_quarter_financials(self, us_gaap: Dict[str, Any], period_end: str) -> Dict[str, Any]:
        """Extract financial metrics for a specific quarter."""
        try:
            financial_data = {}
            
            # Define metric mappings
            metric_mappings = {
                'revenue': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'],
                'net_income': ['NetIncomeLoss'],
                'total_assets': ['Assets'],
                'total_liabilities': ['Liabilities'],
                'shareholders_equity': ['StockholdersEquity'],
                'cash_and_equivalents': ['CashAndCashEquivalentsAtCarryingValue']
            }
            
            # Extract each metric for the specific period
            for metric_name, possible_tags in metric_mappings.items():
                value = None
                for tag in possible_tags:
                    if tag in us_gaap:
                        usd_data = us_gaap[tag].get('units', {}).get('USD', [])
                        # Find exact match for period end
                        for item in usd_data:
                            if item.get('end') == period_end and item.get('val'):
                                value = float(item['val'])
                                break
                        if value is not None:
                            break
                
                financial_data[metric_name] = value
            
            return financial_data
            
        except Exception as e:
            logger.debug(f"Failed to extract quarter financials for {period_end}: {e}")
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
        
        # Get company facts (includes all XBRL data)
        facts_data = await extractor.get_company_facts(cik)
        if not facts_data:
            return {
                'success': False,
                'error': f'No company facts found for {ticker}',
                'ticker': ticker,
                'cik': cik
            }
        
        # Extract recent quarterly financials
        quarterly_data = extractor.extract_recent_financials(facts_data, quarters)
        if not quarterly_data:
            return {
                'success': False,
                'error': f'No quarterly financial data found for {ticker}',
                'ticker': ticker,
                'cik': cik
            }
        
        # Convert to CompanyFinancials objects
        processed_data = []
        company_name = facts_data.get('entityName', '')
        
        for quarter in quarterly_data:
            financial_statement = CompanyFinancials(
                ticker=ticker,
                company_name=company_name,
                filing_date=quarter.get('filing_date', ''),
                period_end=quarter.get('period_end', ''),
                period_type=quarter.get('period_type', 'quarterly'),
                **{k: v for k, v in quarter.items() if k not in ['filing_date', 'period_end', 'period_type', 'form']}
            )
            
            processed_data.append(financial_statement.__dict__)
        
        return {
            'success': True,
            'ticker': ticker,
            'cik': cik,
            'company_name': company_name,
            'quarters_retrieved': len(processed_data),
            'data': processed_data,
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
        facts_data = await extractor.get_company_facts(cik)
        if not facts_data:
            return {
                'success': False,
                'error': f'No company facts found for {ticker}',
                'ticker': ticker,
                'cik': cik
            }
        
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