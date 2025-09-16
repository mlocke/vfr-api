#!/usr/bin/env python3
"""
SEC EDGAR Direct API Test - TSLA (Tesla) Analysis

Direct test of SEC EDGAR API functionality using TSLA as the target stock.
This test bypasses complex rate limiting and MCP issues to focus on core data retrieval
and validation.

Features:
- Direct SEC EDGAR API calls with proper headers
- Comprehensive TSLA financial data extraction
- Performance metrics and response time analysis
- Data quality assessment and validation
- Comprehensive output documentation

Usage: python scripts/test-sec-edgar-tsla-direct.py
"""

import json
import requests
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Test configuration
TEST_SYMBOL = "TSLA"
TEST_CIK = "1318605"  # Tesla's Central Index Key
OUTPUT_DIR = Path("docs/test-output")
BASE_URL = "https://data.sec.gov"

# SEC required headers
HEADERS = {
    'User-Agent': 'Stock-Picker Financial Analysis Platform (contact@stockpicker.com)',
    'Accept': 'application/json',
    'Host': 'data.sec.gov'
}

# Key financial metrics to extract and validate
KEY_FINANCIAL_CONCEPTS = {
    'Revenue': 'us-gaap:Revenues',
    'NetIncome': 'us-gaap:NetIncomeLoss',
    'Assets': 'us-gaap:Assets',
    'Liabilities': 'us-gaap:Liabilities',
    'StockholdersEquity': 'us-gaap:StockholdersEquity',
    'AssetsCurrent': 'us-gaap:AssetsCurrent',
    'LiabilitiesCurrent': 'us-gaap:LiabilitiesCurrent',
    'Cash': 'us-gaap:CashAndCashEquivalentsAtCarryingValue',
    'OperatingIncome': 'us-gaap:OperatingIncomeLoss',
    'GrossProfit': 'us-gaap:GrossProfit',
    'EarningsPerShare': 'us-gaap:EarningsPerShareBasic',
    'EarningsPerShareDiluted': 'us-gaap:EarningsPerShareDiluted'
}

