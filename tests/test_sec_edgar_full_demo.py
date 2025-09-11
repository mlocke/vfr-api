#!/usr/bin/env python3
"""
Complete SEC EDGAR Collector Demo with Output Samples
Tests all SEC EDGAR collector capabilities and saves sample outputs to documentation.

This demonstrates the structured, consumable data format that matches the FRED approach
but specifically tailored for fundamental financial analysis.
"""

import os
import json
import sys
import time
from datetime import datetime
from pathlib import Path

# Add the backend to Python path for imports
sys.path.append(str(Path(__file__).parent / "backend" / "data_collectors"))

try:
    from government.sec_edgar_collector import SECEdgarCollector, SAMPLE_COMPANIES
    print("✅ SEC EDGAR Collector imported successfully")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    print("Note: This requires the backend base classes to be implemented")
    exit(1)

# Create output directory for sample data
OUTPUT_DIR = Path("docs/project/test_output/SEC_EDGAR")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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

def test_authentication():
    """Test SEC EDGAR API connectivity."""
    print("\n🔄 Testing SEC EDGAR API Connection...")
    
    collector = SECEdgarCollector()
    
    try:
        is_connected = collector.authenticate()
        if is_connected:
            print("✅ SEC EDGAR API connection successful")
            return True
        else:
            print("❌ SEC EDGAR API connection failed")
            return False
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return False

def test_company_facts():
    """Test Company Facts API - Core financial statements."""
    print("\n🔄 Testing Company Facts API...")
    
    collector = SECEdgarCollector()
    
    # Test with Apple Inc. (CIK: 320193)
    try:
        apple_facts = collector.get_company_facts('320193')
        if apple_facts:
            print(f"✅ Company Facts retrieved for {apple_facts['company_info']['name']}")
            
            # Show available metrics
            metrics_count = len(apple_facts['financial_metrics'])
            print(f"📊 Found {metrics_count} financial metrics")
            
            # Display some key metrics
            key_metrics = ['Revenue', 'NetIncome', 'Assets', 'StockholdersEquity']
            print("\n📈 Key Financial Metrics:")
            for metric in key_metrics:
                if metric in apple_facts['financial_metrics']:
                    latest_value = apple_facts['financial_metrics'][metric]['latest_value']
                    latest_date = apple_facts['financial_metrics'][metric]['latest_date']
                    unit = apple_facts['financial_metrics'][metric]['unit']
                    print(f"  - {metric}: ${latest_value:,} {unit} (as of {latest_date})")
            
            # Save sample output
            save_sample_output(
                "company_facts_apple.json",
                apple_facts,
                "Complete company financial facts for Apple Inc. including balance sheet, income statement, and cash flow metrics"
            )
            
            return True
        else:
            print("❌ No company facts data retrieved")
            return False
            
    except Exception as e:
        print(f"❌ Company Facts test failed: {e}")
        return False

def test_financial_ratios():
    """Test calculated financial ratios for fundamental analysis."""
    print("\n🔄 Testing Financial Ratios Calculation...")
    
    collector = SECEdgarCollector()
    
    try:
        # Get ratios for Apple Inc.
        apple_ratios = collector.get_key_financial_ratios('320193')
        if apple_ratios:
            print(f"✅ Financial ratios calculated for {apple_ratios['company_info']['name']}")
            
            print("\n📊 Key Financial Ratios:")
            for ratio_name, ratio_data in apple_ratios['calculated_ratios'].items():
                value = ratio_data['value']
                category = ratio_data['category']
                unit = ratio_data.get('unit', '')
                print(f"  - {ratio_name}: {value}{unit} ({category})")
            
            # Save sample output
            save_sample_output(
                "financial_ratios_apple.json",
                apple_ratios,
                "Calculated financial ratios for Apple Inc. including liquidity, leverage, and profitability metrics for fundamental analysis"
            )
            
            return True
        else:
            print("❌ No financial ratios calculated")
            return False
            
    except Exception as e:
        print(f"❌ Financial ratios test failed: {e}")
        return False

def test_company_concept():
    """Test Company Concept API - Historical data for specific financial metrics."""
    print("\n🔄 Testing Company Concept API...")
    
    collector = SECEdgarCollector()
    
    try:
        # Get historical revenue data for Apple
        revenue_concept = collector.get_company_concept('320193', 'us-gaap:Revenues')
        if revenue_concept:
            print(f"✅ Revenue concept data retrieved for {revenue_concept['company_info']['name']}")
            
            # Show historical data summary
            historical_count = len(revenue_concept['historical_data'])
            print(f"📈 Found {historical_count} historical data points")
            
            # Show recent annual revenue (10-K filings)
            annual_revenues = [data for data in revenue_concept['historical_data'] 
                             if data['form'] == '10-K'][:5]
            
            print("\n📊 Recent Annual Revenues (10-K filings):")
            for data in annual_revenues:
                value = data['value']
                date = data['date']
                filed = data['filed']
                print(f"  - {date}: ${value:,} (filed: {filed})")
            
            # Save sample output
            save_sample_output(
                "company_concept_revenue.json",
                revenue_concept,
                "Historical revenue data for Apple Inc. showing annual 10-K and quarterly 10-Q filings over time"
            )
            
            return True
        else:
            print("❌ No company concept data retrieved")
            return False
            
    except Exception as e:
        print(f"❌ Company Concept test failed: {e}")
        return False

