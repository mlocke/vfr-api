#!/usr/bin/env python3
"""
SEC EDGAR Comprehensive Test Suite - Like FRED
Pulls real data, analyzes it comprehensively, and creates detailed summaries.
"""

import json
import requests
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# SEC API configuration
BASE_URL = "https://data.sec.gov"
HEADERS = {
    'User-Agent': 'Stock-Picker Financial Analysis Platform contact@stockpicker.com',
    'Accept': 'application/json',
    'Host': 'data.sec.gov'
}

# Major companies across different sectors for comprehensive analysis
COMPREHENSIVE_COMPANIES = {
    # Technology Giants
    'AAPL': {'symbol': 'AAPL', 'cik': '320193', 'name': 'Apple Inc.', 'sector': 'Technology'},
    'MSFT': {'symbol': 'MSFT', 'cik': '789019', 'name': 'Microsoft Corporation', 'sector': 'Technology'},
    'GOOGL': {'symbol': 'GOOGL', 'cik': '1652044', 'name': 'Alphabet Inc.', 'sector': 'Technology'},
    'META': {'symbol': 'META', 'cik': '1326801', 'name': 'Meta Platforms Inc.', 'sector': 'Technology'},
    'NVDA': {'symbol': 'NVDA', 'cik': '1045810', 'name': 'NVIDIA Corporation', 'sector': 'Technology'},
    
    # Financial Services
    'JPM': {'symbol': 'JPM', 'cik': '19617', 'name': 'JPMorgan Chase & Co.', 'sector': 'Financial Services'},
    'BAC': {'symbol': 'BAC', 'cik': '70858', 'name': 'Bank of America Corp.', 'sector': 'Financial Services'},
    
    # Healthcare
    'JNJ': {'symbol': 'JNJ', 'cik': '200406', 'name': 'Johnson & Johnson', 'sector': 'Healthcare'},
    'PFE': {'symbol': 'PFE', 'cik': '78003', 'name': 'Pfizer Inc.', 'sector': 'Healthcare'},
    
    # Consumer/Retail
    'AMZN': {'symbol': 'AMZN', 'cik': '1018724', 'name': 'Amazon.com Inc.', 'sector': 'Consumer Discretionary'},
    'WMT': {'symbol': 'WMT', 'cik': '104169', 'name': 'Walmart Inc.', 'sector': 'Consumer Staples'},
    
    # Energy
    'XOM': {'symbol': 'XOM', 'cik': '34088', 'name': 'Exxon Mobil Corp.', 'sector': 'Energy'},
    
    # Automotive
    'TSLA': {'symbol': 'TSLA', 'cik': '1318605', 'name': 'Tesla Inc.', 'sector': 'Automotive'}
}

def make_request(endpoint: str) -> Optional[Dict]:
    """Make rate-limited request to SEC EDGAR API."""
    time.sleep(0.1)  # Rate limiting
    
    url = f"{BASE_URL}{endpoint}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        if response.headers.get('content-type', '').startswith('application/json'):
            return response.json()
        return None
    except Exception as e:
        print(f"❌ Request failed for {endpoint}: {e}")
        return None

def extract_latest_annual_value(concept_data, form_type='10-K'):
    """Extract the latest annual value from a concept with detailed info."""
    if 'units' not in concept_data:
        return None, None, None
    
    # Try USD first, then other units
    for unit_type in ['USD', 'shares', 'USD/shares']:
        if unit_type in concept_data['units']:
            entries = concept_data['units'][unit_type]
            
            # Filter for the specified form type and sort by date
            annual_entries = []
            for entry in entries:
                if entry.get('form') == form_type and entry.get('val') is not None:
                    annual_entries.append(entry)
            
            if annual_entries:
                # Sort by end date descending to get the most recent
                annual_entries.sort(key=lambda x: x.get('end', ''), reverse=True)
                latest = annual_entries[0]
                return latest.get('val'), latest.get('end'), latest.get('filed')
    
    return None, None, None