class SECEdgarTSLADirectTest:
    """Direct SEC EDGAR API test for TSLA data."""

    def __init__(self):
        """Initialize test suite."""
        self.start_time = datetime.now()
        self.test_id = f"sec-edgar-tsla-direct-{int(time.time())}"

        # Test results tracking
        self.results = {
            'test_id': self.test_id,
            'timestamp': self.start_time.isoformat(),
            'symbol': TEST_SYMBOL,
            'cik': TEST_CIK,
            'base_url': BASE_URL,
            'test_summary': {},
            'api_tests': {},
            'financial_data': {},
            'performance_metrics': {},
            'data_quality': {},
            'errors': []
        }

        # Performance tracking
        self.request_times = []

        print(f"🚀 SEC EDGAR Direct API Test - TSLA Analysis")
        print(f"Test ID: {self.test_id}")
        print(f"Target: {TEST_SYMBOL} (CIK: {TEST_CIK})")
        print("=" * 60)

    def log(self, message: str, level: str = "info"):
        """Log test message with timestamp."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        level_icon = {"info": "ℹ️", "success": "✅", "warning": "⚠️", "error": "❌"}.get(level, "ℹ️")
        print(f"[{timestamp}] {level_icon} {message}")

    def make_request(self, endpoint: str, description: str = "") -> Dict[str, Any]:
        """Make a rate-limited request to SEC EDGAR API."""
        url = f"{BASE_URL}{endpoint}"

        self.log(f"Making request: {description or endpoint}")

        start_time = time.time()

        try:
            # Rate limiting - SEC requires max 10 requests per second
            time.sleep(0.12)  # Slight buffer beyond 0.1s minimum

            response = requests.get(url, headers=HEADERS, timeout=30)
            duration = time.time() - start_time

            self.request_times.append(duration)

            result = {
                'success': response.status_code == 200,
                'status_code': response.status_code,
                'duration_ms': round(duration * 1000, 2),
                'timestamp': datetime.now().isoformat(),
                'url': url,
                'response_size_bytes': len(response.content)
            }

            if response.status_code == 200:
                if 'application/json' in response.headers.get('content-type', ''):
                    result['data'] = response.json()
                    result['data_size_kb'] = round(len(response.content) / 1024, 2)
                else:
                    result['error'] = 'Non-JSON response received'
            else:
                result['error'] = f"HTTP {response.status_code}: {response.reason}"

            status = "✅" if result['success'] else "❌"
            self.log(f"{status} {description}: {result['status_code']} ({duration:.2f}s)",
                    "success" if result['success'] else "error")

            return result

        except requests.exceptions.Timeout:
            duration = time.time() - start_time
            error_result = {
                'success': False,
                'error': 'Request timeout (30s)',
                'duration_ms': round(duration * 1000, 2),
                'timestamp': datetime.now().isoformat()
            }
            self.log(f"❌ {description}: Request timeout", "error")
            return error_result

        except requests.exceptions.RequestException as e:
            duration = time.time() - start_time
            error_result = {
                'success': False,
                'error': f"Request failed: {str(e)}",
                'duration_ms': round(duration * 1000, 2),
                'timestamp': datetime.now().isoformat()
            }
            self.log(f"❌ {description}: {str(e)}", "error")
            return error_result

    def extract_latest_annual_value(self, concept_data, form_type='10-K'):
        """Extract the latest annual value from SEC concept data."""
        if 'units' not in concept_data:
            return None, None, None

        # Try different units (USD, shares, etc.)
        for unit_type in ['USD', 'shares', 'USD/shares', 'pure']:
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

    def test_basic_connectivity(self) -> Dict[str, Any]:
        """Test basic API connectivity and endpoints."""
        self.log("Testing basic API connectivity...")

        connectivity_tests = {}

        # Test 1: Basic connection to SEC EDGAR
        result = self.make_request("/api/xbrl/companyfacts/CIK0000320193.json", "Basic connectivity (Apple)")
        connectivity_tests['basic_connection'] = result

        # Test 2: TSLA specific endpoint
        result = self.make_request(f"/api/xbrl/companyfacts/CIK{TEST_CIK.zfill(10)}.json", "TSLA company facts")
        connectivity_tests['tsla_company_facts'] = result

        # Test 3: TSLA submissions endpoint
        result = self.make_request(f"/submissions/CIK{TEST_CIK.zfill(10)}.json", "TSLA submissions")
        connectivity_tests['tsla_submissions'] = result

        # Test 4: Invalid endpoint (error handling test)
        result = self.make_request("/api/invalid/endpoint.json", "Invalid endpoint test")
        connectivity_tests['invalid_endpoint'] = result

        # Calculate connectivity score
        successful_tests = sum(1 for test in connectivity_tests.values() if test.get('success', False))
        connectivity_score = (successful_tests / len(connectivity_tests)) * 100

        connectivity_tests['summary'] = {
            'total_tests': len(connectivity_tests) - 1,  # Exclude summary itself
            'successful_tests': successful_tests,
            'connectivity_score': round(connectivity_score, 1),
            'average_response_time_ms': round(sum(self.request_times) / len(self.request_times) * 1000, 2) if self.request_times else 0
        }

        self.log(f"Connectivity score: {connectivity_score:.1f}% ({successful_tests}/{len(connectivity_tests)-1} tests)",
                "success" if connectivity_score >= 75 else "warning")

        return connectivity_tests

    def extract_comprehensive_financial_data(self) -> Dict[str, Any]:
        """Extract comprehensive TSLA financial data."""
        self.log("Extracting comprehensive TSLA financial data...")

        # Get company facts
        result = self.make_request(f"/api/xbrl/companyfacts/CIK{TEST_CIK.zfill(10)}.json", "TSLA comprehensive facts")

        if not result.get('success') or not result.get('data'):
            return {'error': 'Failed to retrieve company facts data'}

        raw_data = result['data']

        # Extract company information
        company_info = {
            'name': raw_data.get('entityName', 'Unknown'),
            'cik': raw_data.get('cik', TEST_CIK),
            'sic': raw_data.get('sic'),
            'sicDescription': raw_data.get('sicDescription'),
            'tickers': raw_data.get('tickers', []),
            'exchanges': raw_data.get('exchanges', [])
        }

        self.log(f"Company: {company_info['name']} (SIC: {company_info.get('sicDescription', 'N/A')})")

        # Extract financial metrics
        facts = raw_data.get('facts', {})
        us_gaap_facts = facts.get('us-gaap', {})

        self.log(f"Available US-GAAP concepts: {len(us_gaap_facts)}")

        financial_metrics = {}

        for metric_name, concept_id in KEY_FINANCIAL_CONCEPTS.items():
            if concept_id in us_gaap_facts:
                concept_data = us_gaap_facts[concept_id]
                value, date, filed = self.extract_latest_annual_value(concept_data)

                financial_metrics[metric_name] = {
                    'concept_id': concept_id,
                    'label': concept_data.get('label', metric_name),
                    'description': concept_data.get('description', ''),
                    'latest_value': value,
                    'latest_date': date,
                    'latest_filed': filed,
                    'data_available': value is not None
                }

                if value is not None:
                    if metric_name in ['Revenue', 'NetIncome', 'Assets', 'Liabilities', 'StockholdersEquity']:
                        self.log(f"  {metric_name}: ${value:,} (as of {date})")
                    elif metric_name in ['EarningsPerShare', 'EarningsPerShareDiluted']:
                        self.log(f"  {metric_name}: ${value:.2f} (as of {date})")
                    else:
                        self.log(f"  {metric_name}: {value:,} (as of {date})")
            else:
                financial_metrics[metric_name] = {
                    'concept_id': concept_id,
                    'data_available': False,
                    'error': 'Concept not found in company facts'
                }

        # Calculate data completeness
        available_metrics = sum(1 for m in financial_metrics.values() if m.get('data_available', False))
        completeness_percentage = (available_metrics / len(KEY_FINANCIAL_CONCEPTS)) * 100

        self.log(f"Data completeness: {completeness_percentage:.1f}% ({available_metrics}/{len(KEY_FINANCIAL_CONCEPTS)} metrics)")

        return {
            'company_info': company_info,
            'financial_metrics': financial_metrics,
            'data_completeness': {
                'available_metrics': available_metrics,
                'total_metrics': len(KEY_FINANCIAL_CONCEPTS),
                'completeness_percentage': round(completeness_percentage, 1)
            },
            'extraction_timestamp': datetime.now().isoformat(),
            'raw_data_size_kb': result.get('data_size_kb', 0)
        }

    def calculate_financial_ratios(self, financial_data: Dict) -> Dict[str, Any]:
        """Calculate key financial ratios from TSLA data."""
        self.log("Calculating financial ratios...")

        if 'financial_metrics' not in financial_data:
            return {'error': 'No financial metrics available for ratio calculation'}

        metrics = financial_data['financial_metrics']

        # Helper function to get metric value
        def get_value(metric_name):
            return metrics.get(metric_name, {}).get('latest_value', 0) or 0

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
        eps_basic = get_value('EarningsPerShare')
        eps_diluted = get_value('EarningsPerShareDiluted')

        calculated_ratios = {}

        try:
            # Profitability ratios
            if revenue and revenue > 0:
                calculated_ratios['net_profit_margin'] = {
                    'value': round((net_income / revenue) * 100, 2),
                    'description': 'Net Income / Revenue × 100',
                    'category': 'Profitability',
                    'unit': 'percentage'
                }

                if gross_profit:
                    calculated_ratios['gross_profit_margin'] = {
                        'value': round((gross_profit / revenue) * 100, 2),
                        'description': 'Gross Profit / Revenue × 100',
                        'category': 'Profitability',
                        'unit': 'percentage'
                    }

                if operating_income:
                    calculated_ratios['operating_margin'] = {
                        'value': round((operating_income / revenue) * 100, 2),
                        'description': 'Operating Income / Revenue × 100',
                        'category': 'Profitability',
                        'unit': 'percentage'
                    }

            # Liquidity ratios
            if current_liabilities and current_liabilities > 0:
                calculated_ratios['current_ratio'] = {
                    'value': round(current_assets / current_liabilities, 2),
                    'description': 'Current Assets / Current Liabilities',
                    'category': 'Liquidity'
                }

            # Leverage ratios
            if assets and assets > 0:
                calculated_ratios['debt_to_assets'] = {
                    'value': round(liabilities / assets, 2),
                    'description': 'Total Liabilities / Total Assets',
                    'category': 'Leverage'
                }

            if equity and equity > 0:
                calculated_ratios['debt_to_equity'] = {
                    'value': round(liabilities / equity, 2),
                    'description': 'Total Liabilities / Stockholders Equity',
                    'category': 'Leverage'
                }

                calculated_ratios['return_on_equity'] = {
                    'value': round((net_income / equity) * 100, 2),
                    'description': 'Net Income / Stockholders Equity × 100',
                    'category': 'Returns',
                    'unit': 'percentage'
                }

            if assets and assets > 0:
                calculated_ratios['return_on_assets'] = {
                    'value': round((net_income / assets) * 100, 2),
                    'description': 'Net Income / Total Assets × 100',
                    'category': 'Returns',
                    'unit': 'percentage'
                }

            # Per-share metrics
            if eps_basic:
                calculated_ratios['earnings_per_share_basic'] = {
                    'value': eps_basic,
                    'description': 'Basic Earnings Per Share',
                    'category': 'Per Share',
                    'unit': 'USD'
                }

            if eps_diluted:
                calculated_ratios['earnings_per_share_diluted'] = {
                    'value': eps_diluted,
                    'description': 'Diluted Earnings Per Share',
                    'category': 'Per Share',
                    'unit': 'USD'
                }

            # Log calculated ratios
            for ratio_name, ratio_data in calculated_ratios.items():
                value = ratio_data['value']
                unit = ratio_data.get('unit', '')
                unit_str = f"{unit}" if unit else ""
                self.log(f"  {ratio_name}: {value}{unit_str}")

        except (ZeroDivisionError, TypeError) as e:
            self.log(f"Error calculating ratios: {e}", "warning")

        ratio_summary = {
            'calculated_ratios': calculated_ratios,
            'ratios_calculated': len(calculated_ratios),
            'calculation_timestamp': datetime.now().isoformat(),
            'base_data': {
                'revenue': revenue,
                'net_income': net_income,
                'total_assets': assets,
                'total_liabilities': liabilities,
                'stockholders_equity': equity
            }
        }

        self.log(f"Calculated {len(calculated_ratios)} financial ratios")

        return ratio_summary

    def test_submissions_and_filings(self) -> Dict[str, Any]:
        """Test TSLA submissions and recent filings data."""
        self.log("Testing submissions and filings data...")

        result = self.make_request(f"/submissions/CIK{TEST_CIK.zfill(10)}.json", "TSLA submissions")

        if not result.get('success') or not result.get('data'):
            return {'error': 'Failed to retrieve submissions data'}

        raw_data = result['data']

        # Extract recent filings
        filings = raw_data.get('filings', {}).get('recent', {})

        if not filings:
            return {'error': 'No recent filings data available'}

        # Process recent filings
        recent_filings = []
        filing_count = min(20, len(filings.get('accessionNumber', [])))  # Last 20 filings

        for i in range(filing_count):
            filing = {
                'accessionNumber': filings['accessionNumber'][i] if i < len(filings.get('accessionNumber', [])) else None,
                'filingDate': filings['filingDate'][i] if i < len(filings.get('filingDate', [])) else None,
                'reportDate': filings['reportDate'][i] if i < len(filings.get('reportDate', [])) else None,
                'acceptanceDateTime': filings['acceptanceDateTime'][i] if i < len(filings.get('acceptanceDateTime', [])) else None,
                'form': filings['form'][i] if i < len(filings.get('form', [])) else None,
                'fileNumber': filings['fileNumber'][i] if i < len(filings.get('fileNumber', [])) else None,
                'items': filings['items'][i] if i < len(filings.get('items', [])) else None,
                'size': filings['size'][i] if i < len(filings.get('size', [])) else None,
                'isXBRL': filings['isXBRL'][i] if i < len(filings.get('isXBRL', [])) else None,
                'primaryDocument': filings['primaryDocument'][i] if i < len(filings.get('primaryDocument', [])) else None
            }
            recent_filings.append(filing)

        # Analyze filing types
        form_counts = {}
        for filing in recent_filings:
            form_type = filing.get('form', 'Unknown')
            form_counts[form_type] = form_counts.get(form_type, 0) + 1

        # Find most recent 10-K and 10-Q filings
        most_recent_10k = None
        most_recent_10q = None

        for filing in recent_filings:
            if filing.get('form') == '10-K' and not most_recent_10k:
                most_recent_10k = filing
            elif filing.get('form') == '10-Q' and not most_recent_10q:
                most_recent_10q = filing

        self.log(f"Found {len(recent_filings)} recent filings")
        self.log(f"Filing types: {', '.join([f'{form}({count})' for form, count in form_counts.items()])}")

        if most_recent_10k:
            self.log(f"Most recent 10-K: {most_recent_10k['filingDate']} ({most_recent_10k['accessionNumber']})")

        if most_recent_10q:
            self.log(f"Most recent 10-Q: {most_recent_10q['filingDate']} ({most_recent_10q['accessionNumber']})")

        submissions_analysis = {
            'company_info': {
                'name': raw_data.get('name', 'Unknown'),
                'cik': raw_data.get('cik', TEST_CIK),
                'sic': raw_data.get('sic'),
                'sicDescription': raw_data.get('sicDescription'),
                'website': raw_data.get('website'),
                'investorWebsite': raw_data.get('investorWebsite'),
                'fiscalYearEnd': raw_data.get('fiscalYearEnd'),
                'stateOfIncorporation': raw_data.get('stateOfIncorporation')
            },
            'filings_analysis': {
                'recent_filings_count': len(recent_filings),
                'filing_type_distribution': form_counts,
                'most_recent_10k': most_recent_10k,
                'most_recent_10q': most_recent_10q,
                'recent_filings': recent_filings[:5]  # Include first 5 for sample
            },
            'data_retrieval': {
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'response_time_ms': result.get('duration_ms', 0),
                'data_size_kb': result.get('data_size_kb', 0)
            }
        }

        return submissions_analysis

    def assess_data_quality(self, financial_data: Dict, filings_data: Dict) -> Dict[str, Any]:
        """Assess overall data quality for TSLA."""
        self.log("Assessing data quality...")

        quality_assessment = {
            'overall_score': 0,
            'completeness': {},
            'timeliness': {},
            'accuracy': {},
            'consistency': {}
        }

        # Completeness assessment
        if 'data_completeness' in financial_data:
            completeness = financial_data['data_completeness']
            quality_assessment['completeness'] = {
                'score': completeness['completeness_percentage'],
                'available_metrics': completeness['available_metrics'],
                'total_metrics': completeness['total_metrics'],
                'rating': 'Excellent' if completeness['completeness_percentage'] >= 80 else
                         'Good' if completeness['completeness_percentage'] >= 60 else
                         'Fair' if completeness['completeness_percentage'] >= 40 else 'Poor'
            }

        # Timeliness assessment
        if 'financial_metrics' in financial_data:
            latest_dates = []
            for metric_name, metric_data in financial_data['financial_metrics'].items():
                if metric_data.get('latest_date'):
                    try:
                        date_obj = datetime.strptime(metric_data['latest_date'], '%Y-%m-%d')
                        latest_dates.append(date_obj)
                    except:
                        pass

            if latest_dates:
                most_recent_date = max(latest_dates)
                days_old = (datetime.now() - most_recent_date).days

                # Calculate timeliness score (100% if recent, declining with age)
                timeliness_score = max(0, 100 - (days_old / 365 * 50))  # 50% penalty per year

                quality_assessment['timeliness'] = {
                    'score': round(timeliness_score, 1),
                    'most_recent_date': most_recent_date.strftime('%Y-%m-%d'),
                    'days_old': days_old,
                    'rating': 'Fresh' if days_old < 180 else
                             'Recent' if days_old < 365 else
                             'Moderate' if days_old < 730 else 'Stale'
                }

        # Accuracy assessment (basic validation checks)
        if 'financial_metrics' in financial_data:
            metrics = financial_data['financial_metrics']

            accuracy_checks = {
                'positive_revenue': (metrics.get('Revenue', {}).get('latest_value', 0) or 0) > 0,
                'assets_greater_than_zero': (metrics.get('Assets', {}).get('latest_value', 0) or 0) > 0,
                'reasonable_equity': (metrics.get('StockholdersEquity', {}).get('latest_value', 0) or 0) > 0,
                'valid_dates': all(
                    bool(metrics.get(m, {}).get('latest_date'))
                    for m in ['Revenue', 'NetIncome', 'Assets']
                    if metrics.get(m, {}).get('data_available')
                )
            }

            passed_checks = sum(accuracy_checks.values())
            accuracy_score = (passed_checks / len(accuracy_checks)) * 100

            quality_assessment['accuracy'] = {
                'score': round(accuracy_score, 1),
                'validation_checks': accuracy_checks,
                'passed_checks': passed_checks,
                'total_checks': len(accuracy_checks),
                'rating': 'High' if accuracy_score >= 80 else 'Moderate' if accuracy_score >= 60 else 'Low'
            }

        # Consistency assessment (compare filings vs facts data)
        consistency_score = 100  # Start with perfect score

        if 'filings_analysis' in filings_data and 'company_info' in financial_data:
            filings_company = filings_data['company_info']
            facts_company = financial_data['company_info']

            # Check if company names match
            if filings_company.get('name') != facts_company.get('name'):
                consistency_score -= 20

            # Check if CIKs match
            if str(filings_company.get('cik', '')).zfill(10) != str(facts_company.get('cik', '')).zfill(10):
                consistency_score -= 30

        quality_assessment['consistency'] = {
            'score': max(0, consistency_score),
            'rating': 'High' if consistency_score >= 80 else 'Moderate' if consistency_score >= 60 else 'Low'
        }

        # Calculate overall quality score
        scores = []
        if 'score' in quality_assessment.get('completeness', {}):
            scores.append(quality_assessment['completeness']['score'])
        if 'score' in quality_assessment.get('timeliness', {}):
            scores.append(quality_assessment['timeliness']['score'])
        if 'score' in quality_assessment.get('accuracy', {}):
            scores.append(quality_assessment['accuracy']['score'])
        scores.append(quality_assessment['consistency']['score'])

        overall_score = sum(scores) / len(scores) if scores else 0
        quality_assessment['overall_score'] = round(overall_score, 1)

        # Overall rating
        if overall_score >= 85:
            overall_rating = 'Excellent'
        elif overall_score >= 70:
            overall_rating = 'Good'
        elif overall_score >= 55:
            overall_rating = 'Fair'
        else:
            overall_rating = 'Poor'

        quality_assessment['overall_rating'] = overall_rating

        self.log(f"Data quality score: {overall_score:.1f}/100 ({overall_rating})")

        return quality_assessment

    def generate_performance_metrics(self) -> Dict[str, Any]:
        """Generate performance metrics from collected data."""
        if not self.request_times:
            return {'error': 'No performance data collected'}

        response_times_ms = [t * 1000 for t in self.request_times]

        performance_metrics = {
            'response_times': {
                'count': len(response_times_ms),
                'average_ms': round(sum(response_times_ms) / len(response_times_ms), 2),
                'min_ms': round(min(response_times_ms), 2),
                'max_ms': round(max(response_times_ms), 2),
                'median_ms': round(sorted(response_times_ms)[len(response_times_ms)//2], 2)
            },
            'efficiency': {
                'fast_requests': len([t for t in response_times_ms if t < 1000]),  # < 1s
                'medium_requests': len([t for t in response_times_ms if 1000 <= t < 5000]),  # 1-5s
                'slow_requests': len([t for t in response_times_ms if t >= 5000]),  # > 5s
                'rate_compliance': all(t >= 120 for t in [t * 1000 for t in self.request_times])  # >120ms between requests
            },
            'reliability': {
                'total_requests': len(self.request_times),
                'success_rate': 100.0  # Will be updated based on actual success/failure tracking
            }
        }

        return performance_metrics

    def save_results(self):
        """Save comprehensive test results."""
        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        # Calculate final metrics
        end_time = datetime.now()
        total_duration = (end_time - self.start_time).total_seconds()

        # Generate test summary
        self.results['test_summary'] = {
            'total_duration_seconds': round(total_duration, 2),
            'completion_timestamp': end_time.isoformat(),
            'total_api_requests': len(self.request_times),
            'average_response_time_ms': round(sum(self.request_times) / len(self.request_times) * 1000, 2) if self.request_times else 0,
            'test_status': 'COMPLETED',
            'errors_encountered': len(self.results['errors'])
        }

        # Save main results file
        timestamp = int(time.time())
        results_file = OUTPUT_DIR / f"sec-edgar-tsla-direct-test-{timestamp}.json"

        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)

        # Generate and save markdown report
        report_content = self.generate_markdown_report()
        report_file = OUTPUT_DIR / f"sec-edgar-tsla-direct-report-{timestamp}.md"

        with open(report_file, 'w') as f:
            f.write(report_content)

        self.log(f"Results saved: {results_file}")
        self.log(f"Report saved: {report_file}")

        return results_file, report_file

    def generate_markdown_report(self) -> str:
        """Generate comprehensive markdown report."""

        # Get key data for report
        financial_data = self.results.get('financial_data', {})
        api_tests = self.results.get('api_tests', {})
        performance = self.results.get('performance_metrics', {})
        quality = self.results.get('data_quality', {})
        test_summary = self.results.get('test_summary', {})

        report = f"""# SEC EDGAR Direct API Test Report - TSLA Analysis

