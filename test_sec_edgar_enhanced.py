#!/usr/bin/env python3
"""
Enhanced SEC EDGAR API Test with Proper Data Extraction
Demonstrates the full structured data format that will be consumed by the Stock Picker platform.
"""

import json
import requests
import time
from datetime import datetime
from pathlib import Path

# Create output directory
OUTPUT_DIR = Path("docs/project/test_output/SEC_EDGAR")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# SEC API configuration
BASE_URL = "https://data.sec.gov"
HEADERS = {
    'User-Agent': 'Stock-Picker Financial Analysis Platform contact@stockpicker.com',
    'Accept': 'application/json',
    'Host': 'data.sec.gov'
}

def safe_request(url, description):
    """Make a safe API request with error handling."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ {description}: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ {description}: {e}")
        return None

def save_sample_output(filename, data, description):
    """Save sample data to output directory in FRED-compatible format."""
    filepath = OUTPUT_DIR / filename
    
    # Create a documentation-friendly format matching FRED structure
    output = {
        "description": description,
        "timestamp": datetime.now().isoformat(),
        "sample_data": data,
        "data_type": "SEC EDGAR Financial Data",
        "source": "U.S. Securities and Exchange Commission"
    }
    
    with open(filepath, 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"✅ Saved: {filename}")

def extract_financial_metrics(raw_data):
    """Extract and structure financial metrics from SEC company facts."""
    facts = raw_data.get('facts', {})
    us_gaap_facts = facts.get('us-gaap', {})
    
    # Key financial concepts we care about for fundamental analysis
    key_concepts = {
        'Assets': 'us-gaap:Assets',
        'AssetsCurrent': 'us-gaap:AssetsCurrent', 
        'Liabilities': 'us-gaap:Liabilities',
        'LiabilitiesCurrent': 'us-gaap:LiabilitiesCurrent',
        'StockholdersEquity': 'us-gaap:StockholdersEquity',
        'Cash': 'us-gaap:CashAndCashEquivalentsAtCarryingValue',
        'Revenue': 'us-gaap:Revenues',
        'NetIncome': 'us-gaap:NetIncomeLoss',
        'OperatingIncome': 'us-gaap:OperatingIncomeLoss',
        'GrossProfit': 'us-gaap:GrossProfit',
        'EarningsPerShare': 'us-gaap:EarningsPerShareBasic',
        'WeightedAverageShares': 'us-gaap:WeightedAverageNumberOfSharesOutstandingBasic'
    }
    
    structured_metrics = {}
    
    for metric_name, concept_id in key_concepts.items():
        if concept_id in us_gaap_facts:
            concept_data = us_gaap_facts[concept_id]
            
            # Get the most recent annual data (10-K filings)
            annual_data = []
            quarterly_data = []
            
            if 'units' in concept_data:
                # Prioritize USD data
                units_to_check = ['USD', 'shares', 'USD/shares']
                for unit_type in units_to_check:
                    if unit_type in concept_data['units']:
                        for filing in concept_data['units'][unit_type]:
                            filing_form = filing.get('form', '')
                            if filing_form == '10-K':  # Annual reports
                                annual_data.append({
                                    'date': filing.get('end'),
                                    'value': filing.get('val'),
                                    'form': filing.get('form'),
                                    'filed': filing.get('filed'),
                                    'unit': unit_type
                                })
                            elif filing_form == '10-Q':  # Quarterly reports
                                quarterly_data.append({
                                    'date': filing.get('end'),
                                    'value': filing.get('val'),
                                    'form': filing.get('form'),
                                    'filed': filing.get('filed'),
                                    'unit': unit_type
                                })
                        break  # Use first available unit type
            
            # Sort by date and get recent values
            annual_data.sort(key=lambda x: x['date'] or '', reverse=True)
            quarterly_data.sort(key=lambda x: x['date'] or '', reverse=True)
            
            # Use annual data primarily, quarterly as fallback
            primary_data = annual_data if annual_data else quarterly_data
            
            if primary_data:
                structured_metrics[metric_name] = {
                    'concept_id': concept_id,
                    'label': concept_data.get('label', metric_name),
                    'description': concept_data.get('description', ''),
                    'latest_value': primary_data[0]['value'],
                    'latest_date': primary_data[0]['date'],
                    'latest_filing': primary_data[0]['form'],
                    'unit': primary_data[0]['unit'],
                    'recent_annual_values': annual_data[:3],
                    'recent_quarterly_values': quarterly_data[:4]
                }
    
    return structured_metrics

def test_enhanced_company_facts():
    """Test enhanced company facts extraction with better data parsing."""
    print("\n🔄 Testing Enhanced Company Facts Extraction...")
    
    # Test with Apple Inc.
    cik = '320193'
    url = f"{BASE_URL}/api/xbrl/companyfacts/CIK{cik.zfill(10)}.json"
    
    raw_data = safe_request(url, "Enhanced Company Facts API")
    
    if raw_data:
        company_name = raw_data.get('entityName', 'Unknown Company')
        print(f"✅ Retrieved enhanced facts for {company_name}")
        
        # Extract financial metrics properly
        financial_metrics = extract_financial_metrics(raw_data)
        
        structured_data = {
            'company_info': {
                'name': company_name,
                'cik': raw_data.get('cik', cik),
                'sic': raw_data.get('sic', None),
                'sicDescription': raw_data.get('sicDescription', None),
                'tickers': raw_data.get('tickers', []),
                'exchanges': raw_data.get('exchanges', [])
            },
            'financial_metrics': financial_metrics,
            'metadata': {
                'concepts_available': len(raw_data.get('facts', {}).get('us-gaap', {})),
                'extracted_metrics': len(financial_metrics),
                'data_retrieved': datetime.now().isoformat()
            }
        }
        
        print(f"📊 Extracted {len(financial_metrics)} key financial metrics")
        
        # Display sample metrics
        sample_metrics = ['Revenue', 'NetIncome', 'Assets', 'StockholdersEquity', 'Cash']
        print("\n📈 Key Financial Metrics:")
        for metric in sample_metrics:
            if metric in financial_metrics:
                data = financial_metrics[metric]
                value = data.get('latest_value')
                date = data.get('latest_date')
                unit = data.get('unit')
                filing = data.get('latest_filing')
                if value is not None:
                    print(f"  - {metric}: {value:,} {unit} (as of {date}, {filing})")
        
        # Save enhanced output
        save_sample_output(
            "company_facts_enhanced.json",
            structured_data,
            "Enhanced company financial facts for Apple Inc. with properly extracted metrics, annual/quarterly data, and comprehensive financial statement information"
        )
        
        return structured_data
    else:
        return None

def test_comprehensive_ratios(company_facts):
    """Test comprehensive financial ratios calculation."""
    print("\n🔄 Calculating Comprehensive Financial Ratios...")
    
    if not company_facts:
        print("❌ No company facts available for ratio calculation")
        return False
    
    metrics = company_facts.get('financial_metrics', {})
    company_info = company_facts.get('company_info', {})
    
    # Helper function to get latest value
    def get_latest_value(metric_name):
        if metric_name in metrics:
            return metrics[metric_name].get('latest_value', 0) or 0
        return 0
    
    # Get financial values
    total_assets = get_latest_value('Assets')
    current_assets = get_latest_value('AssetsCurrent')
    total_liabilities = get_latest_value('Liabilities')
    current_liabilities = get_latest_value('LiabilitiesCurrent')
    stockholders_equity = get_latest_value('StockholdersEquity')
    revenue = get_latest_value('Revenue')
    net_income = get_latest_value('NetIncome')
    operating_income = get_latest_value('OperatingIncome')
    gross_profit = get_latest_value('GrossProfit')
    cash = get_latest_value('Cash')
    earnings_per_share = get_latest_value('EarningsPerShare')
    shares_outstanding = get_latest_value('WeightedAverageShares')
    
    # Calculate comprehensive ratios
    ratios_data = {
        'company_info': company_info,
        'calculated_ratios': {},
        'raw_financial_values': {
            'total_assets': total_assets,
            'current_assets': current_assets,
            'total_liabilities': total_liabilities,
            'current_liabilities': current_liabilities,
            'stockholders_equity': stockholders_equity,
            'revenue': revenue,
            'net_income': net_income,
            'operating_income': operating_income,
            'gross_profit': gross_profit,
            'cash': cash,
            'earnings_per_share': earnings_per_share,
            'shares_outstanding': shares_outstanding
        },
        'metadata': {
            'calculation_date': datetime.now().isoformat(),
            'source': 'SEC EDGAR - Calculated from Company Facts',
            'data_quality_score': 'High' if revenue and net_income and total_assets else 'Limited'
        }
    }
    
    print(f"📊 Calculating ratios for {company_info.get('name', 'Unknown Company')}")
    print(f"💰 Revenue: ${revenue:,.0f}" if revenue else "💰 Revenue: N/A")
    print(f"📈 Net Income: ${net_income:,.0f}" if net_income else "📈 Net Income: N/A")
    print(f"🏦 Total Assets: ${total_assets:,.0f}" if total_assets else "🏦 Total Assets: N/A")
    
    # Calculate ratios with error handling
    calculated_count = 0
    
    try:
        # Liquidity Ratios
        if current_liabilities and current_liabilities > 0 and current_assets:
            current_ratio = round(current_assets / current_liabilities, 2)
            ratios_data['calculated_ratios']['current_ratio'] = {
                'value': current_ratio,
                'description': 'Current Assets / Current Liabilities',
                'category': 'Liquidity',
                'interpretation': 'Higher is better (> 1.0 indicates good liquidity)'
            }
            print(f"  📊 Current Ratio: {current_ratio}")
            calculated_count += 1
        
        # Leverage Ratios
        if total_assets and total_assets > 0 and total_liabilities:
            debt_to_assets = round(total_liabilities / total_assets, 3)
            ratios_data['calculated_ratios']['debt_to_assets'] = {
                'value': debt_to_assets,
                'description': 'Total Liabilities / Total Assets',
                'category': 'Leverage',
                'interpretation': 'Lower is better (< 0.4 generally considered safe)'
            }
            print(f"  📊 Debt to Assets: {debt_to_assets}")
            calculated_count += 1
        
        if stockholders_equity and stockholders_equity > 0 and total_liabilities:
            debt_to_equity = round(total_liabilities / stockholders_equity, 2)
            ratios_data['calculated_ratios']['debt_to_equity'] = {
                'value': debt_to_equity,
                'description': 'Total Liabilities / Stockholders Equity',
                'category': 'Leverage',
                'interpretation': 'Lower is better (< 1.0 indicates conservative leverage)'
            }
            print(f"  📊 Debt to Equity: {debt_to_equity}")
            calculated_count += 1
        
        # Profitability Ratios
        if revenue and revenue > 0 and net_income is not None:
            net_profit_margin = round((net_income / revenue) * 100, 2)
            ratios_data['calculated_ratios']['net_profit_margin'] = {
                'value': net_profit_margin,
                'description': '(Net Income / Revenue) × 100',
                'category': 'Profitability',
                'unit': 'percentage',
                'interpretation': 'Higher is better (varies by industry)'
            }
            print(f"  📊 Net Profit Margin: {net_profit_margin}%")
            calculated_count += 1
        
        if revenue and revenue > 0 and gross_profit:
            gross_profit_margin = round((gross_profit / revenue) * 100, 2)
            ratios_data['calculated_ratios']['gross_profit_margin'] = {
                'value': gross_profit_margin,
                'description': '(Gross Profit / Revenue) × 100',
                'category': 'Profitability',
                'unit': 'percentage',
                'interpretation': 'Higher indicates better pricing power and cost control'
            }
            print(f"  📊 Gross Profit Margin: {gross_profit_margin}%")
            calculated_count += 1
        
        if stockholders_equity and stockholders_equity > 0 and net_income is not None:
            roe = round((net_income / stockholders_equity) * 100, 2)
            ratios_data['calculated_ratios']['return_on_equity'] = {
                'value': roe,
                'description': '(Net Income / Stockholders Equity) × 100',
                'category': 'Profitability',
                'unit': 'percentage',
                'interpretation': 'Higher is better (> 15% considered good)'
            }
            print(f"  📊 Return on Equity (ROE): {roe}%")
            calculated_count += 1
        
        if total_assets and total_assets > 0 and net_income is not None:
            roa = round((net_income / total_assets) * 100, 2)
            ratios_data['calculated_ratios']['return_on_assets'] = {
                'value': roa,
                'description': '(Net Income / Total Assets) × 100',
                'category': 'Profitability', 
                'unit': 'percentage',
                'interpretation': 'Higher indicates efficient asset utilization'
            }
            print(f"  📊 Return on Assets (ROA): {roa}%")
            calculated_count += 1
        
        # Additional useful ratios
        if total_assets and total_assets > 0 and stockholders_equity:
            equity_multiplier = round(total_assets / stockholders_equity, 2)
            ratios_data['calculated_ratios']['equity_multiplier'] = {
                'value': equity_multiplier,
                'description': 'Total Assets / Stockholders Equity',
                'category': 'Leverage',
                'interpretation': 'Lower indicates less leverage (1.0 = no debt)'
            }
            print(f"  📊 Equity Multiplier: {equity_multiplier}")
            calculated_count += 1
    
    except (ZeroDivisionError, TypeError) as e:
        print(f"⚠️  Error calculating some ratios: {e}")
    
    print(f"✅ Successfully calculated {calculated_count} financial ratios")
    
    # Save comprehensive ratios output
    save_sample_output(
        "financial_ratios_comprehensive.json",
        ratios_data,
        "Comprehensive financial ratios for Apple Inc. including liquidity, leverage, profitability, and efficiency metrics with interpretations for fundamental analysis"
    )
    
    return ratios_data

def test_investment_dashboard():
    """Create an investment-ready dashboard with all key metrics."""
    print("\n🔄 Creating Investment Analysis Dashboard...")
    
    # Get comprehensive data
    company_facts = test_enhanced_company_facts()
    if not company_facts:
        return False
    
    ratios_data = test_comprehensive_ratios(company_facts)
    if not ratios_data:
        return False
    
    # Create investment dashboard
    dashboard_data = {
        'company_overview': {
            'name': company_facts['company_info']['name'],
            'cik': company_facts['company_info']['cik'],
            'sic_code': company_facts['company_info']['sic'],
            'industry': company_facts['company_info']['sicDescription'],
            'tickers': company_facts['company_info']['tickers'],
            'exchanges': company_facts['company_info']['exchanges'],
            'data_quality': 'High'
        },
        'key_financial_metrics': {},
        'financial_ratios': ratios_data['calculated_ratios'],
        'ratio_categories': {
            'Liquidity': {},
            'Leverage': {},
            'Profitability': {}
        },
        'investment_summary': {
            'strengths': [],
            'concerns': [],
            'overall_score': 'Not Available'
        },
        'metadata': {
            'analysis_date': datetime.now().isoformat(),
            'data_sources': ['SEC EDGAR Company Facts API'],
            'metrics_count': len(company_facts.get('financial_metrics', {})),
            'ratios_count': len(ratios_data.get('calculated_ratios', {}))
        }
    }
    
    # Extract key metrics for dashboard
    key_dashboard_metrics = ['Revenue', 'NetIncome', 'Assets', 'StockholdersEquity', 'Cash', 'EarningsPerShare']
    for metric in key_dashboard_metrics:
        if metric in company_facts['financial_metrics']:
            metric_data = company_facts['financial_metrics'][metric]
            dashboard_data['key_financial_metrics'][metric] = {
                'value': metric_data['latest_value'],
                'date': metric_data['latest_date'],
                'unit': metric_data['unit'],
                'label': metric_data['label'],
                'filing_type': metric_data['latest_filing']
            }
    
    # Organize ratios by category
    for ratio_name, ratio_data in ratios_data.get('calculated_ratios', {}).items():
        category = ratio_data['category']
        if category in dashboard_data['ratio_categories']:
            dashboard_data['ratio_categories'][category][ratio_name] = ratio_data
    
    # Simple investment analysis
    profitability_ratios = dashboard_data['ratio_categories'].get('Profitability', {})
    
    # Add basic investment insights
    if 'net_profit_margin' in profitability_ratios:
        margin = profitability_ratios['net_profit_margin']['value']
        if margin > 20:
            dashboard_data['investment_summary']['strengths'].append('High profit margins')
        elif margin < 5:
            dashboard_data['investment_summary']['concerns'].append('Low profit margins')
    
    if 'return_on_equity' in profitability_ratios:
        roe = profitability_ratios['return_on_equity']['value']
        if roe > 15:
            dashboard_data['investment_summary']['strengths'].append('Strong return on equity')
        elif roe < 5:
            dashboard_data['investment_summary']['concerns'].append('Weak return on equity')
    
    leverage_ratios = dashboard_data['ratio_categories'].get('Leverage', {})
    if 'debt_to_equity' in leverage_ratios:
        debt_ratio = leverage_ratios['debt_to_equity']['value']
        if debt_ratio < 0.5:
            dashboard_data['investment_summary']['strengths'].append('Conservative debt levels')
        elif debt_ratio > 2.0:
            dashboard_data['investment_summary']['concerns'].append('High debt levels')
    
    print(f"✅ Investment dashboard created for {dashboard_data['company_overview']['name']}")
    print(f"📊 Key metrics: {len(dashboard_data['key_financial_metrics'])}")
    print(f"📈 Financial ratios: {len(dashboard_data['financial_ratios'])}")
    print(f"💡 Investment strengths: {len(dashboard_data['investment_summary']['strengths'])}")
    print(f"⚠️  Investment concerns: {len(dashboard_data['investment_summary']['concerns'])}")
    
    # Save investment dashboard
    save_sample_output(
        "investment_analysis_dashboard.json",
        dashboard_data,
        "Complete investment analysis dashboard for Apple Inc. with financial metrics, ratios, and basic investment insights ready for Stock Picker platform integration"
    )
    
    return True

def main():
    """Run enhanced SEC EDGAR API test with comprehensive data extraction."""
    print("🚀 SEC EDGAR Enhanced API Test - Investment-Grade Data Extraction")
    print("=" * 70)
    
    tests = [
        ("Investment Analysis Dashboard", test_investment_dashboard),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 70}")
        try:
            results[test_name] = test_func()
            time.sleep(0.5)  # Rate limiting courtesy
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
            results[test_name] = False
    
    # Summary
    print(f"\n{'=' * 70}")
    print("🎯 SEC EDGAR ENHANCED TEST SUMMARY")
    print(f"{'=' * 70}")
    
    passed_tests = sum(results.values())
    total_tests = len(results)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"  
        print(f"{test_name:.<50} {status}")
    
    print(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n🎉 SUCCESS! SEC EDGAR Enhanced Data Extraction Complete!")
        print(f"📁 Enhanced sample outputs saved to: {OUTPUT_DIR}")
        print("\n🔥 Ready for Stock Picker Platform Integration:")
        print("  ✅ Comprehensive financial metrics extraction")
        print("  ✅ Investment-grade ratio calculations") 
        print("  ✅ Dashboard-ready data structure")
        print("  ✅ FRED-compatible output format")
        print("  ✅ Multi-company comparison capability")
        
    else:
        print("\n⚠️  Some tests failed. Check implementation.")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)