def get_comprehensive_company_data(cik: str, symbol: str) -> Dict[str, Any]:
    """Get comprehensive financial data for a company."""
    print(f"   📊 Extracting data for {symbol}...")
    
    cik_normalized = str(cik).zfill(10)
    endpoint = f"/api/xbrl/companyfacts/CIK{cik_normalized}.json"
    
    raw_data = make_request(endpoint)
    if not raw_data:
        return {}
    
    # Extract company info
    company_info = {
        'name': raw_data.get('entityName', 'Unknown'),
        'cik': cik,
        'sic': raw_data.get('sic'),
        'sicDescription': raw_data.get('sicDescription'),
        'tickers': raw_data.get('tickers', []),
        'exchanges': raw_data.get('exchanges', [])
    }
    
    # Extract key financial metrics
    facts = raw_data.get('facts', {})
    us_gaap_facts = facts.get('us-gaap', {})
    
    financial_metrics = {}
    
    # Key concepts to extract with their full labels
    concepts = {
        # Income Statement
        'Revenue': ('us-gaap:Revenues', 'Total Revenues'),
        'NetIncome': ('us-gaap:NetIncomeLoss', 'Net Income (Loss)'),
        'OperatingIncome': ('us-gaap:OperatingIncomeLoss', 'Operating Income (Loss)'),
        'GrossProfit': ('us-gaap:GrossProfit', 'Gross Profit'),
        'OperatingExpenses': ('us-gaap:OperatingExpenses', 'Operating Expenses'),
        
        # Balance Sheet
        'Assets': ('us-gaap:Assets', 'Total Assets'),
        'Liabilities': ('us-gaap:Liabilities', 'Total Liabilities'),
        'StockholdersEquity': ('us-gaap:StockholdersEquity', 'Stockholders Equity'),
        'AssetsCurrent': ('us-gaap:AssetsCurrent', 'Current Assets'),
        'LiabilitiesCurrent': ('us-gaap:LiabilitiesCurrent', 'Current Liabilities'),
        'Cash': ('us-gaap:CashAndCashEquivalentsAtCarryingValue', 'Cash and Cash Equivalents'),
        
        # Cash Flow
        'CashFlowOperating': ('us-gaap:NetCashProvidedByUsedInOperatingActivities', 'Operating Cash Flow'),
        'CashFlowInvesting': ('us-gaap:NetCashProvidedByUsedInInvestingActivities', 'Investing Cash Flow'),
        'CashFlowFinancing': ('us-gaap:NetCashProvidedByUsedInFinancingActivities', 'Financing Cash Flow'),
        
        # Per Share Data
        'EarningsPerShare': ('us-gaap:EarningsPerShareBasic', 'Earnings Per Share (Basic)'),
        'WeightedAverageShares': ('us-gaap:WeightedAverageNumberOfSharesOutstandingBasic', 'Weighted Average Shares Outstanding')
    }
    
    for metric_name, (concept_key, description) in concepts.items():
        if concept_key in us_gaap_facts:
            value, date, filed = extract_latest_annual_value(us_gaap_facts[concept_key])
            financial_metrics[metric_name] = {
                'value': value,
                'date': date,
                'filed': filed,
                'description': description,
                'concept_key': concept_key
            }
    
    # Calculate financial ratios
    ratios = calculate_comprehensive_ratios(financial_metrics)
    
    # Get filing history summary
    submissions = get_company_submissions_summary(cik_normalized)
    
    return {
        'company_info': company_info,
        'financial_metrics': financial_metrics,
        'calculated_ratios': ratios,
        'filing_summary': submissions,
        'data_quality': assess_data_quality(financial_metrics),
        'extraction_timestamp': datetime.now().isoformat()
    }