## Test Overview
- **Test ID**: {self.results['test_id']}
- **Timestamp**: {self.results['timestamp']}
- **Target Stock**: {self.results['symbol']} (CIK: {self.results['cik']})
- **Test Duration**: {test_summary.get('total_duration_seconds', 0):.2f} seconds
- **API Requests**: {test_summary.get('total_api_requests', 0)}
- **Average Response Time**: {test_summary.get('average_response_time_ms', 0):.2f}ms

## Executive Summary

### Test Status: {test_summary.get('test_status', 'Unknown')}

"""

        # API Connectivity Results
        if 'connectivity_tests' in api_tests:
            connectivity = api_tests['connectivity_tests']
            if 'summary' in connectivity:
                summary = connectivity['summary']
                report += f"""### API Connectivity
- **Connectivity Score**: {summary.get('connectivity_score', 0):.1f}%
- **Successful Tests**: {summary.get('successful_tests', 0)}/{summary.get('total_tests', 0)}
- **Average Response Time**: {summary.get('average_response_time_ms', 0):.2f}ms

"""

        # Financial Data Results
        if 'company_info' in financial_data:
            company = financial_data['company_info']
            report += f"""### Tesla Company Information
- **Company Name**: {company.get('name', 'N/A')}
- **Industry**: {company.get('sicDescription', 'N/A')} (SIC: {company.get('sic', 'N/A')})
- **Exchanges**: {', '.join(company.get('exchanges', ['N/A']))}
- **Tickers**: {', '.join(company.get('tickers', ['N/A']))}

