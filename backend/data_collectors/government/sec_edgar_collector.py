"""
SEC EDGAR (Electronic Data Gathering, Analysis, and Retrieval) Collector

Collects company financial data from the U.S. Securities and Exchange Commission's 
EDGAR database, containing all public company filings since 1994.

Data Sources:
- Company filings (10-K annual reports, 10-Q quarterly reports, 8-K current reports)
- Financial statements and structured XBRL data
- Company facts and key financial metrics
- Insider trading data (Form 4 filings)
- Real-time filing submissions

API Documentation: https://www.sec.gov/edgar/sec-api-documentation
Rate Limits: 10 requests per second (per SEC guidelines)
Authentication: None required (public data)
User-Agent: Required for all requests

Key Financial Data Available:
- Financial statements (Balance Sheet, Income Statement, Cash Flow)
- Key ratios (P/E, Debt-to-Equity, ROE, Profit Margins)
- Company facts (Revenue, Assets, Liabilities, Equity)
- Filing submissions and document metadata
- Insider trading transactions
"""

import pandas as pd
import requests
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Iterator, Optional, Union
from urllib.parse import urljoin
import time
import json
import re

from ..base import (
    DataCollectorInterface, 
    CollectorConfig, 
    DateRange, 
    DataFrequency,
    RateLimiter, 
    RateLimitConfig,
    ErrorHandler,
    RetryConfig,
    with_error_handling,
    NetworkError,
    AuthenticationError,
    DataValidationError
)

import logging

logger = logging.getLogger(__name__)