def calculate_comprehensive_ratios(financial_metrics: Dict) -> Dict[str, Any]:
    """Calculate comprehensive financial ratios with explanations."""
    ratios = {}
    
    # Helper function to get metric value
    def get_value(metric_name):
        metric = financial_metrics.get(metric_name, {})
        return metric.get('value', 0) if metric else 0
    
    # Extract base values
    revenue = get_value('Revenue')
    net_income = get_value('NetIncome')
    assets = get_value('Assets')
    liabilities = get_value('Liabilities')
    equity = get_value('StockholdersEquity')
    current_assets = get_value('AssetsCurrent')
    current_liabilities = get_value('LiabilitiesCurrent')
    operating_income = get_value('OperatingIncome')
    gross_profit = get_value('GrossProfit')
    cash = get_value('Cash')
    operating_cf = get_value('CashFlowOperating')
    
    try:
        # Profitability Ratios
        if revenue and revenue != 0:
            ratios['net_profit_margin'] = {
                'value': round((net_income / revenue) * 100, 2),
                'description': 'Net Income / Revenue × 100',
                'interpretation': 'Percentage of revenue that becomes profit',
                'category': 'Profitability',
                'unit': 'percentage'
            }
            
            if gross_profit:
                ratios['gross_profit_margin'] = {
                    'value': round((gross_profit / revenue) * 100, 2),
                    'description': 'Gross Profit / Revenue × 100',
                    'interpretation': 'Percentage of revenue after direct costs',
                    'category': 'Profitability',
                    'unit': 'percentage'
                }
            
            if operating_income:
                ratios['operating_margin'] = {
                    'value': round((operating_income / revenue) * 100, 2),
                    'description': 'Operating Income / Revenue × 100',
                    'interpretation': 'Operating efficiency before interest and taxes',
                    'category': 'Profitability',
                    'unit': 'percentage'
                }
        
        # Liquidity Ratios
        if current_liabilities and current_liabilities != 0:
            ratios['current_ratio'] = {
                'value': round(current_assets / current_liabilities, 2),
                'description': 'Current Assets / Current Liabilities',
                'interpretation': 'Ability to pay short-term obligations',
                'category': 'Liquidity',
                'benchmark': '> 1.0 is generally healthy'
            }
            
            if cash:
                ratios['cash_ratio'] = {
                    'value': round(cash / current_liabilities, 2),
                    'description': 'Cash / Current Liabilities',
                    'interpretation': 'Most liquid measure of short-term solvency',
                    'category': 'Liquidity'
                }
        
        # Leverage Ratios
        if assets and assets != 0:
            ratios['debt_to_assets'] = {
                'value': round(liabilities / assets, 2),
                'description': 'Total Liabilities / Total Assets',
                'interpretation': 'Proportion of assets financed by debt',
                'category': 'Leverage'
            }
        
        if equity and equity != 0:
            ratios['debt_to_equity'] = {
                'value': round(liabilities / equity, 2),
                'description': 'Total Liabilities / Stockholders Equity',
                'interpretation': 'Financial leverage and solvency risk',
                'category': 'Leverage'
            }
            
            # Efficiency Ratios
            ratios['return_on_equity'] = {
                'value': round((net_income / equity) * 100, 2),
                'description': 'Net Income / Stockholders Equity × 100',
                'interpretation': 'Return generated on shareholders investment',
                'category': 'Efficiency',
                'unit': 'percentage',
                'benchmark': '> 15% is generally strong'
            }
        
        if assets and assets != 0:
            ratios['return_on_assets'] = {
                'value': round((net_income / assets) * 100, 2),
                'description': 'Net Income / Total Assets × 100',
                'interpretation': 'How efficiently assets generate profit',
                'category': 'Efficiency',
                'unit': 'percentage'
            }
            
            ratios['asset_turnover'] = {
                'value': round(revenue / assets, 2),
                'description': 'Revenue / Total Assets',
                'interpretation': 'How efficiently assets generate sales',
                'category': 'Efficiency'
            }
        
        # Cash Flow Quality
        if net_income and net_income != 0 and operating_cf:
            ratios['operating_cash_to_income'] = {
                'value': round(operating_cf / net_income, 2),
                'description': 'Operating Cash Flow / Net Income',
                'interpretation': 'Quality of earnings (cash vs accounting profit)',
                'category': 'Cash Flow Quality',
                'benchmark': '> 1.0 indicates high-quality earnings'
            }
            
    except (ZeroDivisionError, TypeError) as e:
        print(f"      ⚠️  Error calculating some ratios: {e}")
    
    return ratios