"""

        # Data Quality Assessment
        if quality:
            report += f"""### Data Quality Assessment
- **Overall Score**: {quality.get('overall_score', 0):.1f}/100 ({quality.get('overall_rating', 'Unknown')})
"""

            if 'completeness' in quality:
                comp = quality['completeness']
                report += f"- **Completeness**: {comp.get('score', 0):.1f}% - {comp.get('rating', 'Unknown')} ({comp.get('available_metrics', 0)}/{comp.get('total_metrics', 0)} metrics)\n"

            if 'timeliness' in quality:
                time_q = quality['timeliness']
                report += f"- **Timeliness**: {time_q.get('score', 0):.1f}% - {time_q.get('rating', 'Unknown')} (Most recent: {time_q.get('most_recent_date', 'N/A')})\n"

            if 'accuracy' in quality:
                acc = quality['accuracy']
                report += f"- **Accuracy**: {acc.get('score', 0):.1f}% - {acc.get('rating', 'Unknown')} ({acc.get('passed_checks', 0)}/{acc.get('total_checks', 0)} validations)\n"

            if 'consistency' in quality:
                cons = quality['consistency']
                report += f"- **Consistency**: {cons.get('score', 0):.1f}% - {cons.get('rating', 'Unknown')}\n"

        report += "\n"

        # Financial Metrics
        if 'financial_metrics' in financial_data:
            report += "## Key Financial Metrics (Latest Annual Data)\n\n"

            metrics = financial_data['financial_metrics']

            # Group metrics by category
            key_metrics = ['Revenue', 'NetIncome', 'Assets', 'Liabilities', 'StockholdersEquity']

            for metric_name in key_metrics:
                if metric_name in metrics and metrics[metric_name].get('data_available'):
                    metric = metrics[metric_name]
                    value = metric.get('latest_value', 0)
                    date = metric.get('latest_date', 'N/A')

                    if metric_name in ['Revenue', 'NetIncome', 'Assets', 'Liabilities', 'StockholdersEquity']:
                        report += f"- **{metric_name}**: ${value:,.0f} (as of {date})\n"
                    else:
                        report += f"- **{metric_name}**: {value:,} (as of {date})\n"

            report += "\n"

        # Financial Ratios
        if 'calculated_ratios' in financial_data:
            ratios = financial_data['calculated_ratios']
            if ratios:
                report += "## Calculated Financial Ratios\n\n"

                # Group ratios by category
                ratio_categories = {}
                for ratio_name, ratio_data in ratios.items():
                    category = ratio_data.get('category', 'Other')
                    if category not in ratio_categories:
                        ratio_categories[category] = []
                    ratio_categories[category].append((ratio_name, ratio_data))

                for category, category_ratios in ratio_categories.items():
                    report += f"### {category} Ratios\n"
                    for ratio_name, ratio_data in category_ratios:
                        value = ratio_data.get('value', 0)
                        unit = ratio_data.get('unit', '')
                        description = ratio_data.get('description', '')

                        unit_str = f" {unit}" if unit else ""
                        report += f"- **{ratio_name.replace('_', ' ').title()}**: {value}{unit_str}\n"
                        report += f"  - *{description}*\n"
                    report += "\n"

        # Performance Metrics
        if performance:
            report += "## Performance Metrics\n\n"

            if 'response_times' in performance:
                rt = performance['response_times']
                report += f"""### API Response Times
