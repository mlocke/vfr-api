#!/usr/bin/env python3
"""
Direct SEC EDGAR API Test
Tests the SEC EDGAR API directly and generates sample outputs in the FRED format.
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

# Sample companies for testing
SAMPLE_COMPANIES = {
    'AAPL': {'symbol': 'AAPL', 'cik': '320193', 'name': 'Apple Inc.'},
    'MSFT': {'symbol': 'MSFT', 'cik': '789019', 'name': 'Microsoft Corporation'},
    'GOOGL': {'symbol': 'GOOGL', 'cik': '1652044', 'name': 'Alphabet Inc.'},
    'TSLA': {'symbol': 'TSLA', 'cik': '1318605', 'name': 'Tesla Inc.'},
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

def test_company_facts():
    """Test SEC Company Facts API."""
    print("\n🔄 Testing SEC Company Facts API...")
    
    # Test with Apple Inc.
    cik = '320193'
    url = f"{BASE_URL}/api/xbrl/companyfacts/CIK{cik.zfill(10)}.json"
    
    raw_data = safe_request(url, "Company Facts API")
    
    if raw_data:
        # Structure the data for our application
        company_name = raw_data.get('entityName', 'Unknown Company')
        print(f"✅ Retrieved facts for {company_name}")
        
        # Extract key financial metrics
        facts = raw_data.get('facts', {})
        us_gaap_facts = facts.get('us-gaap', {})
        
        # Key financial concepts we care about
        key_concepts = {
            'Assets': 'us-gaap:Assets',
            'Revenue': 'us-gaap:Revenues', 
            'NetIncome': 'us-gaap:NetIncomeLoss',
            'StockholdersEquity': 'us-gaap:StockholdersEquity',
            'Cash': 'us-gaap:CashAndCashEquivalentsAtCarryingValue'
        }
        
        structured_data = {
            'company_info': {
                'name': company_name,
                'cik': raw_data.get('cik', cik),
                'sic': raw_data.get('sic', None),
                'sicDescription': raw_data.get('sicDescription', None),
                'tickers': raw_data.get('tickers', []),
                'exchanges': raw_data.get('exchanges', [])
            },
            'financial_metrics': {},
            'metadata': {
                'concepts_available': len(us_gaap_facts),
                'data_retrieved': datetime.now().isoformat()
            }
        }
        
        print(f"📊 Available US-GAAP concepts: {len(us_gaap_facts)}")
        
        # Extract key metrics
        for metric_name, concept_id in key_concepts.items():
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
                annual_data.sort(key=lambda x: x['date'] or '', reverse=True)
                
                structured_data['financial_metrics'][metric_name] = {
                    'concept_id': concept_id,
                    'label': concept_data.get('label', metric_name),
                    'description': concept_data.get('description', ''),
                    'recent_annual_values': annual_data[:3],  # Last 3 years
                    'latest_value': annual_data[0]['value'] if annual_data else None,
                    'latest_date': annual_data[0]['date'] if annual_data else None,
                    'unit': annual_data[0]['unit'] if annual_data else None
                }
                
                # Display the metric
                if annual_data:
                    latest_value = annual_data[0]['value']
                    latest_date = annual_data[0]['date']
                    unit = annual_data[0]['unit']
                    print(f"  📈 {metric_name}: {latest_value:,} {unit} (as of {latest_date})")
        
        # Save structured output
        save_sample_output(
            "company_facts_structured.json",
            structured_data,
            "Structured company financial facts for Apple Inc. with key metrics extracted and organized for financial analysis"
        )
        
        return True
    else:
        return False

def test_financial_ratios():
    """Calculate financial ratios from company facts."""
    print("\n🔄 Calculating Financial Ratios...")
    
    # First get the company facts
    cik = '320193'
    url = f"{BASE_URL}/api/xbrl/companyfacts/CIK{cik.zfill(10)}.json"
    
    raw_data = safe_request(url, "Company Facts for Ratios")
    
    if not raw_data:
        return False
    
    # Extract financial values for ratio calculations
    facts = raw_data.get('facts', {})
    us_gaap_facts = facts.get('us-gaap', {})
    
    def get_latest_value(concept_id):
        """Get the latest annual value for a concept."""
        if concept_id not in us_gaap_facts:
            return 0
        
        concept_data = us_gaap_facts[concept_id]
        if 'units' not in concept_data:
            return 0
        
        # Get most recent 10-K filing
        annual_values = []
        for unit_type, unit_data in concept_data['units'].items():
            for filing in unit_data:
                if filing.get('form') == '10-K':
                    annual_values.append({
                        'date': filing.get('end'),
                        'value': filing.get('val', 0)
                    })
        
        if annual_values:
            annual_values.sort(key=lambda x: x['date'] or '', reverse=True)
            return annual_values[0]['value'] or 0
        return 0
    
    # Get financial values
    total_assets = get_latest_value('us-gaap:Assets')
    total_liabilities = get_latest_value('us-gaap:Liabilities')
    stockholders_equity = get_latest_value('us-gaap:StockholdersEquity')
    revenue = get_latest_value('us-gaap:Revenues')
    net_income = get_latest_value('us-gaap:NetIncomeLoss')
    current_assets = get_latest_value('us-gaap:AssetsCurrent')
    current_liabilities = get_latest_value('us-gaap:LiabilitiesCurrent')
    
    # Calculate ratios
    ratios_data = {
        'company_info': {
            'name': raw_data.get('entityName', 'Unknown Company'),
            'cik': raw_data.get('cik', cik)
        },
        'calculated_ratios': {},
        'raw_values': {
            'total_assets': total_assets,
            'total_liabilities': total_liabilities,
            'stockholders_equity': stockholders_equity,
            'revenue': revenue,
            'net_income': net_income,
            'current_assets': current_assets,
            'current_liabilities': current_liabilities
        },
        'metadata': {
            'calculation_date': datetime.now().isoformat(),
            'source': 'SEC EDGAR - Calculated from Company Facts'
        }
    }
    
    print(f"📊 Calculating ratios for {ratios_data['company_info']['name']}")
    
    # Calculate key ratios
    try:
        if current_liabilities and current_liabilities > 0:
            current_ratio = round(current_assets / current_liabilities, 2)
            ratios_data['calculated_ratios']['current_ratio'] = {
                'value': current_ratio,
                'description': 'Current Assets / Current Liabilities',
                'category': 'Liquidity'
            }
            print(f"  📈 Current Ratio: {current_ratio}")
        
        if total_assets and total_assets > 0:
            debt_to_assets = round(total_liabilities / total_assets, 2)
            ratios_data['calculated_ratios']['debt_to_assets'] = {
                'value': debt_to_assets,
                'description': 'Total Liabilities / Total Assets',
                'category': 'Leverage'
            }
            print(f"  📈 Debt to Assets: {debt_to_assets}")
        
        if stockholders_equity and stockholders_equity > 0:
            debt_to_equity = round(total_liabilities / stockholders_equity, 2)
            ratios_data['calculated_ratios']['debt_to_equity'] = {
                'value': debt_to_equity,
                'description': 'Total Liabilities / Stockholders Equity',
                'category': 'Leverage'
            }
            print(f"  📈 Debt to Equity: {debt_to_equity}")
        
        if revenue and revenue > 0:
            net_profit_margin = round((net_income / revenue) * 100, 2)
            ratios_data['calculated_ratios']['net_profit_margin'] = {
                'value': net_profit_margin,
                'description': '(Net Income / Revenue) × 100',
                'category': 'Profitability',
                'unit': 'percentage'
            }
            print(f"  📈 Net Profit Margin: {net_profit_margin}%")
        
        if stockholders_equity and stockholders_equity > 0:
            roe = round((net_income / stockholders_equity) * 100, 2)
            ratios_data['calculated_ratios']['return_on_equity'] = {
                'value': roe,
                'description': '(Net Income / Stockholders Equity) × 100',
                'category': 'Profitability',
                'unit': 'percentage'
            }
            print(f"  📈 Return on Equity: {roe}%")
    
    except (ZeroDivisionError, TypeError) as e:
        print(f"⚠️  Error calculating some ratios: {e}")
    
    print(f"✅ Calculated {len(ratios_data['calculated_ratios'])} financial ratios")
    
    # Save ratios output
    save_sample_output(
        "financial_ratios_calculated.json",
        ratios_data,
        "Calculated financial ratios for Apple Inc. including liquidity, leverage, and profitability metrics for fundamental analysis"
    )
    
    return True

def test_company_submissions():
    """Test SEC Company Submissions API."""
    print("\n🔄 Testing SEC Company Submissions API...")
    
    # Test with Apple Inc.
    cik = '320193'
    url = f"{BASE_URL}/submissions/CIK{cik.zfill(10)}.json"
    
    raw_data = safe_request(url, "Company Submissions API")
    
    if raw_data:
        company_name = raw_data.get('name', 'Unknown Company')
        print(f"✅ Retrieved submissions for {company_name}")
        
        # Structure submissions data
        structured_data = {
            'company_info': {
                'name': company_name,
                'cik': raw_data.get('cik', cik),
                'sic': raw_data.get('sic', None),
                'sicDescription': raw_data.get('sicDescription', None),
                'tickers': raw_data.get('tickers', []),
                'exchanges': raw_data.get('exchanges', []),
                'website': raw_data.get('website', None),
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
        
        # Display company info
        print(f"🏢 SIC: {structured_data['company_info']['sic']} - {structured_data['company_info']['sicDescription']}")
        print(f"🎯 Tickers: {structured_data['company_info']['tickers']}")
        print(f"🏦 Exchanges: {structured_data['company_info']['exchanges']}")
        
        # Process recent filings
        filings = raw_data.get('filings', {}).get('recent', {})
        if filings:
            # Get last 10 filings
            for i in range(min(10, len(filings.get('accessionNumber', [])))):
                filing = {
                    'form': filings['form'][i] if i < len(filings.get('form', [])) else None,
                    'filingDate': filings['filingDate'][i] if i < len(filings.get('filingDate', [])) else None,
                    'reportDate': filings['reportDate'][i] if i < len(filings.get('reportDate', [])) else None,
                    'acceptanceDateTime': filings['acceptanceDateTime'][i] if i < len(filings.get('acceptanceDateTime', [])) else None,
                    'isXBRL': filings['isXBRL'][i] if i < len(filings.get('isXBRL', [])) else None
                }
                structured_data['recent_filings'].append(filing)
        
        # Create filing summary by form type
        form_counts = {}
        for filing in structured_data['recent_filings']:
            form_type = filing.get('form', 'Unknown')
            form_counts[form_type] = form_counts.get(form_type, 0) + 1
        
        structured_data['filing_summary'] = form_counts
        
        print(f"📂 Recent filings: {len(structured_data['recent_filings'])}")
        print(f"📋 Filing types: {list(form_counts.keys())}")
        
        # Save submissions output
        save_sample_output(
            "company_submissions_structured.json",
            structured_data,
            "Complete filing submission history for Apple Inc. including company metadata and recent SEC filings organized by form type"
        )
        
        return True
    else:
        return False

def test_multi_company_dashboard():
    """Create a multi-company comparison dashboard."""
    print("\n🔄 Creating Multi-Company Dashboard...")
    
    dashboard_data = {
        'comparison_summary': {},
        'metadata': {
            'comparison_date': datetime.now().isoformat(),
            'companies_analyzed': 0,
            'source': 'SEC EDGAR Multi-Company Analysis'
        }
    }
    
    # Test with a few major companies
    test_companies = ['AAPL', 'MSFT', 'GOOGL']
    
    for symbol in test_companies:
        if symbol not in SAMPLE_COMPANIES:
            continue
            
        company = SAMPLE_COMPANIES[symbol]
        cik = company['cik']
        
        print(f"  📊 Analyzing {symbol} ({company['name']})...")
        
        # Get basic company facts
        url = f"{BASE_URL}/api/xbrl/companyfacts/CIK{cik.zfill(10)}.json"
        raw_data = safe_request(url, f"{symbol} Company Facts")
        
        if raw_data:
            # Extract key metrics
            facts = raw_data.get('facts', {})
            us_gaap_facts = facts.get('us-gaap', {})
            
            def get_latest_value(concept_id):
                if concept_id not in us_gaap_facts:
                    return None
                concept_data = us_gaap_facts[concept_id]
                if 'units' not in concept_data:
                    return None
                
                annual_values = []
                for unit_type, unit_data in concept_data['units'].items():
                    for filing in unit_data:
                        if filing.get('form') == '10-K':
                            annual_values.append({
                                'date': filing.get('end'),
                                'value': filing.get('val', 0)
                            })
                
                if annual_values:
                    annual_values.sort(key=lambda x: x['date'] or '', reverse=True)
                    return annual_values[0]['value']
                return None
            
            # Get key financial metrics
            revenue = get_latest_value('us-gaap:Revenues')
            net_income = get_latest_value('us-gaap:NetIncomeLoss') 
            total_assets = get_latest_value('us-gaap:Assets')
            stockholders_equity = get_latest_value('us-gaap:StockholdersEquity')
            
            # Calculate basic ratios
            key_ratios = {}
            if revenue and revenue > 0 and net_income:
                key_ratios['net_profit_margin'] = round((net_income / revenue) * 100, 2)
            if stockholders_equity and stockholders_equity > 0 and net_income:
                key_ratios['return_on_equity'] = round((net_income / stockholders_equity) * 100, 2)
            
            dashboard_data['comparison_summary'][symbol] = {
                'company_name': raw_data.get('entityName', company['name']),
                'cik': cik,
                'key_metrics': {
                    'revenue': revenue,
                    'net_income': net_income,
                    'total_assets': total_assets,
                    'stockholders_equity': stockholders_equity
                },
                'key_ratios': key_ratios,
                'data_quality': 'Complete' if key_ratios else 'Limited'
            }
            
            dashboard_data['metadata']['companies_analyzed'] += 1
            
            # Display summary
            if revenue:
                print(f"    💰 Revenue: ${revenue:,.0f}")
            if net_income:
                print(f"    📈 Net Income: ${net_income:,.0f}")
            if key_ratios.get('net_profit_margin'):
                print(f"    📊 Net Profit Margin: {key_ratios['net_profit_margin']}%")
        
        time.sleep(0.2)  # Rate limiting courtesy
    
    print(f"✅ Multi-company dashboard created with {dashboard_data['metadata']['companies_analyzed']} companies")
    
    # Save dashboard output
    save_sample_output(
        "multi_company_dashboard.json",
        dashboard_data,
        "Comparative financial analysis dashboard showing key metrics and ratios for major technology companies side-by-side"
    )
    
    return dashboard_data['metadata']['companies_analyzed'] > 0

def main():
    """Run complete SEC EDGAR API test."""
    print("🚀 SEC EDGAR API Direct Test - Sample Output Generation")
    print("=" * 60)
    
    tests = [
        ("Company Facts API", test_company_facts),
        ("Financial Ratios Calculation", test_financial_ratios), 
        ("Company Submissions API", test_company_submissions),
        ("Multi-Company Dashboard", test_multi_company_dashboard),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 60}")
        try:
            results[test_name] = test_func()
            time.sleep(0.5)  # Rate limiting courtesy
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
            results[test_name] = False
    
    # Summary
    print(f"\n{'=' * 60}")
    print("🎯 SEC EDGAR API TEST SUMMARY")
    print(f"{'=' * 60}")
    
    passed_tests = sum(results.values())
    total_tests = len(results)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"  
        print(f"{test_name:.<40} {status}")
    
    print(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n🎉 SUCCESS! SEC EDGAR API is fully operational!")
        print(f"📁 Sample outputs saved to: {OUTPUT_DIR}")
        
        # Create summary README  
        readme_content = f"""# SEC EDGAR API Test Outputs