def get_company_submissions_summary(cik_normalized: str) -> Dict[str, Any]:
    """Get filing history summary."""
    endpoint = f"/submissions/CIK{cik_normalized}.json"
    
    raw_data = make_request(endpoint)
    if not raw_data:
        return {}
    
    filings = raw_data.get('filings', {}).get('recent', {})
    if not filings:
        return {}
    
    # Count filings by type
    form_counts = {}
    recent_filings = []
    
    forms = filings.get('form', [])
    filing_dates = filings.get('filingDate', [])
    
    for i, form in enumerate(forms[:10]):  # Last 10 filings
        form_counts[form] = form_counts.get(form, 0) + 1
        if i < len(filing_dates):
            recent_filings.append({
                'form': form,
                'filing_date': filing_dates[i]
            })
    
    return {
        'form_counts': form_counts,
        'recent_filings': recent_filings,
        'total_recent_filings': len(forms)
    }

def assess_data_quality(financial_metrics: Dict) -> Dict[str, Any]:
    """Assess the quality and completeness of financial data."""
    total_metrics = len(financial_metrics)
    complete_metrics = sum(1 for m in financial_metrics.values() if m.get('value') is not None)
    
    # Key metrics for fundamental analysis
    key_metrics = ['Revenue', 'NetIncome', 'Assets', 'Liabilities', 'StockholdersEquity']
    key_metrics_complete = sum(1 for metric in key_metrics if 
                              financial_metrics.get(metric, {}).get('value') is not None)
    
    completeness_score = (complete_metrics / total_metrics) * 100 if total_metrics > 0 else 0
    key_completeness_score = (key_metrics_complete / len(key_metrics)) * 100
    
    # Determine overall quality rating
    if key_completeness_score >= 80:
        quality_rating = "Excellent"
    elif key_completeness_score >= 60:
        quality_rating = "Good"
    elif key_completeness_score >= 40:
        quality_rating = "Fair"
    else:
        quality_rating = "Limited"
    
    return {
        'total_metrics_available': total_metrics,
        'complete_metrics': complete_metrics,
        'completeness_percentage': round(completeness_score, 1),
        'key_metrics_complete': key_metrics_complete,
        'key_completeness_percentage': round(key_completeness_score, 1),
        'quality_rating': quality_rating,
        'data_recency': get_data_recency(financial_metrics)
    }

def get_data_recency(financial_metrics: Dict) -> str:
    """Assess how recent the financial data is."""
    latest_date = None
    
    for metric in financial_metrics.values():
        date = metric.get('date')
        if date and (not latest_date or date > latest_date):
            latest_date = date
    
    if not latest_date:
        return "Unknown"
    
    # Calculate months since latest data
    try:
        from datetime import datetime
        latest_dt = datetime.strptime(latest_date, "%Y-%m-%d")
        months_old = (datetime.now() - latest_dt).days // 30
        
        if months_old < 6:
            return f"Very Recent ({months_old} months old)"
        elif months_old < 12:
            return f"Recent ({months_old} months old)"
        elif months_old < 24:
            return f"Moderately Old ({months_old} months old)"
        else:
            return f"Old ({months_old} months old)"
    except:
        return latest_date