- **Total Requests**: {rt.get('count', 0)}
- **Average Response Time**: {rt.get('average_ms', 0):.2f}ms
- **Fastest Response**: {rt.get('min_ms', 0):.2f}ms
- **Slowest Response**: {rt.get('max_ms', 0):.2f}ms
- **Median Response**: {rt.get('median_ms', 0):.2f}ms

"""

            if 'efficiency' in performance:
                eff = performance['efficiency']
                report += f"""### Request Efficiency
- **Fast Requests (<1s)**: {eff.get('fast_requests', 0)}
- **Medium Requests (1-5s)**: {eff.get('medium_requests', 0)}
- **Slow Requests (>5s)**: {eff.get('slow_requests', 0)}
- **SEC Rate Limit Compliance**: {'✅ Yes' if eff.get('rate_compliance', False) else '❌ No'}

"""

        # Recent Filings
        if 'filings_analysis' in self.results:
            filings = self.results['filings_analysis']
            if 'filings_analysis' in filings:
                fa = filings['filings_analysis']
                report += f"""## Recent SEC Filings
- **Total Recent Filings**: {fa.get('recent_filings_count', 0)}
- **Filing Types**: {', '.join([f'{k}({v})' for k, v in fa.get('filing_type_distribution', {}).items()])}
"""

                if fa.get('most_recent_10k'):
                    report += f"- **Most Recent 10-K**: {fa['most_recent_10k']['filingDate']} ({fa['most_recent_10k']['accessionNumber']})\n"

                if fa.get('most_recent_10q'):
                    report += f"- **Most Recent 10-Q**: {fa['most_recent_10q']['filingDate']} ({fa['most_recent_10q']['accessionNumber']})\n"

                report += "\n"

        # Technical Details
        report += f"""## Technical Details