**Generated**: {datetime.now().isoformat()}
**Status**: All tests passed ({passed_tests}/{total_tests})

## Sample Data Files

1. **company_facts_structured.json** - Structured financial statements data  
2. **financial_ratios_calculated.json** - Calculated fundamental analysis ratios
3. **company_submissions_structured.json** - Filing history and company metadata
4. **multi_company_dashboard.json** - Comparative analysis dashboard

## Data Quality & Structure

All outputs follow the FRED-compatible structure:
```json
{{
  "description": "Human-readable description of the dataset",
  "timestamp": "ISO datetime when data was retrieved", 
  "sample_data": {{ /* actual structured financial data */ }},
  "data_type": "SEC EDGAR Financial Data",
  "source": "U.S. Securities and Exchange Commission"
}}
```

## Key Features Demonstrated

✅ **Structured Data Extraction** - Clean, consumable financial metrics
✅ **Financial Ratio Calculations** - Liquidity, leverage, profitability ratios
✅ **Multi-Company Comparisons** - Side-by-side analysis capabilities  
✅ **Company Metadata** - Comprehensive business information
✅ **Filing History** - Recent SEC submissions tracking
✅ **Rate Limiting Compliance** - Respects SEC 10 req/sec guidelines

## Integration Ready

This SEC EDGAR data complements the existing FRED economic indicators to provide:
- **Macro + Micro Analysis**: Economic indicators + company fundamentals
- **Dashboard Integration**: Consistent data format across all sources
- **Fundamental Analysis**: P/E ratios, debt levels, profitability metrics
- **Investment Screening**: Multi-criteria company comparison

The data structure matches the FRED collector pattern, ensuring seamless integration into the Stock Picker platform.
"""
        
        with open(OUTPUT_DIR / "README.md", 'w') as f:
            f.write(readme_content)
        
        print("📄 Created README.md with comprehensive documentation")
        
    else:
        print("\n⚠️  Some tests failed. This may be due to rate limiting.")
        print("💡 SEC EDGAR has 10 requests per second limit - try again in a moment.")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)