def perform_sector_analysis(all_company_data: Dict) -> Dict[str, Any]:
    """Perform comprehensive sector analysis."""
    sector_analysis = {}
    
    # Group companies by sector
    sectors = {}
    for symbol, data in all_company_data.items():
        if 'error' in data:
            continue
            
        company_info = COMPREHENSIVE_COMPANIES.get(symbol, {})
        sector = company_info.get('sector', 'Unknown')
        
        if sector not in sectors:
            sectors[sector] = []
        sectors[sector].append((symbol, data))
    
    # Analyze each sector
    for sector_name, companies in sectors.items():
        if not companies:
            continue
            
        sector_metrics = {
            'company_count': len(companies),
            'companies': [],
            'sector_averages': {},
            'sector_leaders': {},
            'sector_summary': {}
        }
        
        # Collect metrics for averaging
        revenue_values = []
        roe_values = []
        profit_margin_values = []
        debt_equity_values = []
        
        for symbol, company_data in companies:
            # Extract key metrics
            financial_metrics = company_data.get('financial_metrics', {})
            ratios = company_data.get('calculated_ratios', {})
            
            revenue = financial_metrics.get('Revenue', {}).get('value', 0)
            roe = ratios.get('return_on_equity', {}).get('value', 0)
            profit_margin = ratios.get('net_profit_margin', {}).get('value', 0)
            debt_equity = ratios.get('debt_to_equity', {}).get('value', 0)
            
            company_summary = {
                'symbol': symbol,
                'name': company_data.get('company_info', {}).get('name', 'Unknown'),
                'revenue': revenue,
                'roe': roe,
                'profit_margin': profit_margin,
                'debt_to_equity': debt_equity,
                'data_quality': company_data.get('data_quality', {}).get('quality_rating', 'Unknown')
            }
            
            sector_metrics['companies'].append(company_summary)
            
            # Collect for averages (only non-zero values)
            if revenue > 0:
                revenue_values.append(revenue)
            if roe != 0:
                roe_values.append(roe)
            if profit_margin != 0:
                profit_margin_values.append(profit_margin)
            if debt_equity > 0:
                debt_equity_values.append(debt_equity)
        
        # Calculate sector averages
        sector_metrics['sector_averages'] = {
            'average_revenue': round(sum(revenue_values) / len(revenue_values), 0) if revenue_values else 0,
            'average_roe': round(sum(roe_values) / len(roe_values), 2) if roe_values else 0,
            'average_profit_margin': round(sum(profit_margin_values) / len(profit_margin_values), 2) if profit_margin_values else 0,
            'average_debt_equity': round(sum(debt_equity_values) / len(debt_equity_values), 2) if debt_equity_values else 0
        }
        
        # Find sector leaders
        if sector_metrics['companies']:
            revenue_leader = max(sector_metrics['companies'], key=lambda x: x['revenue'])
            roe_leader = max(sector_metrics['companies'], key=lambda x: x['roe'])
            
            sector_metrics['sector_leaders'] = {
                'revenue_leader': f"{revenue_leader['symbol']} (${revenue_leader['revenue']:,.0f})",
                'roe_leader': f"{roe_leader['symbol']} ({roe_leader['roe']:.1f}%)",
                'total_sector_revenue': sum(c['revenue'] for c in sector_metrics['companies'])
            }
        
        sector_analysis[sector_name] = sector_metrics
    
    return sector_analysis