def test_company_submissions():
    """Test Company Submissions API - Filing history and metadata."""
    print("\n🔄 Testing Company Submissions API...")
    
    collector = SECEdgarCollector()
    
    try:
        # Get submission history for Apple
        apple_submissions = collector.get_company_submissions('320193')
        if apple_submissions:
            print(f"✅ Submissions data retrieved for {apple_submissions['company_info']['name']}")
            
            # Show company metadata
            company_info = apple_submissions['company_info']
            print(f"📋 Company Details:")
            print(f"  - SIC: {company_info['sic']} - {company_info['sicDescription']}")
            print(f"  - Tickers: {company_info['tickers']}")
            print(f"  - Exchanges: {company_info['exchanges']}")
            print(f"  - Website: {company_info['website']}")
            print(f"  - State: {company_info['stateOfIncorporation']}")
            
            # Show recent filings summary
            filing_summary = apple_submissions['filing_summary']
            print(f"\n📂 Recent Filing Summary:")
            for form_type, count in filing_summary.items():
                print(f"  - {form_type}: {count} filings")
            
            # Show recent filings
            print(f"\n📄 Recent Filings:")
            for filing in apple_submissions['recent_filings'][:5]:
                form = filing['form']
                filing_date = filing['filingDate']
                report_date = filing['reportDate']
                print(f"  - {form} filed {filing_date} (report date: {report_date})")
            
            # Save sample output
            save_sample_output(
                "company_submissions_apple.json",
                apple_submissions,
                "Complete filing submission history for Apple Inc. including company metadata and recent SEC filings"
            )
            
            return True
        else:
            print("❌ No submissions data retrieved")
            return False
            
    except Exception as e:
        print(f"❌ Company Submissions test failed: {e}")
        return False

def test_multi_company_comparison():
    """Test multi-company comparison analysis."""
    print("\n🔄 Testing Multi-Company Comparison...")
    
    collector = SECEdgarCollector()
    
    # Compare top tech companies
    tech_companies = [
        SAMPLE_COMPANIES['AAPL'],  # Apple
        SAMPLE_COMPANIES['MSFT'],  # Microsoft
        SAMPLE_COMPANIES['GOOGL'], # Alphabet
        SAMPLE_COMPANIES['META'],  # Meta
    ]
    
    try:
        comparison = collector.get_multiple_companies_summary(tech_companies)
        if comparison:
            print(f"✅ Multi-company comparison completed")
            print(f"📊 Analyzed {comparison['metadata']['companies_analyzed']} companies")
            
            print("\n🏢 Company Comparison Summary:")
            for symbol, data in comparison['comparison_summary'].items():
                company_name = data['company_name']
                data_quality = data['data_quality']
                ratio_count = len(data['key_ratios'])
                print(f"  - {symbol} ({company_name}): {ratio_count} ratios, {data_quality}")
                
                # Show key ratios if available
                if data['key_ratios']:
                    key_ratios = ['current_ratio', 'debt_to_equity', 'net_profit_margin', 'return_on_equity']
                    ratios_display = []
                    for ratio in key_ratios:
                        if ratio in data['key_ratios']:
                            value = data['key_ratios'][ratio]['value']
                            unit = data['key_ratios'][ratio].get('unit', '')
                            ratios_display.append(f"{ratio}: {value}{unit}")
                    if ratios_display:
                        print(f"    Key ratios: {', '.join(ratios_display[:2])}")
            
            # Save sample output
            save_sample_output(
                "multi_company_comparison.json",
                comparison,
                "Comparative financial analysis of major technology companies showing key financial ratios side-by-side"
            )
            
            return True
        else:
            print("❌ Multi-company comparison failed")
            return False
            
    except Exception as e:
        print(f"❌ Multi-company comparison test failed: {e}")
        return False