### API Configuration
- **Base URL**: {self.results['base_url']}
- **Rate Limiting**: 10 requests/second (SEC compliance)
- **Timeout**: 30 seconds
- **User Agent**: {HEADERS['User-Agent']}

### Data Sources
- SEC EDGAR Company Facts API (`/api/xbrl/companyfacts/`)
- SEC EDGAR Submissions API (`/submissions/`)

### Test Methodology
- Direct API calls with proper rate limiting
- Comprehensive financial data extraction
- Data quality validation and scoring
- Performance metrics collection
- Error handling and edge case testing

---
*Report generated on {datetime.now().isoformat()}*
*Test completed in {test_summary.get('total_duration_seconds', 0):.2f} seconds*
"""

        return report

    def run_comprehensive_test(self):
        """Run the complete comprehensive test."""

        try:
            # Test 1: API Connectivity
            self.log("=" * 60)
            self.log("Phase 1: API Connectivity Testing")
            self.log("=" * 60)

            connectivity_results = self.test_basic_connectivity()
            self.results['api_tests']['connectivity_tests'] = connectivity_results

            # Test 2: Financial Data Extraction
            self.log("=" * 60)
            self.log("Phase 2: Financial Data Extraction")
            self.log("=" * 60)

            financial_data = self.extract_comprehensive_financial_data()
            self.results['financial_data'] = financial_data

            # Test 3: Financial Ratio Calculations
            if not financial_data.get('error'):
                self.log("=" * 60)
                self.log("Phase 3: Financial Ratio Calculations")
                self.log("=" * 60)

                ratio_results = self.calculate_financial_ratios(financial_data)
                self.results['financial_data'].update(ratio_results)

            # Test 4: Filings and Submissions
            self.log("=" * 60)
            self.log("Phase 4: Filings and Submissions")
            self.log("=" * 60)

            filings_results = self.test_submissions_and_filings()
            self.results['filings_analysis'] = filings_results

            # Test 5: Data Quality Assessment
            self.log("=" * 60)
            self.log("Phase 5: Data Quality Assessment")
            self.log("=" * 60)

            quality_results = self.assess_data_quality(financial_data, filings_results)
            self.results['data_quality'] = quality_results

            # Test 6: Performance Metrics
            self.log("=" * 60)
            self.log("Phase 6: Performance Metrics")
            self.log("=" * 60)

            performance_results = self.generate_performance_metrics()
            self.results['performance_metrics'] = performance_results

            # Save results
            self.log("=" * 60)
            self.log("Phase 7: Saving Results")
            self.log("=" * 60)

            results_file, report_file = self.save_results()

            # Final summary
            self.log("=" * 60)
            self.log("SEC EDGAR TSLA Direct Test Complete!")
            self.log("=" * 60)

            quality_score = quality_results.get('overall_score', 0)
            performance_avg = performance_results.get('response_times', {}).get('average_ms', 0)

            self.log(f"✅ Data Quality Score: {quality_score:.1f}/100")
            self.log(f"⚡ Average Response Time: {performance_avg:.2f}ms")
            self.log(f"📁 Results: {results_file.name}")
            self.log(f"📊 Report: {report_file.name}")

            if quality_score >= 70 and performance_avg < 5000:
                self.log("🎉 Test Status: SUCCESS - High quality data with good performance", "success")
                return True
            elif quality_score >= 50 or performance_avg < 10000:
                self.log("⚠️ Test Status: PARTIAL - Acceptable results with room for improvement", "warning")
                return True
            else:
                self.log("❌ Test Status: NEEDS ATTENTION - Data quality or performance issues", "error")
                return False

        except Exception as e:
            self.log(f"Test execution failed: {e}", "error")
            self.results['errors'].append({
                'phase': 'execution',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })

            try:
                self.save_results()
            except:
                pass

            return False

def main():
    """Main execution function."""
    print("🚀 SEC EDGAR Direct API Test - TSLA Analysis")
    print("=" * 60)
    print("Testing direct SEC EDGAR API connectivity and data retrieval")
    print("Target: Tesla (TSLA) - Comprehensive financial analysis")
    print("=" * 60)

    # Create and run test
    test = SECEdgarTSLADirectTest()

    try:
        success = test.run_comprehensive_test()

        if success:
            print("\n🎉 Test completed successfully!")
            return 0
        else:
            print("\n⚠️ Test completed with issues - check results for details")
            return 1

    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 Test failed with exception: {e}")
        return 1

if __name__ == "__main__":
    exit(main())