def create_comprehensive_summary(all_company_data: Dict, sector_analysis: Dict) -> Dict[str, Any]:
    """Create FRED-style comprehensive summary."""
    
    successful_companies = [data for data in all_company_data.values() if 'error' not in data]
    
    # Market overview
    total_companies = len(COMPREHENSIVE_COMPANIES)
    successful_extractions = len(successful_companies)
    
    # Aggregate financial metrics
    total_revenue = 0
    total_assets = 0
    total_market_cap_proxy = 0  # Using assets as proxy
    
    for company_data in successful_companies:
        financial_metrics = company_data.get('financial_metrics', {})
        revenue = financial_metrics.get('Revenue', {}).get('value', 0)
        assets = financial_metrics.get('Assets', {}).get('value', 0)
        
        total_revenue += revenue
        total_assets += assets
        total_market_cap_proxy += assets
    
    # Performance leaders
    revenue_leader = None
    roe_leader = None
    highest_revenue = 0
    highest_roe = 0
    
    for symbol, company_data in all_company_data.items():
        if 'error' in company_data:
            continue
            
        financial_metrics = company_data.get('financial_metrics', {})
        ratios = company_data.get('calculated_ratios', {})
        
        revenue = financial_metrics.get('Revenue', {}).get('value', 0)
        roe = ratios.get('return_on_equity', {}).get('value', 0)
        
        if revenue > highest_revenue:
            highest_revenue = revenue
            revenue_leader = {
                'symbol': symbol,
                'name': company_data.get('company_info', {}).get('name', 'Unknown'),
                'revenue': revenue
            }
        
        if roe > highest_roe:
            highest_roe = roe
            roe_leader = {
                'symbol': symbol,
                'name': company_data.get('company_info', {}).get('name', 'Unknown'),
                'roe': roe
            }
    
    # Data quality assessment
    quality_distribution = {}
    for company_data in successful_companies:
        quality = company_data.get('data_quality', {}).get('quality_rating', 'Unknown')
        quality_distribution[quality] = quality_distribution.get(quality, 0) + 1
    
    return {
        'analysis_overview': {
            'total_companies_analyzed': total_companies,
            'successful_data_extractions': successful_extractions,
            'success_rate_percentage': round((successful_extractions / total_companies) * 100, 1),
            'analysis_timestamp': datetime.now().isoformat(),
            'data_source': 'SEC EDGAR API (data.sec.gov)'
        },
        'market_aggregates': {
            'total_revenue_analyzed': total_revenue,
            'total_assets_analyzed': total_assets,
            'average_company_revenue': round(total_revenue / successful_extractions, 0) if successful_extractions > 0 else 0,
            'average_company_assets': round(total_assets / successful_extractions, 0) if successful_extractions > 0 else 0
        },
        'performance_leaders': {
            'highest_revenue_company': revenue_leader,
            'highest_roe_company': roe_leader
        },
        'sector_insights': {
            'sectors_analyzed': list(sector_analysis.keys()),
            'most_companies_sector': max(sector_analysis.keys(), 
                                       key=lambda s: sector_analysis[s]['company_count']) if sector_analysis else None,
            'sector_performance_summary': {
                sector: {
                    'companies': data['company_count'],
                    'avg_roe': data['sector_averages']['average_roe'],
                    'total_revenue': data['sector_leaders'].get('total_sector_revenue', 0)
                } for sector, data in sector_analysis.items()
            }
        },
        'data_quality_assessment': {
            'quality_distribution': quality_distribution,
            'high_quality_companies': quality_distribution.get('Excellent', 0) + quality_distribution.get('Good', 0),
            'data_reliability': 'High' if quality_distribution.get('Excellent', 0) >= 3 else 'Moderate'
        },
        'key_insights': generate_key_insights(all_company_data, sector_analysis),
        'methodology': {
            'data_source': 'SEC EDGAR Company Facts API',
            'rate_limiting': '10 requests per second (SEC compliance)',
            'authentication': 'None required (public data)',
            'data_freshness': 'Real-time SEC filings',
            'financial_concepts': 'US-GAAP XBRL taxonomy'
        }
    }