def test_fundamental_analysis_dashboard():
    """Create a dashboard-ready dataset for fundamental analysis."""
    print("\n🔄 Creating Fundamental Analysis Dashboard Data...")
    
    collector = SECEdgarCollector()
    
    try:
        # Get comprehensive data for a sample company
        company_cik = '320193'  # Apple
        
        # Gather all data types
        company_facts = collector.get_company_facts(company_cik)
        financial_ratios = collector.get_key_financial_ratios(company_cik)
        submissions = collector.get_company_submissions(company_cik)
        
        if company_facts and financial_ratios and submissions:
            # Create dashboard-ready structure
            dashboard_data = {
                "company_overview": {
                    "name": company_facts['company_info']['name'],
                    "cik": company_facts['company_info']['cik'],
                    "ticker": submissions['company_info']['tickers'][0] if submissions['company_info']['tickers'] else 'N/A',
                    "sector": submissions['company_info']['sicDescription'],
                    "exchange": submissions['company_info']['exchanges'][0] if submissions['company_info']['exchanges'] else 'N/A',
                    "website": submissions['company_info']['website']
                },
                "key_financial_metrics": {},
                "financial_ratios": financial_ratios['calculated_ratios'],
                "recent_filings": submissions['filing_summary'],
                "data_quality_score": "High",
                "last_updated": datetime.now().isoformat()
            }
            
            # Extract key metrics in consumable format
            key_metrics = ['Revenue', 'NetIncome', 'Assets', 'Liabilities', 'StockholdersEquity', 'Cash']
            for metric in key_metrics:
                if metric in company_facts['financial_metrics']:
                    metric_data = company_facts['financial_metrics'][metric]
                    dashboard_data['key_financial_metrics'][metric] = {
                        "value": metric_data['latest_value'],
                        "date": metric_data['latest_date'],
                        "unit": metric_data['unit'],
                        "label": metric_data['label']
                    }
            
            print(f"✅ Dashboard data created for {dashboard_data['company_overview']['name']}")
            print(f"📊 Key metrics: {len(dashboard_data['key_financial_metrics'])}")
            print(f"📈 Financial ratios: {len(dashboard_data['financial_ratios'])}")
            print(f"📂 Filing types: {len(dashboard_data['recent_filings'])}")
            
            # Save sample output
            save_sample_output(
                "fundamental_analysis_dashboard.json",
                dashboard_data,
                "Complete fundamental analysis dashboard data for Apple Inc. ready for UI consumption with key metrics, ratios, and company overview"
            )
            
            return True
        else:
            print("❌ Failed to gather complete dashboard data")
            return False
            
    except Exception as e:
        print(f"❌ Dashboard creation failed: {e}")
        return False

def main():
    """Run complete SEC EDGAR collector demo."""
    print("🚀 SEC EDGAR Collector - Complete Demo with Sample Outputs")
    print("=" * 60)
    
    # Track test results
    tests = [
        ("API Connection", test_authentication),
        ("Company Facts", test_company_facts),
        ("Financial Ratios", test_financial_ratios),
        ("Company Concept", test_company_concept),
        ("Company Submissions", test_company_submissions),
        ("Multi-Company Comparison", test_multi_company_comparison),
        ("Fundamental Analysis Dashboard", test_fundamental_analysis_dashboard),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            print(f"\n{'=' * 60}")
            results[test_name] = test_func()
            time.sleep(0.5)  # Rate limiting courtesy
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
            results[test_name] = False
    
    # Summary
    print(f"\n{'=' * 60}")
    print("🎯 SEC EDGAR COLLECTOR DEMO SUMMARY")
    print(f"{'=' * 60}")
    
    passed_tests = sum(results.values())
    total_tests = len(results)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:.<30} {status}")
    
    print(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n🎉 SUCCESS! SEC EDGAR Collector is fully operational!")
        print(f"📁 Sample outputs saved to: {OUTPUT_DIR}")
        
        # Create summary README
        readme_content = f"""# SEC EDGAR Collector Test Outputs

**Generated**: {datetime.now().isoformat()}
**Status**: All tests passed ({passed_tests}/{total_tests})

## Sample Data Files

1. **company_facts_apple.json** - Complete financial statements data
2. **financial_ratios_apple.json** - Calculated fundamental analysis ratios  
3. **company_concept_revenue.json** - Historical revenue trend data
4. **company_submissions_apple.json** - Filing history and company metadata
5. **multi_company_comparison.json** - Comparative analysis of tech companies
6. **fundamental_analysis_dashboard.json** - Dashboard-ready consolidated data

## Data Structure

All outputs follow the consistent structure:
- `description`: Human-readable description of the dataset
- `timestamp`: When the data was retrieved
- `sample_data`: The actual structured data
- `data_type`: "SEC EDGAR Financial Data" 
- `source`: "U.S. Securities and Exchange Commission"

## Usage

This data is ready for consumption by the Stock Picker platform's:
- Fundamental analysis engine
- Financial ratio calculations
- Company comparison features
- Dashboard visualization components

## API Capabilities Demonstrated

✅ Company Facts API - Balance sheet, income statement, cash flow
✅ Financial Ratio Calculations - Liquidity, leverage, profitability  
✅ Company Concept API - Historical metric trends
✅ Company Submissions API - Filing history and metadata
✅ Multi-Company Analysis - Comparative fundamental analysis
✅ Rate Limiting & Error Handling - Production-ready reliability

The SEC EDGAR collector provides structured, consumable financial data that complements the existing FRED economic indicators for comprehensive market analysis.
"""
        
        with open(OUTPUT_DIR / "README.md", 'w') as f:
            f.write(readme_content)
        
        print("📄 Created README.md with sample data documentation")
        
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")
        print("Note: This may be due to rate limiting or network issues. Try again in a few minutes.")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)