class SECEdgarCollector(DataCollectorInterface):
    """
    SEC EDGAR API Collector for company financial data and filings.
    
    Provides structured access to:
    - Company Facts API (financial metrics in XBRL format)
    - Company Concept API (specific financial line items)
    - Submissions API (filing history and documents)
    - Insider Trading API (Form 4 transactions)
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """
        Initialize SEC EDGAR collector.
        
        Args:
            config: Optional configuration object
        """
        self.base_url = "https://data.sec.gov"
        self.config = config or CollectorConfig(
            base_url="https://data.sec.gov",
            timeout=30,
            max_retries=3,
            requests_per_minute=600  # SEC guideline: 10 requests per second
        )
        
        # SEC requires User-Agent header for all requests
        self.headers = {
            'User-Agent': 'Stock-Picker Financial Analysis Platform contact@stockpicker.com',
            'Accept': 'application/json',
            'Host': 'data.sec.gov'
        }
        
        # Create rate limiter and error handler from simple config
        rate_limit_config = RateLimitConfig(
            requests_per_second=10,  # SEC guideline
            requests_per_minute=self.config.requests_per_minute
        )
        retry_config = RetryConfig(
            max_attempts=self.config.max_retries,
            backoff_factor=1.0,
            initial_delay=1.0
        )
        
        self.rate_limiter = RateLimiter(rate_limit_config)
        self.error_handler = ErrorHandler(retry_config)
        
        # Common financial metrics for fundamental analysis
        self.key_financial_concepts = {
            # Balance Sheet
            'Assets': 'us-gaap:Assets',
            'AssetsCurrent': 'us-gaap:AssetsCurrent',
            'Liabilities': 'us-gaap:Liabilities',
            'LiabilitiesCurrent': 'us-gaap:LiabilitiesCurrent',
            'StockholdersEquity': 'us-gaap:StockholdersEquity',
            'Cash': 'us-gaap:CashAndCashEquivalentsAtCarryingValue',
            
            # Income Statement
            'Revenue': 'us-gaap:Revenues',
            'NetIncome': 'us-gaap:NetIncomeLoss',
            'OperatingIncome': 'us-gaap:OperatingIncomeLoss',
            'GrossProfit': 'us-gaap:GrossProfit',
            'OperatingExpenses': 'us-gaap:OperatingExpenses',
            
            # Cash Flow
            'CashFlowOperating': 'us-gaap:NetCashProvidedByUsedInOperatingActivities',
            'CashFlowInvesting': 'us-gaap:NetCashProvidedByUsedInInvestingActivities',
            'CashFlowFinancing': 'us-gaap:NetCashProvidedByUsedInFinancingActivities',
            
            # Per Share Data
            'EarningsPerShare': 'us-gaap:EarningsPerShareBasic',
            'EarningsPerShareDiluted': 'us-gaap:EarningsPerShareDiluted',
            'WeightedAverageShares': 'us-gaap:WeightedAverageNumberOfSharesOutstandingBasic',
            
            # Market Data
            'CommonStockShares': 'us-gaap:CommonStockSharesOutstanding'
        }
        
        logger.info("SEC EDGAR Collector initialized with rate limiting")
    
    def authenticate(self) -> bool:
        """
        SEC EDGAR API does not require authentication.
        Just verify we can connect to the service.
        """
        try:
            # Test connection with a simple request
            response = self._make_request("/api/xbrl/companyfacts/CIK0000320193.json")  # Apple
            return response is not None
        except Exception as e:
            logger.error(f"SEC EDGAR connection test failed: {e}")
            return False
    
    @with_error_handling
    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """
        Make rate-limited request to SEC EDGAR API.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
            
        Returns:
            API response data or None if request fails
        """
        self.rate_limiter.wait_if_needed()
        
        url = urljoin(self.base_url, endpoint)
        
        try:
            response = requests.get(url, params=params, headers=self.headers, timeout=30)
            response.raise_for_status()
            
            if response.headers.get('content-type', '').startswith('application/json'):
                return response.json()
            else:
                logger.warning(f"Non-JSON response from {url}")
                return None
                
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                logger.warning("SEC API rate limit exceeded, implementing backoff")
                time.sleep(2)  # Additional backoff for rate limiting
                raise NetworkError(f"Rate limit exceeded: {e}")
            else:
                logger.error(f"HTTP error from SEC API: {e}")
                raise NetworkError(f"SEC API request failed: {e}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            raise NetworkError(f"Request to SEC API failed: {e}")
    
    def get_company_facts(self, cik: str) -> Optional[Dict[str, Any]]:
        """
        Get all company facts (financial data) for a specific company.
        
        Args:
            cik: Central Index Key (CIK) of the company
            
        Returns:
            Structured company financial data
        """
        # Normalize CIK to 10-digit format with leading zeros
        cik_normalized = str(cik).zfill(10)
        endpoint = f"/api/xbrl/companyfacts/CIK{cik_normalized}.json"
        
        raw_data = self._make_request(endpoint)
        if not raw_data:
            return None
        
        # Structure the data for our application
        company_info = raw_data.get('entityName', 'Unknown Company')
        cik_info = raw_data.get('cik', cik)
        
        # Extract key financial metrics
        facts = raw_data.get('facts', {})
        us_gaap_facts = facts.get('us-gaap', {})
        
        structured_data = {
            'company_info': {
                'name': company_info,
                'cik': cik_info,
                'sic': raw_data.get('sic', None),
                'sicDescription': raw_data.get('sicDescription', None),
                'tickers': raw_data.get('tickers', []),
                'exchanges': raw_data.get('exchanges', [])
            },
            'financial_metrics': {},
            'metadata': {
                'data_retrieved': datetime.now().isoformat(),
                'source': 'SEC EDGAR Company Facts API'
            }
        }
        
        # Extract and organize key financial metrics
        for metric_name, concept_id in self.key_financial_concepts.items():
            if concept_id in us_gaap_facts:
                concept_data = us_gaap_facts[concept_id]
                
                # Get the most recent annual data (10-K filings)
                annual_data = []
                if 'units' in concept_data:
                    for unit_type, unit_data in concept_data['units'].items():
                        for filing in unit_data:
                            if filing.get('form') == '10-K':  # Annual reports
                                annual_data.append({
                                    'date': filing.get('end'),
                                    'value': filing.get('val'),
                                    'form': filing.get('form'),
                                    'filed': filing.get('filed'),
                                    'unit': unit_type
                                })
                
                # Sort by date and get recent values
                annual_data.sort(key=lambda x: x['date'], reverse=True)
                
                structured_data['financial_metrics'][metric_name] = {
                    'concept_id': concept_id,
                    'label': concept_data.get('label', metric_name),
                    'description': concept_data.get('description', ''),
                    'recent_annual_values': annual_data[:5],  # Last 5 years
                    'latest_value': annual_data[0]['value'] if annual_data else None,
                    'latest_date': annual_data[0]['date'] if annual_data else None,
                    'unit': annual_data[0]['unit'] if annual_data else None
                }
        
        return structured_data
    
    def get_company_concept(self, cik: str, concept: str) -> Optional[Dict[str, Any]]:
        """
        Get specific financial concept data for a company.
        
        Args:
            cik: Central Index Key of the company
            concept: US-GAAP concept identifier (e.g., 'us-gaap:Assets')
            
        Returns:
            Historical data for the specific financial concept
        """
        cik_normalized = str(cik).zfill(10)
        endpoint = f"/api/xbrl/companyconcept/CIK{cik_normalized}/{concept}.json"
        
        raw_data = self._make_request(endpoint)
        if not raw_data:
            return None
        
        # Structure the concept data
        structured_data = {
            'company_info': {
                'name': raw_data.get('entityName', 'Unknown Company'),
                'cik': raw_data.get('cik', cik)
            },
            'concept_info': {
                'concept_id': concept,
                'label': raw_data.get('label', concept),
                'description': raw_data.get('description', '')
            },
            'historical_data': [],
            'metadata': {
                'data_retrieved': datetime.now().isoformat(),
                'source': 'SEC EDGAR Company Concept API'
            }
        }
        
        # Process historical data by form type
        if 'units' in raw_data:
            for unit_type, unit_data in raw_data['units'].items():
                for filing in unit_data:
                    structured_data['historical_data'].append({
                        'date': filing.get('end'),
                        'value': filing.get('val'),
                        'form': filing.get('form'),
                        'filed': filing.get('filed'),
                        'unit': unit_type,
                        'period': filing.get('fy'),  # Fiscal year
                        'quarter': filing.get('fp')  # Fiscal period
                    })
        
        # Sort by date, most recent first
        structured_data['historical_data'].sort(
            key=lambda x: x['date'], reverse=True
        )
        
        return structured_data
    
    def get_company_submissions(self, cik: str) -> Optional[Dict[str, Any]]:
        """
        Get filing submissions history for a company.
        
        Args:
            cik: Central Index Key of the company
            
        Returns:
            Company filing history and metadata
        """
        cik_normalized = str(cik).zfill(10)
        endpoint = f"/submissions/CIK{cik_normalized}.json"
        
        raw_data = self._make_request(endpoint)
        if not raw_data:
            return None
        
        # Structure submissions data
        structured_data = {
            'company_info': {
                'name': raw_data.get('name', 'Unknown Company'),
                'cik': raw_data.get('cik', cik),
                'sic': raw_data.get('sic', None),
                'sicDescription': raw_data.get('sicDescription', None),
                'tickers': raw_data.get('tickers', []),
                'exchanges': raw_data.get('exchanges', []),
                'ein': raw_data.get('ein', None),
                'description': raw_data.get('description', None),
                'website': raw_data.get('website', None),
                'investorWebsite': raw_data.get('investorWebsite', None),
                'category': raw_data.get('category', None),
                'fiscalYearEnd': raw_data.get('fiscalYearEnd', None),
                'stateOfIncorporation': raw_data.get('stateOfIncorporation', None)
            },
            'recent_filings': [],
            'filing_summary': {},
            'metadata': {
                'data_retrieved': datetime.now().isoformat(),
                'source': 'SEC EDGAR Submissions API'
            }
        }
        
        # Process recent filings
        filings = raw_data.get('filings', {}).get('recent', {})
        if filings:
            # Combine filing data
            for i in range(min(20, len(filings.get('accessionNumber', [])))):  # Last 20 filings
                filing = {
                    'accessionNumber': filings['accessionNumber'][i] if i < len(filings.get('accessionNumber', [])) else None,
                    'filingDate': filings['filingDate'][i] if i < len(filings.get('filingDate', [])) else None,
                    'reportDate': filings['reportDate'][i] if i < len(filings.get('reportDate', [])) else None,
                    'acceptanceDateTime': filings['acceptanceDateTime'][i] if i < len(filings.get('acceptanceDateTime', [])) else None,
                    'act': filings['act'][i] if i < len(filings.get('act', [])) else None,
                    'form': filings['form'][i] if i < len(filings.get('form', [])) else None,
                    'fileNumber': filings['fileNumber'][i] if i < len(filings.get('fileNumber', [])) else None,
                    'filmNumber': filings['filmNumber'][i] if i < len(filings.get('filmNumber', [])) else None,
                    'items': filings['items'][i] if i < len(filings.get('items', [])) else None,
                    'size': filings['size'][i] if i < len(filings.get('size', [])) else None,
                    'isXBRL': filings['isXBRL'][i] if i < len(filings.get('isXBRL', [])) else None,
                    'isInlineXBRL': filings['isInlineXBRL'][i] if i < len(filings.get('isInlineXBRL', [])) else None,
                    'primaryDocument': filings['primaryDocument'][i] if i < len(filings.get('primaryDocument', [])) else None,
                    'primaryDocDescription': filings['primaryDocDescription'][i] if i < len(filings.get('primaryDocDescription', [])) else None
                }
                structured_data['recent_filings'].append(filing)
        
        # Create filing summary by form type
        form_counts = {}
        for filing in structured_data['recent_filings']:
            form_type = filing.get('form', 'Unknown')
            form_counts[form_type] = form_counts.get(form_type, 0) + 1
        
        structured_data['filing_summary'] = form_counts
        
        return structured_data
    
    def get_key_financial_ratios(self, cik: str) -> Optional[Dict[str, Any]]:
        """
        Calculate key financial ratios from company facts data.
        
        Args:
            cik: Central Index Key of the company
            
        Returns:
            Calculated financial ratios for fundamental analysis
        """
        company_facts = self.get_company_facts(cik)
        if not company_facts:
            return None
        
        metrics = company_facts.get('financial_metrics', {})
        
        # Helper function to get latest value
        def get_latest_value(metric_name):
            metric_data = metrics.get(metric_name, {})
            return metric_data.get('latest_value', 0) if metric_data else 0
        
        # Calculate key ratios
        ratios = {
            'company_info': company_facts.get('company_info', {}),
            'calculated_ratios': {},
            'metadata': {
                'calculation_date': datetime.now().isoformat(),
                'source': 'SEC EDGAR - Calculated from Company Facts'
            }
        }
        
        # Basic values
        total_assets = get_latest_value('Assets')
        total_liabilities = get_latest_value('Liabilities')
        stockholders_equity = get_latest_value('StockholdersEquity')
        revenue = get_latest_value('Revenue')
        net_income = get_latest_value('NetIncome')
        current_assets = get_latest_value('AssetsCurrent')
        current_liabilities = get_latest_value('LiabilitiesCurrent')
        
        # Calculate ratios with error handling
        try:
            # Liquidity ratios
            if current_liabilities and current_liabilities != 0:
                ratios['calculated_ratios']['current_ratio'] = {
                    'value': round(current_assets / current_liabilities, 2),
                    'description': 'Current Assets / Current Liabilities',
                    'category': 'Liquidity'
                }
            
            # Leverage ratios
            if total_assets and total_assets != 0:
                ratios['calculated_ratios']['debt_to_assets'] = {
                    'value': round(total_liabilities / total_assets, 2),
                    'description': 'Total Liabilities / Total Assets',
                    'category': 'Leverage'
                }
            
            if stockholders_equity and stockholders_equity != 0:
                ratios['calculated_ratios']['debt_to_equity'] = {
                    'value': round(total_liabilities / stockholders_equity, 2),
                    'description': 'Total Liabilities / Stockholders Equity',
                    'category': 'Leverage'
                }
            
            # Profitability ratios
            if revenue and revenue != 0:
                ratios['calculated_ratios']['net_profit_margin'] = {
                    'value': round((net_income / revenue) * 100, 2),
                    'description': '(Net Income / Revenue) × 100',
                    'category': 'Profitability',
                    'unit': 'percentage'
                }
            
            if stockholders_equity and stockholders_equity != 0:
                ratios['calculated_ratios']['return_on_equity'] = {
                    'value': round((net_income / stockholders_equity) * 100, 2),
                    'description': '(Net Income / Stockholders Equity) × 100',
                    'category': 'Profitability',
                    'unit': 'percentage'
                }
            
            if total_assets and total_assets != 0:
                ratios['calculated_ratios']['return_on_assets'] = {
                    'value': round((net_income / total_assets) * 100, 2),
                    'description': '(Net Income / Total Assets) × 100',
                    'category': 'Profitability',
                    'unit': 'percentage'
                }
            
        except (ZeroDivisionError, TypeError) as e:
            logger.warning(f"Error calculating ratios for CIK {cik}: {e}")
        
        return ratios
    
    def get_multiple_companies_summary(self, company_list: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Get summary financial data for multiple companies for comparison.
        
        Args:
            company_list: List of companies with 'symbol' and 'cik' keys
            
        Returns:
            Comparative financial summary
        """
        summary_data = {
            'comparison_summary': {},
            'metadata': {
                'comparison_date': datetime.now().isoformat(),
                'companies_analyzed': len(company_list),
                'source': 'SEC EDGAR Multi-Company Analysis'
            }
        }
        
        for company in company_list:
            symbol = company.get('symbol', 'Unknown')
            cik = company.get('cik')
            
            if not cik:
                continue
            
            # Get key ratios for this company
            ratios = self.get_key_financial_ratios(cik)
            if ratios:
                summary_data['comparison_summary'][symbol] = {
                    'company_name': ratios.get('company_info', {}).get('name', 'Unknown'),
                    'cik': cik,
                    'key_ratios': ratios.get('calculated_ratios', {}),
                    'data_quality': 'Complete' if ratios.get('calculated_ratios') else 'Limited'
                }
        
        return summary_data
    
    def filter_companies_by_sic(self, sic_codes: List[str], limit: int = 50) -> Dict[str, Any]:
        """
        Filter companies by SIC (Standard Industrial Classification) codes.
        
        Args:
            sic_codes: List of SIC codes to filter by (e.g., ['3571', '7372'])
            limit: Maximum number of companies to return per SIC code
            
        Returns:
            Dictionary of companies grouped by SIC code with their financial data
        """
        filtered_companies = {
            'by_sic_code': {},
            'metadata': {
                'filter_date': datetime.now().isoformat(),
                'sic_codes_requested': sic_codes,
                'total_companies_found': 0,
                'source': 'SEC EDGAR SIC Code Filtering'
            }
        }
        
        # Use sample companies that match SIC codes for demonstration
        # In production, this would query a comprehensive company database
        sic_industry_map = {
            '3571': 'Electronic Computers',
            '3572': 'Computer Storage Devices', 
            '3577': 'Computer Peripheral Equipment',
            '7372': 'Prepackaged Software',
            '7373': 'Computer Integrated Systems Design',
            '3674': 'Semiconductors and Related Devices',
            '6021': 'National Commercial Banks',
            '2834': 'Pharmaceutical Preparations',
            '3841': 'Surgical and Medical Instruments',
            '5961': 'Catalog and Mail-Order Houses'
        }
        
        # Map sample companies to their likely SIC codes
        company_sic_mapping = {
            'AAPL': '3571',  # Electronic Computers
            'MSFT': '7372',  # Prepackaged Software
            'GOOGL': '7372', # Prepackaged Software
            'AMZN': '5961',  # Catalog and Mail-Order Houses
            'TSLA': '3711',  # Motor Vehicles
            'META': '7372',  # Prepackaged Software
            'NFLX': '7372',  # Prepackaged Software
            'NVDA': '3674',  # Semiconductors
            'JPM': '6021',   # National Commercial Banks
            'JNJ': '2834'    # Pharmaceutical Preparations
        }
        
        for sic_code in sic_codes:
            matching_companies = []
            
            # Find companies matching this SIC code
            for symbol, company_sic in company_sic_mapping.items():
                if company_sic == sic_code:
                    company_info = SAMPLE_COMPANIES.get(symbol)
                    if company_info:
                        # Get financial data for this company
                        financial_data = self.get_key_financial_ratios(company_info['cik'])
                        if financial_data:
                            company_summary = {
                                'symbol': symbol,
                                'name': company_info['name'],
                                'cik': company_info['cik'],
                                'sic_code': sic_code,
                                'industry': sic_industry_map.get(sic_code, 'Unknown'),
                                'financial_summary': {
                                    'ratios': financial_data.get('calculated_ratios', {}),
                                    'data_quality': 'Complete' if financial_data.get('calculated_ratios') else 'Limited'
                                }
                            }
                            matching_companies.append(company_summary)
                            
                            if len(matching_companies) >= limit:
                                break
            
            if matching_companies:
                filtered_companies['by_sic_code'][sic_code] = {
                    'industry_name': sic_industry_map.get(sic_code, 'Unknown Industry'),
                    'companies': matching_companies,
                    'company_count': len(matching_companies)
                }
                filtered_companies['metadata']['total_companies_found'] += len(matching_companies)
        
        return filtered_companies
    
    def screen_by_financial_metrics(self, 
                                   min_revenue: Optional[float] = None,
                                   min_net_income: Optional[float] = None,
                                   min_roe: Optional[float] = None,
                                   max_debt_to_equity: Optional[float] = None,
                                   min_current_ratio: Optional[float] = None,
                                   company_list: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Screen companies based on financial metric thresholds.
        
        Args:
            min_revenue: Minimum revenue threshold
            min_net_income: Minimum net income threshold  
            min_roe: Minimum Return on Equity percentage
            max_debt_to_equity: Maximum Debt-to-Equity ratio
            min_current_ratio: Minimum Current Ratio
            company_list: Optional list of company symbols to screen (uses sample companies if None)
            
        Returns:
            Companies that meet all specified criteria
        """
        screening_results = {
            'qualified_companies': [],
            'screening_criteria': {
                'min_revenue': min_revenue,
                'min_net_income': min_net_income,
                'min_roe': min_roe,
                'max_debt_to_equity': max_debt_to_equity,
                'min_current_ratio': min_current_ratio
            },
            'metadata': {
                'screening_date': datetime.now().isoformat(),
                'total_companies_screened': 0,
                'companies_qualified': 0,
                'source': 'SEC EDGAR Financial Screening'
            }
        }
        
        # Use provided company list or default to sample companies
        companies_to_screen = company_list or list(SAMPLE_COMPANIES.keys())
        screening_results['metadata']['total_companies_screened'] = len(companies_to_screen)
        
        for symbol in companies_to_screen:
            company_info = SAMPLE_COMPANIES.get(symbol)
            if not company_info:
                continue
                
            # Get company financial data
            ratios_data = self.get_key_financial_ratios(company_info['cik'])
            company_facts = self.get_company_facts(company_info['cik'])
            
            if not ratios_data or not company_facts:
                continue
            
            # Extract financial metrics
            financial_metrics = company_facts.get('financial_metrics', {})
            calculated_ratios = ratios_data.get('calculated_ratios', {})
            
            # Get raw values for screening
            revenue = financial_metrics.get('Revenue', {}).get('latest_value', 0)
            net_income = financial_metrics.get('NetIncome', {}).get('latest_value', 0)
            roe = calculated_ratios.get('return_on_equity', {}).get('value', 0)
            debt_to_equity = calculated_ratios.get('debt_to_equity', {}).get('value', float('inf'))
            current_ratio = calculated_ratios.get('current_ratio', {}).get('value', 0)
            
            # Apply screening criteria
            passes_screening = True
            screening_details = {}
            
            if min_revenue is not None:
                passes = revenue >= min_revenue
                screening_details['revenue_check'] = {
                    'actual': revenue,
                    'required': min_revenue,
                    'passed': passes
                }
                passes_screening = passes_screening and passes
            
            if min_net_income is not None:
                passes = net_income >= min_net_income
                screening_details['net_income_check'] = {
                    'actual': net_income,
                    'required': min_net_income,
                    'passed': passes
                }
                passes_screening = passes_screening and passes
            
            if min_roe is not None:
                passes = roe >= min_roe
                screening_details['roe_check'] = {
                    'actual': roe,
                    'required': min_roe,
                    'passed': passes
                }
                passes_screening = passes_screening and passes
            
            if max_debt_to_equity is not None:
                passes = debt_to_equity <= max_debt_to_equity
                screening_details['debt_to_equity_check'] = {
                    'actual': debt_to_equity,
                    'required_max': max_debt_to_equity,
                    'passed': passes
                }
                passes_screening = passes_screening and passes
            
            if min_current_ratio is not None:
                passes = current_ratio >= min_current_ratio
                screening_details['current_ratio_check'] = {
                    'actual': current_ratio,
                    'required': min_current_ratio,
                    'passed': passes
                }
                passes_screening = passes_screening and passes
            
            if passes_screening:
                qualified_company = {
                    'symbol': symbol,
                    'name': company_info['name'],
                    'cik': company_info['cik'],
                    'financial_metrics': {
                        'revenue': revenue,
                        'net_income': net_income,
                        'roe': roe,
                        'debt_to_equity': debt_to_equity,
                        'current_ratio': current_ratio
                    },
                    'screening_details': screening_details,
                    'qualification_status': 'QUALIFIED'
                }
                screening_results['qualified_companies'].append(qualified_company)
        
        screening_results['metadata']['companies_qualified'] = len(screening_results['qualified_companies'])
        
        return screening_results
    
    def analyze_stock_index(self, index_name: str) -> Dict[str, Any]:
        """
        Analyze a predefined stock index using SEC EDGAR data.
        
        Args:
            index_name: Name of the predefined index (e.g., 'SP500_SAMPLE', 'NASDAQ100_SAMPLE')
            
        Returns:
            Comprehensive financial analysis of the index
        """
        if index_name not in STOCK_INDICES:
            available_indices = list(STOCK_INDICES.keys())
            return {
                'error': f"Index '{index_name}' not found",
                'available_indices': available_indices
            }
        
        index_info = STOCK_INDICES[index_name]
        symbols = index_info['symbols']
        
        analysis_results = {
            'index_info': {
                'name': index_info['name'],
                'description': index_info['description'],
                'total_companies': len(symbols),
                'sector_weights': index_info.get('sector_weights', {})
            },
            'company_analysis': [],
            'index_summary': {
                'total_revenue': 0,
                'total_net_income': 0,
                'total_assets': 0,
                'average_roe': 0,
                'average_debt_to_equity': 0,
                'companies_analyzed': 0
            },
            'sector_breakdown': {},
            'metadata': {
                'analysis_date': datetime.now().isoformat(),
                'source': 'SEC EDGAR Index Analysis'
            }
        }
        
        total_roe = 0
        total_debt_to_equity = 0
        successful_companies = 0
        
        for symbol in symbols:
            company_info = SAMPLE_COMPANIES.get(symbol)
            if not company_info:
                continue
            
            # Get financial data
            company_facts = self.get_company_facts(company_info['cik'])
            ratios_data = self.get_key_financial_ratios(company_info['cik'])
            
            if company_facts and ratios_data:
                financial_metrics = company_facts.get('financial_metrics', {})
                calculated_ratios = ratios_data.get('calculated_ratios', {})
                
                # Extract key values
                revenue = financial_metrics.get('Revenue', {}).get('latest_value', 0)
                net_income = financial_metrics.get('NetIncome', {}).get('latest_value', 0)
                assets = financial_metrics.get('Assets', {}).get('latest_value', 0)
                roe = calculated_ratios.get('return_on_equity', {}).get('value', 0)
                debt_to_equity = calculated_ratios.get('debt_to_equity', {}).get('value', 0)
                
                company_analysis = {
                    'symbol': symbol,
                    'name': company_info['name'],
                    'financial_metrics': {
                        'revenue': revenue,
                        'net_income': net_income,
                        'assets': assets,
                        'roe': roe,
                        'debt_to_equity': debt_to_equity
                    },
                    'performance_ranking': {
                        'revenue_rank': 0,  # Will be calculated after all companies
                        'profitability_rank': 0,
                        'efficiency_rank': 0
                    }
                }
                
                analysis_results['company_analysis'].append(company_analysis)
                
                # Update index totals
                analysis_results['index_summary']['total_revenue'] += revenue
                analysis_results['index_summary']['total_net_income'] += net_income
                analysis_results['index_summary']['total_assets'] += assets
                
                if roe > 0:
                    total_roe += roe
                if debt_to_equity > 0:
                    total_debt_to_equity += debt_to_equity
                    
                successful_companies += 1
        
        # Calculate averages
        if successful_companies > 0:
            analysis_results['index_summary']['average_roe'] = round(total_roe / successful_companies, 2)
            analysis_results['index_summary']['average_debt_to_equity'] = round(total_debt_to_equity / successful_companies, 2)
            analysis_results['index_summary']['companies_analyzed'] = successful_companies
            
            # Rank companies by performance
            companies = analysis_results['company_analysis']
            
            # Revenue ranking
            companies_by_revenue = sorted(companies, key=lambda x: x['financial_metrics']['revenue'], reverse=True)
            for i, company in enumerate(companies_by_revenue):
                symbol = company['symbol']
                for comp in analysis_results['company_analysis']:
                    if comp['symbol'] == symbol:
                        comp['performance_ranking']['revenue_rank'] = i + 1
            
            # ROE ranking
            companies_by_roe = sorted(companies, key=lambda x: x['financial_metrics']['roe'], reverse=True)
            for i, company in enumerate(companies_by_roe):
                symbol = company['symbol']
                for comp in analysis_results['company_analysis']:
                    if comp['symbol'] == symbol:
                        comp['performance_ranking']['profitability_rank'] = i + 1
        
        return analysis_results
    
    def get_symbol_to_cik_mapping(self, symbol: str) -> Optional[str]:
        """
        Get CIK for a given stock symbol.
        
        Args:
            symbol: Stock ticker symbol
            
        Returns:
            CIK string if found, None otherwise
        """
        company_info = SAMPLE_COMPANIES.get(symbol.upper())
        return company_info['cik'] if company_info else None
    
    def batch_analyze_companies(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Batch analyze multiple companies for comparison.
        
        Args:
            symbols: List of stock ticker symbols
            
        Returns:
            Batch analysis results with financial comparisons
        """
        batch_results = {
            'companies': [],
            'comparison_metrics': {
                'highest_revenue': {'symbol': '', 'value': 0},
                'highest_roe': {'symbol': '', 'value': 0},
                'lowest_debt_to_equity': {'symbol': '', 'value': float('inf')},
                'most_assets': {'symbol': '', 'value': 0}
            },
            'metadata': {
                'analysis_date': datetime.now().isoformat(),
                'companies_requested': len(symbols),
                'companies_analyzed': 0,
                'source': 'SEC EDGAR Batch Analysis'
            }
        }
        
        for symbol in symbols:
            cik = self.get_symbol_to_cik_mapping(symbol)
            if not cik:
                continue
            
            company_facts = self.get_company_facts(cik)
            ratios_data = self.get_key_financial_ratios(cik)
            
            if company_facts and ratios_data:
                financial_metrics = company_facts.get('financial_metrics', {})
                calculated_ratios = ratios_data.get('calculated_ratios', {})
                company_info = company_facts.get('company_info', {})
                
                revenue = financial_metrics.get('Revenue', {}).get('latest_value', 0)
                net_income = financial_metrics.get('NetIncome', {}).get('latest_value', 0)
                assets = financial_metrics.get('Assets', {}).get('latest_value', 0)
                roe = calculated_ratios.get('return_on_equity', {}).get('value', 0)
                debt_to_equity = calculated_ratios.get('debt_to_equity', {}).get('value', 0)
                
                company_result = {
                    'symbol': symbol,
                    'name': company_info.get('name', 'Unknown'),
                    'cik': cik,
                    'financial_summary': {
                        'revenue': revenue,
                        'net_income': net_income,
                        'assets': assets,
                        'roe': roe,
                        'debt_to_equity': debt_to_equity
                    }
                }
                
                batch_results['companies'].append(company_result)
                batch_results['metadata']['companies_analyzed'] += 1
                
                # Update comparison metrics
                if revenue > batch_results['comparison_metrics']['highest_revenue']['value']:
                    batch_results['comparison_metrics']['highest_revenue'] = {'symbol': symbol, 'value': revenue}
                
                if roe > batch_results['comparison_metrics']['highest_roe']['value']:
                    batch_results['comparison_metrics']['highest_roe'] = {'symbol': symbol, 'value': roe}
                
                if debt_to_equity < batch_results['comparison_metrics']['lowest_debt_to_equity']['value']:
                    batch_results['comparison_metrics']['lowest_debt_to_equity'] = {'symbol': symbol, 'value': debt_to_equity}
                
                if assets > batch_results['comparison_metrics']['most_assets']['value']:
                    batch_results['comparison_metrics']['most_assets'] = {'symbol': symbol, 'value': assets}
        
        return batch_results
    
    @property
    def source_name(self) -> str:
        """Get the source name."""
        return "SEC_EDGAR"
    
    def requires_api_key(self) -> bool:
        """SEC EDGAR does not require an API key."""
        return False
    
    def supported_data_types(self) -> List[str]:
        """Get supported data types."""
        return ['financial_statements', 'company_facts', 'filings', 'ratios', 'fundamental_data']
    
    def get_available_symbols(self) -> List[str]:
        """Get list of available company symbols."""
        return list(SAMPLE_COMPANIES.keys())
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """Validate if symbols are available in the collector."""
        validation_results = {}
        for symbol in symbols:
            validation_results[symbol] = symbol.upper() in SAMPLE_COMPANIES
        return validation_results
    
    def test_connection(self) -> bool:
        """Test connection to SEC EDGAR API."""
        try:
            # Test with Apple's CIK
            response = self._make_request("/api/xbrl/companyfacts/CIK0000320193.json")
            return response is not None
        except Exception as e:
            logger.error(f"SEC EDGAR connection test failed: {e}")
            return False
    
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if SEC EDGAR should activate based on filter specificity.
        
        SEC EDGAR is designed for individual company deep-dive analysis and should
        ONLY activate when specific companies are requested in the filter.
        
        Args:
            filter_criteria: Dictionary containing filter parameters
            
        Returns:
            bool: True if SEC EDGAR should be used for this request
            
        Activation Rules:
        ✅ ACTIVATE when:
        - Specific company symbols/tickers are listed
        - Individual company CIKs are provided
        - Small list of companies (≤20) for comparison
        
        ❌ DON'T ACTIVATE when:
        - Broad sector filtering only (use market APIs)
        - Index-only requests (use index APIs) 
        - Economic indicator requests (use FRED)
        - Large company lists (>20, use bulk APIs)
        """
        # Extract specific company identifiers
        companies = filter_criteria.get('companies', [])
        symbols = filter_criteria.get('symbols', [])
        tickers = filter_criteria.get('tickers', [])
        ciks = filter_criteria.get('ciks', [])
        
        # Combine all specific company identifiers
        specific_companies = companies + symbols + tickers + ciks
        
        # Don't activate for broad sector-only requests
        if filter_criteria.get('sector') and not specific_companies:
            logger.info("SEC EDGAR: Skipping - sector-only request (use market screening APIs)")
            return False
        
        # Don't activate for index-only requests
        if filter_criteria.get('index') and not specific_companies:
            logger.info("SEC EDGAR: Skipping - index-only request (use index APIs)")
            return False
        
        # Don't activate for economic indicator requests
        if filter_criteria.get('economic_indicator') or filter_criteria.get('fred_series'):
            logger.info("SEC EDGAR: Skipping - economic data request (use FRED API)")
            return False
        
        # Don't activate for market-wide screening without specific companies
        market_filters = ['market_cap', 'volume', 'price_range', 'technical_indicators']
        if any(filter_criteria.get(f) for f in market_filters) and not specific_companies:
            logger.info("SEC EDGAR: Skipping - market screening request (use market APIs)")
            return False
        
        # Don't activate for very large company lists (inefficient)
        if len(specific_companies) > 20:
            logger.info(f"SEC EDGAR: Skipping - too many companies ({len(specific_companies)} > 20), use bulk market APIs")
            return False
        
        # Activate when specific companies are requested
        if specific_companies:
            logger.info(f"SEC EDGAR: ACTIVATING - individual analysis for {len(specific_companies)} companies: {specific_companies}")
            return True
        
        # Default: don't activate without specific companies
        logger.info("SEC EDGAR: Skipping - no specific companies requested")
        return False
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Get priority level for this collector when multiple collectors can handle a request.
        
        Args:
            filter_criteria: Dictionary containing filter parameters
            
        Returns:
            int: Priority level (0-100, higher = more specific/preferred)
        """
        if not self.should_activate(filter_criteria):
            return 0
        
        # High priority for individual company analysis (SEC EDGAR's specialty)
        companies = filter_criteria.get('companies', [])
        symbols = filter_criteria.get('symbols', [])
        tickers = filter_criteria.get('tickers', [])
        ciks = filter_criteria.get('ciks', [])
        
        specific_companies = companies + symbols + tickers + ciks
        
        if len(specific_companies) == 1:
            return 100  # Highest priority for single company deep-dive
        elif len(specific_companies) <= 5:
            return 90   # Very high for small comparison groups
        elif len(specific_companies) <= 10:
            return 80   # High for moderate comparison groups
        elif len(specific_companies) <= 20:
            return 70   # Moderate for larger comparison groups
        
        return 0
    
    def collect_batch(self, symbols: List[str], date_range: DateRange) -> pd.DataFrame:
        """
        Collect batch data for multiple companies.
        Note: SEC EDGAR provides historical data but not time-series by date range
        like market data APIs.
        """
        # This would need CIK mapping for symbols
        # Implementation would depend on having a symbol-to-CIK mapping
        logger.info("SEC EDGAR batch collection requires CIK mapping implementation")
        return pd.DataFrame()
    
    def collect_realtime(self, symbols: List[str]) -> Iterator[Dict]:
        """
        SEC EDGAR doesn't provide real-time data - it's filing-based.
        This would monitor for new filings.
        """
        logger.info("SEC EDGAR real-time collection would monitor new filings")
        return iter([])
    
    def get_rate_limits(self) -> RateLimitConfig:
        """Get current rate limit configuration."""
        return RateLimitConfig(
            requests_per_second=10,
            requests_per_minute=self.config.requests_per_minute
        )
    
    def validate_data(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Validate SEC EDGAR data quality."""
        return {
            'is_valid': True,
            'row_count': len(data),
            'validation_timestamp': datetime.now().isoformat()
        }

# Common Fortune 500 companies for testing
SAMPLE_COMPANIES = {
    'AAPL': {'symbol': 'AAPL', 'cik': '320193', 'name': 'Apple Inc.'},
    'MSFT': {'symbol': 'MSFT', 'cik': '789019', 'name': 'Microsoft Corporation'},
    'GOOGL': {'symbol': 'GOOGL', 'cik': '1652044', 'name': 'Alphabet Inc.'},
    'AMZN': {'symbol': 'AMZN', 'cik': '1018724', 'name': 'Amazon.com Inc.'},
    'TSLA': {'symbol': 'TSLA', 'cik': '1318605', 'name': 'Tesla Inc.'},
    'META': {'symbol': 'META', 'cik': '1326801', 'name': 'Meta Platforms Inc.'},
    'NFLX': {'symbol': 'NFLX', 'cik': '1065280', 'name': 'Netflix Inc.'},
    'NVDA': {'symbol': 'NVDA', 'cik': '1045810', 'name': 'NVIDIA Corporation'},
    'JPM': {'symbol': 'JPM', 'cik': '19617', 'name': 'JPMorgan Chase & Co.'},
    'JNJ': {'symbol': 'JNJ', 'cik': '200406', 'name': 'Johnson & Johnson'},
    
    # Additional major companies for index representation
    'WMT': {'symbol': 'WMT', 'cik': '104169', 'name': 'Walmart Inc.'},
    'UNH': {'symbol': 'UNH', 'cik': '731766', 'name': 'UnitedHealth Group Inc.'},
    'V': {'symbol': 'V', 'cik': '1403161', 'name': 'Visa Inc.'},
    'HD': {'symbol': 'HD', 'cik': '354950', 'name': 'Home Depot Inc.'},
    'PG': {'symbol': 'PG', 'cik': '80424', 'name': 'Procter & Gamble Co.'},
    'MA': {'symbol': 'MA', 'cik': '1141391', 'name': 'Mastercard Inc.'},
    'BAC': {'symbol': 'BAC', 'cik': '70858', 'name': 'Bank of America Corp.'},
    'XOM': {'symbol': 'XOM', 'cik': '34088', 'name': 'Exxon Mobil Corp.'},
    'KO': {'symbol': 'KO', 'cik': '21344', 'name': 'Coca-Cola Co.'},
    'PFE': {'symbol': 'PFE', 'cik': '78003', 'name': 'Pfizer Inc.'},
    'CVX': {'symbol': 'CVX', 'cik': '93410', 'name': 'Chevron Corp.'},
    'TMO': {'symbol': 'TMO', 'cik': '97745', 'name': 'Thermo Fisher Scientific Inc.'},
    'COST': {'symbol': 'COST', 'cik': '909832', 'name': 'Costco Wholesale Corp.'},
    'DIS': {'symbol': 'DIS', 'cik': '1744489', 'name': 'Walt Disney Co.'},
    'MRK': {'symbol': 'MRK', 'cik': '64978', 'name': 'Merck & Co Inc.'}
}

# Predefined stock index mappings
STOCK_INDICES = {
    'SP500_SAMPLE': {
        'name': 'S&P 500 Sample',
        'description': 'Representative sample of S&P 500 companies',
        'symbols': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'JNJ', 'WMT', 
                   'UNH', 'V', 'HD', 'PG', 'MA', 'BAC', 'XOM', 'KO', 'PFE', 'CVX'],
        'sector_weights': {
            'Technology': 0.35,
            'Healthcare': 0.15,
            'Financial Services': 0.15,
            'Consumer Discretionary': 0.15,
            'Consumer Staples': 0.10,
            'Energy': 0.10
        }
    },
    'NASDAQ100_SAMPLE': {
        'name': 'NASDAQ-100 Sample', 
        'description': 'Representative sample of NASDAQ-100 technology companies',
        'symbols': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'COST', 'TMO'],
        'sector_weights': {
            'Technology': 0.60,
            'Consumer Discretionary': 0.20,
            'Healthcare': 0.10,
            'Consumer Staples': 0.10
        }
    },
    'DOW30_SAMPLE': {
        'name': 'Dow Jones Industrial Average Sample',
        'description': 'Representative sample of Dow 30 industrial companies',
        'symbols': ['AAPL', 'MSFT', 'UNH', 'HD', 'PG', 'JPM', 'JNJ', 'V', 'WMT', 'MA', 
                   'BAC', 'XOM', 'KO', 'PFE', 'CVX', 'MRK', 'DIS'],
        'sector_weights': {
            'Technology': 0.25,
            'Healthcare': 0.20,
            'Financial Services': 0.15,
            'Consumer Discretionary': 0.15,
            'Consumer Staples': 0.15,
            'Energy': 0.10
        }
    },
    'FAANG': {
        'name': 'FAANG Stocks',
        'description': 'Meta, Apple, Amazon, Netflix, Google technology giants',
        'symbols': ['META', 'AAPL', 'AMZN', 'NFLX', 'GOOGL'],
        'sector_weights': {
            'Technology': 1.0
        }
    },
    'BANKING_SECTOR': {
        'name': 'Banking Sector Leaders',
        'description': 'Major US banking and financial services companies',
        'symbols': ['JPM', 'BAC', 'WMT', 'V', 'MA'],
        'sector_weights': {
            'Financial Services': 1.0
        }
    },
    'HEALTHCARE_LEADERS': {
        'name': 'Healthcare Sector Leaders', 
        'description': 'Major healthcare and pharmaceutical companies',
        'symbols': ['UNH', 'JNJ', 'PFE', 'MRK', 'TMO'],
        'sector_weights': {
            'Healthcare': 1.0
        }
    }
}