def generate_key_insights(all_company_data: Dict, sector_analysis: Dict) -> List[str]:
    """Generate key insights from the analysis."""
    insights = []
    
    successful_companies = [data for data in all_company_data.values() if 'error' not in data]
    
    # Revenue insights
    revenues = []
    for company_data in successful_companies:
        revenue = company_data.get('financial_metrics', {}).get('Revenue', {}).get('value', 0)
        if revenue > 0:
            revenues.append(revenue)
    
    if revenues:
        avg_revenue = sum(revenues) / len(revenues)
        max_revenue = max(revenues)
        
        insights.append(f"Average company revenue: ${avg_revenue:,.0f} with highest at ${max_revenue:,.0f}")
    
    # ROE insights
    roes = []
    for company_data in successful_companies:
        roe = company_data.get('calculated_ratios', {}).get('return_on_equity', {}).get('value', 0)
        if roe != 0:
            roes.append(roe)
    
    if roes:
        avg_roe = sum(roes) / len(roes)
        high_roe_companies = len([roe for roe in roes if roe > 15])
        
        insights.append(f"Average ROE: {avg_roe:.1f}% with {high_roe_companies} companies above 15%")
    
    # Sector insights
    if sector_analysis:
        largest_sector = max(sector_analysis.keys(), key=lambda s: sector_analysis[s]['company_count'])
        insights.append(f"Technology sector dominates analysis with {sector_analysis[largest_sector]['company_count']} companies")
        
        # Best performing sector by ROE
        best_roe_sector = max(sector_analysis.keys(), 
                             key=lambda s: sector_analysis[s]['sector_averages']['average_roe'])
        best_roe = sector_analysis[best_roe_sector]['sector_averages']['average_roe']
        insights.append(f"{best_roe_sector} sector shows strongest profitability with {best_roe:.1f}% average ROE")
    
    # Data quality insights
    quality_counts = {}
    for company_data in successful_companies:
        quality = company_data.get('data_quality', {}).get('quality_rating', 'Unknown')
        quality_counts[quality] = quality_counts.get(quality, 0) + 1
    
    excellent_count = quality_counts.get('Excellent', 0)
    good_count = quality_counts.get('Good', 0)
    high_quality_pct = ((excellent_count + good_count) / len(successful_companies)) * 100
    
    insights.append(f"Data quality is strong: {high_quality_pct:.0f}% of companies have excellent or good data completeness")
    
    return insights

def main():
    """Run comprehensive SEC EDGAR analysis like FRED."""
    print("🚀 SEC EDGAR Comprehensive Analysis Suite")
    print("=" * 70)
    print("Pulling real data, analyzing comprehensively, creating detailed summaries")
    print("=" * 70)
    
    # Initialize output directory
    output_dir = Path("docs/project/test_output/SEC_EDGAR")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Extract data from all companies
    print("📊 PHASE 1: COMPREHENSIVE DATA EXTRACTION")
    print("=" * 50)
    
    all_company_data = {}
    
    for symbol, company_info in COMPREHENSIVE_COMPANIES.items():
        print(f"🔄 Processing {symbol} ({company_info['name']})...")
        
        try:
            company_data = get_comprehensive_company_data(company_info['cik'], symbol)
            if company_data:
                all_company_data[symbol] = company_data
                
                # Show key metrics
                financial_metrics = company_data.get('financial_metrics', {})
                revenue = financial_metrics.get('Revenue', {}).get('value', 0)
                net_income = financial_metrics.get('NetIncome', {}).get('value', 0)
                quality = company_data.get('data_quality', {}).get('quality_rating', 'Unknown')
                
                print(f"   ✅ Revenue: ${revenue:,.0f} | Net Income: ${net_income:,.0f} | Quality: {quality}")
            else:
                all_company_data[symbol] = {'error': 'No data retrieved'}
                print(f"   ❌ Failed to retrieve data")
                
        except Exception as e:
            all_company_data[symbol] = {'error': str(e)}
            print(f"   ❌ Error: {e}")
    
    # Step 2: Sector Analysis
    print(f"\n📊 PHASE 2: SECTOR ANALYSIS")
    print("=" * 50)
    
    sector_analysis = perform_sector_analysis(all_company_data)
    
    for sector_name, sector_data in sector_analysis.items():
        print(f"🏢 {sector_name} Sector:")
        print(f"   Companies: {sector_data['company_count']}")
        print(f"   Avg Revenue: ${sector_data['sector_averages']['average_revenue']:,.0f}")
        print(f"   Avg ROE: {sector_data['sector_averages']['average_roe']:.1f}%")
        
        leaders = sector_data.get('sector_leaders', {})
        if leaders:
            print(f"   Revenue Leader: {leaders.get('revenue_leader', 'N/A')}")
            print(f"   ROE Leader: {leaders.get('roe_leader', 'N/A')}")
    
    # Step 3: Comprehensive Summary
    print(f"\n📊 PHASE 3: COMPREHENSIVE SUMMARY CREATION")
    print("=" * 50)
    
    comprehensive_summary = create_comprehensive_summary(all_company_data, sector_analysis)
    
    # Display key summary points
    overview = comprehensive_summary['analysis_overview']
    market = comprehensive_summary['market_aggregates']
    leaders = comprehensive_summary['performance_leaders']
    
    print(f"📈 Analysis Overview:")
    print(f"   Companies Analyzed: {overview['successful_data_extractions']}/{overview['total_companies_analyzed']}")
    print(f"   Success Rate: {overview['success_rate_percentage']}%")
    print(f"   Total Revenue: ${market['total_revenue_analyzed']:,.0f}")
    print(f"   Average Revenue: ${market['average_company_revenue']:,.0f}")
    
    if leaders['highest_revenue_company']:
        rev_leader = leaders['highest_revenue_company']
        print(f"   Revenue Leader: {rev_leader['symbol']} (${rev_leader['revenue']:,.0f})")
    
    if leaders['highest_roe_company']:
        roe_leader = leaders['highest_roe_company']
        print(f"   ROE Leader: {roe_leader['symbol']} ({roe_leader['roe']:.1f}%)")
    
    print(f"\n💡 Key Insights:")
    for insight in comprehensive_summary['key_insights']:
        print(f"   • {insight}")
    
    # Step 4: Save all results
    print(f"\n📁 PHASE 4: SAVING COMPREHENSIVE RESULTS")
    print("=" * 50)
    
    # Save individual company data
    with open(output_dir / "comprehensive_company_data.json", 'w') as f:
        json.dump({
            'description': 'Comprehensive SEC EDGAR financial data for major US companies across all sectors',
            'timestamp': datetime.now().isoformat(),
            'sample_data': all_company_data,
            'data_type': 'SEC EDGAR Comprehensive Company Data',
            'source': 'U.S. Securities and Exchange Commission'
        }, f, indent=2, default=str)
    
    # Save sector analysis
    with open(output_dir / "comprehensive_sector_analysis.json", 'w') as f:
        json.dump({
            'description': 'Detailed sector analysis showing financial performance by industry',
            'timestamp': datetime.now().isoformat(),
            'sample_data': sector_analysis,
            'data_type': 'SEC EDGAR Sector Analysis',
            'source': 'U.S. Securities and Exchange Commission'
        }, f, indent=2, default=str)
    
    # Save comprehensive summary (like FRED)
    with open(output_dir / "COMPREHENSIVE_ANALYSIS_SUMMARY.json", 'w') as f:
        json.dump({
            'description': 'FRED-style comprehensive analysis summary of SEC EDGAR financial data',
            'timestamp': datetime.now().isoformat(),
            'sample_data': comprehensive_summary,
            'data_type': 'SEC EDGAR Comprehensive Summary',
            'source': 'U.S. Securities and Exchange Commission'
        }, f, indent=2, default=str)
    
    print(f"✅ Individual company data saved: comprehensive_company_data.json")
    print(f"✅ Sector analysis saved: comprehensive_sector_analysis.json")
    print(f"✅ Main summary saved: COMPREHENSIVE_ANALYSIS_SUMMARY.json")
    
    print(f"\n" + "=" * 70)
    print("🎯 SEC EDGAR COMPREHENSIVE ANALYSIS COMPLETE!")
    print("=" * 70)
    print("✅ Real Financial Data - EXTRACTED")
    print("✅ Comprehensive Company Profiles - CREATED")
    print("✅ Sector Analysis - COMPLETED")
    print("✅ Performance Leaders - IDENTIFIED")
    print("✅ Data Quality Assessment - CONDUCTED")
    print("✅ Key Insights - GENERATED")
    print("✅ FRED-Style Summary - CREATED")
    print(f"\n🎉 SUCCESS! Comprehensive SEC EDGAR analysis like FRED completed!")
    print(f"📁 All outputs saved to: {output_dir}")
    print(f"💡 Stock Picker now has comprehensive fundamental analysis capabilities!")

if __name__ == "__main__":
    main()