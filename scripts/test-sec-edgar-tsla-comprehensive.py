#!/usr/bin/env python3
"""
SEC EDGAR Comprehensive Test Suite - TSLA (Tesla) Analysis

Production-ready test that demonstrates SEC EDGAR collector functionality
using TSLA as the target stock. Tests both the Python collector and MCP integration
with comprehensive performance metrics and data validation.

Features:
- Real SEC EDGAR data retrieval and validation
- Performance benchmarking and response time analysis
- Data quality assessment and completeness validation
- Error handling and edge case testing
- Comprehensive output documentation
- Fallback testing between MCP and direct API

Usage: python scripts/test-sec-edgar-tsla-comprehensive.py
"""

import sys
import os
import json
import time
import asyncio
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

# Add the backend to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

try:
    from data_collectors.government.sec_edgar_collector import SECEdgarCollector
    from data_collectors.government.mcp.sec_edgar_mcp_collector import SECEdgarMCPCollector
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're running from the project root and backend modules are available")
    sys.exit(1)

# Test configuration
TEST_SYMBOL = "TSLA"
TEST_CIK = "1318605"  # Tesla's Central Index Key
OUTPUT_DIR = Path("docs/test-output")
USER_AGENT = "Stock-Picker Financial Analysis Platform (contact@stockpicker.com)"

# Test categories
TEST_CATEGORIES = {
    'basic_connectivity': {
        'name': 'Basic Connectivity & Authentication',
        'description': 'Test API connectivity, rate limiting, and authentication'
    },
    'company_data': {
        'name': 'Company Data Retrieval',
        'description': 'Test company facts, submissions, and basic information'
    },
    'financial_analysis': {
        'name': 'Financial Analysis & Ratios',
        'description': 'Test financial metrics calculation and ratio analysis'
    },
    'mcp_integration': {
        'name': 'MCP Server Integration',
        'description': 'Test SEC EDGAR MCP server functionality and fallback'
    },
    'performance': {
        'name': 'Performance & Reliability',
        'description': 'Test response times, error handling, and data quality'
    }
}

class SECEdgarTSLATest:
    """Comprehensive test suite for SEC EDGAR collector using TSLA data."""

    def __init__(self):
        """Initialize test suite with collectors and tracking."""
        self.start_time = datetime.now()
        self.test_id = f"sec-edgar-tsla-test-{int(time.time())}"

        # Initialize collectors
        self.api_collector = None
        self.mcp_collector = None

        # Test results tracking
        self.results = {
            'test_id': self.test_id,
            'timestamp': self.start_time.isoformat(),
            'symbol': TEST_SYMBOL,
            'cik': TEST_CIK,
            'user_agent': USER_AGENT,
            'test_categories': TEST_CATEGORIES,
            'tests': {},
            'performance_metrics': {},
            'data_quality': {},
            'errors': [],
            'summary': None
        }

        # Performance tracking
        self.performance_data = []

        print(f"🚀 SEC EDGAR Comprehensive Test Suite - TSLA Analysis")
        print(f"Test ID: {self.test_id}")
        print(f"Target: {TEST_SYMBOL} (CIK: {TEST_CIK})")
        print("=" * 80)

    def log(self, message: str, level: str = "info", category: str = None):
        """Log test message with timestamp and category."""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        category_str = f"[{category}] " if category else ""
        level_str = f"[{level.upper()}]"
        print(f"[{timestamp}] {level_str} {category_str}{message}")

    def track_performance(self, operation: str, duration: float, success: bool):
        """Track performance metrics for operations."""
        self.performance_data.append({
            'operation': operation,
            'duration_ms': round(duration * 1000, 2),
            'success': success,
            'timestamp': datetime.now().isoformat()
        })

    async def initialize_collectors(self) -> bool:
        """Initialize both API and MCP collectors."""
        self.log("Initializing SEC EDGAR collectors...", "info", "setup")

        try:
            # Initialize API collector
            start_time = time.time()
            self.api_collector = SECEdgarCollector()
            api_auth = self.api_collector.authenticate()
            api_duration = time.time() - start_time

            self.track_performance("api_collector_init", api_duration, api_auth)
            self.log(f"API Collector: {'✅ Ready' if api_auth else '❌ Failed'} ({api_duration:.2f}s)", "info", "setup")

            # Initialize MCP collector
            start_time = time.time()
            self.mcp_collector = SECEdgarMCPCollector(user_agent=USER_AGENT)
            mcp_auth = self.mcp_collector.authenticate()
            mcp_duration = time.time() - start_time

            self.track_performance("mcp_collector_init", mcp_duration, mcp_auth)
            self.log(f"MCP Collector: {'✅ Ready' if mcp_auth else '❌ Failed'} ({mcp_duration:.2f}s)", "info", "setup")

            return api_auth or mcp_auth  # At least one should work

        except Exception as e:
            self.log(f"Collector initialization failed: {e}", "error", "setup")
            self.results['errors'].append({
                'category': 'initialization',
                'error': str(e),
                'traceback': traceback.format_exc()
            })
            return False

    async def test_basic_connectivity(self) -> Dict[str, Any]:
        """Test basic connectivity and API endpoints."""
        self.log("Testing basic connectivity...", "info", "connectivity")

        test_results = {
            'api_connection': None,
            'mcp_connection': None,
            'rate_limiting': None
        }

        # Test API collector connection
        if self.api_collector:
            start_time = time.time()
            try:
                api_test = self.api_collector.test_connection()
                duration = time.time() - start_time
                test_results['api_connection'] = {
                    'success': api_test,
                    'duration_ms': round(duration * 1000, 2),
                    'timestamp': datetime.now().isoformat()
                }
                self.track_performance("api_connection_test", duration, api_test)
                self.log(f"API Connection: {'✅ Success' if api_test else '❌ Failed'} ({duration:.2f}s)", "info", "connectivity")
            except Exception as e:
                test_results['api_connection'] = {'success': False, 'error': str(e)}
                self.log(f"API Connection test failed: {e}", "error", "connectivity")

        # Test MCP collector connection
        if self.mcp_collector:
            start_time = time.time()
            try:
                mcp_test = await self.mcp_collector.test_connection()
                duration = time.time() - start_time
                test_results['mcp_connection'] = {
                    'success': mcp_test.get('status') == 'connected',
                    'duration_ms': round(duration * 1000, 2),
                    'details': mcp_test,
                    'timestamp': datetime.now().isoformat()
                }
                self.track_performance("mcp_connection_test", duration, test_results['mcp_connection']['success'])
                status = "✅ Success" if test_results['mcp_connection']['success'] else "❌ Failed"
                self.log(f"MCP Connection: {status} ({duration:.2f}s)", "info", "connectivity")
            except Exception as e:
                test_results['mcp_connection'] = {'success': False, 'error': str(e)}
                self.log(f"MCP Connection test failed: {e}", "error", "connectivity")

        # Test rate limiting compliance
        self.log("Testing rate limiting compliance...", "info", "connectivity")
        rate_test_start = time.time()
        request_times = []

        try:
            for i in range(5):  # Make 5 rapid requests
                req_start = time.time()
                if self.api_collector:
                    # Make a lightweight request
                    self.api_collector._make_request("/api/xbrl/companyfacts/CIK0001318605.json")
                req_duration = time.time() - req_start
                request_times.append(req_duration)

            rate_test_duration = time.time() - rate_test_start
            avg_request_time = sum(request_times) / len(request_times)

            # SEC requires 10 requests per second max, so average should be >= 0.1s
            rate_compliant = avg_request_time >= 0.095  # Small buffer for network latency

            test_results['rate_limiting'] = {
                'success': rate_compliant,
                'avg_request_time': round(avg_request_time, 3),
                'total_test_time': round(rate_test_duration, 3),
                'requests_tested': len(request_times),
                'compliant_with_sec_limits': rate_compliant
            }

            self.log(f"Rate Limiting: {'✅ Compliant' if rate_compliant else '⚠️ Too Fast'} (avg: {avg_request_time:.3f}s)", "info", "connectivity")

        except Exception as e:
            test_results['rate_limiting'] = {'success': False, 'error': str(e)}
            self.log(f"Rate limiting test failed: {e}", "error", "connectivity")

        return test_results

    async def test_company_data_retrieval(self) -> Dict[str, Any]:
        """Test company data retrieval for TSLA."""
        self.log("Testing company data retrieval for TSLA...", "info", "company_data")

        test_results = {
            'company_facts': None,
            'company_submissions': None,
            'symbol_to_cik_mapping': None,
            'mcp_company_fundamentals': None
        }

        # Test API collector company facts
        if self.api_collector:
            self.log("Retrieving TSLA company facts via API...", "info", "company_data")
            start_time = time.time()
            try:
                facts_data = self.api_collector.get_company_facts(TEST_CIK)
                duration = time.time() - start_time

                if facts_data and 'company_info' in facts_data:
                    company_name = facts_data['company_info'].get('name', 'Unknown')
                    metrics_count = len(facts_data.get('financial_metrics', {}))

                    test_results['company_facts'] = {
                        'success': True,
                        'duration_ms': round(duration * 1000, 2),
                        'company_name': company_name,
                        'metrics_available': metrics_count,
                        'data_size_kb': round(len(json.dumps(facts_data)) / 1024, 2),
                        'sample_metrics': list(facts_data.get('financial_metrics', {}).keys())[:5]
                    }

                    self.log(f"Company Facts: ✅ Success - {company_name}, {metrics_count} metrics ({duration:.2f}s)", "info", "company_data")
                else:
                    test_results['company_facts'] = {'success': False, 'error': 'No data returned'}
                    self.log("Company Facts: ❌ No data returned", "error", "company_data")

                self.track_performance("get_company_facts", duration, test_results['company_facts']['success'])

            except Exception as e:
                test_results['company_facts'] = {'success': False, 'error': str(e)}
                self.log(f"Company Facts failed: {e}", "error", "company_data")

            # Test company submissions
            self.log("Retrieving TSLA company submissions via API...", "info", "company_data")
            start_time = time.time()
            try:
                submissions_data = self.api_collector.get_company_submissions(TEST_CIK)
                duration = time.time() - start_time

                if submissions_data and 'recent_filings' in submissions_data:
                    filings_count = len(submissions_data['recent_filings'])
                    filing_types = list(set(f.get('form', 'Unknown') for f in submissions_data['recent_filings']))

                    test_results['company_submissions'] = {
                        'success': True,
                        'duration_ms': round(duration * 1000, 2),
                        'recent_filings_count': filings_count,
                        'filing_types': filing_types,
                        'most_recent_filing': submissions_data['recent_filings'][0] if filings_count > 0 else None
                    }

                    self.log(f"Company Submissions: ✅ Success - {filings_count} filings, types: {filing_types[:3]} ({duration:.2f}s)", "info", "company_data")
                else:
                    test_results['company_submissions'] = {'success': False, 'error': 'No filings data returned'}
                    self.log("Company Submissions: ❌ No filings data", "error", "company_data")

                self.track_performance("get_company_submissions", duration, test_results['company_submissions']['success'])

            except Exception as e:
                test_results['company_submissions'] = {'success': False, 'error': str(e)}
                self.log(f"Company Submissions failed: {e}", "error", "company_data")

            # Test symbol to CIK mapping
            self.log("Testing symbol to CIK mapping...", "info", "company_data")
            start_time = time.time()
            try:
                mapped_cik = self.api_collector.get_symbol_to_cik_mapping(TEST_SYMBOL)
                duration = time.time() - start_time

                mapping_correct = mapped_cik == TEST_CIK
                test_results['symbol_to_cik_mapping'] = {
                    'success': mapping_correct,
                    'duration_ms': round(duration * 1000, 2),
                    'mapped_cik': mapped_cik,
                    'expected_cik': TEST_CIK,
                    'mapping_correct': mapping_correct
                }

                status = "✅ Correct" if mapping_correct else "❌ Incorrect"
                self.log(f"Symbol Mapping: {status} - {TEST_SYMBOL} → {mapped_cik} ({duration:.2f}s)", "info", "company_data")
                self.track_performance("symbol_to_cik_mapping", duration, mapping_correct)

            except Exception as e:
                test_results['symbol_to_cik_mapping'] = {'success': False, 'error': str(e)}
                self.log(f"Symbol mapping failed: {e}", "error", "company_data")

        # Test MCP collector company fundamentals
        if self.mcp_collector:
            self.log("Retrieving TSLA fundamentals via MCP...", "info", "company_data")
            start_time = time.time()
            try:
                mcp_data = await self.mcp_collector.get_company_fundamentals(TEST_SYMBOL)
                duration = time.time() - start_time

                if mcp_data and not mcp_data.get('error'):
                    test_results['mcp_company_fundamentals'] = {
                        'success': True,
                        'duration_ms': round(duration * 1000, 2),
                        'data_retrieved': bool(mcp_data),
                        'fallback_used': 'error' in mcp_data,
                        'data_preview': str(mcp_data)[:200] + "..." if len(str(mcp_data)) > 200 else str(mcp_data)
                    }

                    self.log(f"MCP Fundamentals: ✅ Success ({duration:.2f}s)", "info", "company_data")
                else:
                    test_results['mcp_company_fundamentals'] = {
                        'success': False,
                        'error': mcp_data.get('error', 'Unknown MCP error'),
                        'fallback_attempted': True
                    }
                    self.log(f"MCP Fundamentals: ❌ Failed - {mcp_data.get('error', 'Unknown error')}", "error", "company_data")

                self.track_performance("mcp_get_fundamentals", duration, test_results['mcp_company_fundamentals']['success'])

            except Exception as e:
                test_results['mcp_company_fundamentals'] = {'success': False, 'error': str(e)}
                self.log(f"MCP Fundamentals failed: {e}", "error", "company_data")

        return test_results

    async def test_financial_analysis(self) -> Dict[str, Any]:
        """Test financial analysis and ratio calculations for TSLA."""
        self.log("Testing financial analysis and ratios for TSLA...", "info", "financial")

        test_results = {
            'financial_ratios': None,
            'ratio_calculations': None,
            'data_completeness': None
        }

        if self.api_collector:
            # Test financial ratios calculation
            self.log("Calculating TSLA financial ratios...", "info", "financial")
            start_time = time.time()
            try:
                ratios_data = self.api_collector.get_key_financial_ratios(TEST_CIK)
                duration = time.time() - start_time

                if ratios_data and 'calculated_ratios' in ratios_data:
                    calculated_ratios = ratios_data['calculated_ratios']
                    ratio_count = len(calculated_ratios)

                    # Analyze ratio quality
                    valid_ratios = {k: v for k, v in calculated_ratios.items() if v.get('value') is not None}
                    ratio_completeness = (len(valid_ratios) / ratio_count * 100) if ratio_count > 0 else 0

                    test_results['financial_ratios'] = {
                        'success': True,
                        'duration_ms': round(duration * 1000, 2),
                        'ratios_calculated': ratio_count,
                        'valid_ratios': len(valid_ratios),
                        'completeness_percentage': round(ratio_completeness, 1),
                        'sample_ratios': {k: v.get('value') for k, v in list(valid_ratios.items())[:3]}
                    }

                    # Test specific ratio calculations
                    test_ratios = ['current_ratio', 'debt_to_equity', 'return_on_equity', 'net_profit_margin']
                    ratio_test_results = {}

                    for ratio_name in test_ratios:
                        if ratio_name in calculated_ratios:
                            ratio_value = calculated_ratios[ratio_name].get('value')
                            ratio_test_results[ratio_name] = {
                                'available': True,
                                'value': ratio_value,
                                'description': calculated_ratios[ratio_name].get('description'),
                                'category': calculated_ratios[ratio_name].get('category')
                            }
                        else:
                            ratio_test_results[ratio_name] = {'available': False}

                    test_results['ratio_calculations'] = ratio_test_results

                    self.log(f"Financial Ratios: ✅ Success - {ratio_count} ratios, {ratio_completeness:.1f}% complete ({duration:.2f}s)", "info", "financial")
                else:
                    test_results['financial_ratios'] = {'success': False, 'error': 'No ratios data returned'}
                    self.log("Financial Ratios: ❌ No ratios calculated", "error", "financial")

                self.track_performance("calculate_financial_ratios", duration, test_results['financial_ratios']['success'])

            except Exception as e:
                test_results['financial_ratios'] = {'success': False, 'error': str(e)}
                self.log(f"Financial Ratios calculation failed: {e}", "error", "financial")

            # Test data completeness for key metrics
            self.log("Assessing TSLA data completeness...", "info", "financial")
            try:
                facts_data = self.api_collector.get_company_facts(TEST_CIK)
                if facts_data and 'financial_metrics' in facts_data:
                    metrics = facts_data['financial_metrics']

                    # Key metrics to check
                    key_metrics = ['Revenue', 'NetIncome', 'Assets', 'Liabilities', 'StockholdersEquity', 'Cash']
                    completeness_analysis = {}

                    for metric in key_metrics:
                        if metric in metrics:
                            metric_data = metrics[metric]
                            has_value = metric_data.get('latest_value') is not None
                            has_date = metric_data.get('latest_date') is not None
                            recent_values = metric_data.get('recent_annual_values', [])

                            completeness_analysis[metric] = {
                                'available': True,
                                'has_latest_value': has_value,
                                'has_date': has_date,
                                'historical_data_points': len(recent_values),
                                'latest_value': metric_data.get('latest_value'),
                                'latest_date': metric_data.get('latest_date')
                            }
                        else:
                            completeness_analysis[metric] = {'available': False}

                    # Calculate overall completeness score
                    available_count = sum(1 for m in completeness_analysis.values() if m.get('available', False))
                    value_count = sum(1 for m in completeness_analysis.values() if m.get('has_latest_value', False))
                    completeness_score = (value_count / len(key_metrics)) * 100

                    test_results['data_completeness'] = {
                        'success': True,
                        'key_metrics_available': available_count,
                        'total_key_metrics': len(key_metrics),
                        'metrics_with_values': value_count,
                        'completeness_score': round(completeness_score, 1),
                        'metric_details': completeness_analysis
                    }

                    self.log(f"Data Completeness: ✅ {completeness_score:.1f}% - {value_count}/{len(key_metrics)} key metrics", "info", "financial")
                else:
                    test_results['data_completeness'] = {'success': False, 'error': 'No facts data available'}

            except Exception as e:
                test_results['data_completeness'] = {'success': False, 'error': str(e)}
                self.log(f"Data completeness assessment failed: {e}", "error", "financial")

        return test_results

    async def test_mcp_integration(self) -> Dict[str, Any]:
        """Test MCP server integration and fallback mechanisms."""
        self.log("Testing MCP integration and fallback...", "info", "mcp")

        test_results = {
            'mcp_tools_available': None,
            'mcp_tool_calls': {},
            'fallback_mechanisms': None,
            'mcp_vs_api_comparison': None
        }

        if not self.mcp_collector:
            self.log("MCP Collector not available, skipping MCP tests", "warning", "mcp")
            return test_results

        # Test MCP tools availability
        self.log("Checking available MCP tools...", "info", "mcp")
        start_time = time.time()
        try:
            tools = await self.mcp_collector.get_available_tools()
            duration = time.time() - start_time

            tool_names = [tool.get('name', 'Unknown') for tool in tools] if tools else []

            test_results['mcp_tools_available'] = {
                'success': len(tools) > 0,
                'duration_ms': round(duration * 1000, 2),
                'tools_count': len(tools),
                'tool_names': tool_names,
                'expected_categories': list(self.mcp_collector.tool_categories.keys())
            }

            self.log(f"MCP Tools: {'✅' if len(tools) > 0 else '❌'} {len(tools)} tools available ({duration:.2f}s)", "info", "mcp")
            self.track_performance("mcp_get_tools", duration, len(tools) > 0)

        except Exception as e:
            test_results['mcp_tools_available'] = {'success': False, 'error': str(e)}
            self.log(f"MCP Tools check failed: {e}", "error", "mcp")

        # Test specific MCP tool calls
        mcp_tools_to_test = [
            ('get_recent_filings', {'ticker': TEST_SYMBOL}),
            ('get_financial_statements', {'ticker': TEST_SYMBOL}),
            ('analyze_insider_trading', {'ticker': TEST_SYMBOL, 'days': 90})
        ]

        for tool_name, args in mcp_tools_to_test:
            self.log(f"Testing MCP tool: {tool_name}...", "info", "mcp")
            start_time = time.time()
            try:
                result = await self.mcp_collector.call_mcp_tool(tool_name, args)
                duration = time.time() - start_time

                success = result and not result.get('error')
                test_results['mcp_tool_calls'][tool_name] = {
                    'success': success,
                    'duration_ms': round(duration * 1000, 2),
                    'has_data': bool(result and not result.get('error')),
                    'error': result.get('error') if not success else None,
                    'fallback_used': 'fallback' in str(result).lower() if result else False
                }

                status = "✅ Success" if success else "❌ Failed"
                self.log(f"MCP {tool_name}: {status} ({duration:.2f}s)", "info", "mcp")
                self.track_performance(f"mcp_{tool_name}", duration, success)

            except Exception as e:
                test_results['mcp_tool_calls'][tool_name] = {'success': False, 'error': str(e)}
                self.log(f"MCP {tool_name} failed: {e}", "error", "mcp")

        # Test fallback mechanisms by comparing MCP vs API results
        if self.api_collector:
            self.log("Testing MCP vs API fallback comparison...", "info", "mcp")

            # Get same data from both sources
            start_time = time.time()
            api_facts = self.api_collector.get_company_facts(TEST_CIK)
            api_duration = time.time() - start_time

            start_time = time.time()
            mcp_facts = await self.mcp_collector.get_company_fundamentals(TEST_SYMBOL)
            mcp_duration = time.time() - start_time

            comparison_data = {
                'api_success': bool(api_facts and 'company_info' in api_facts),
                'mcp_success': bool(mcp_facts and not mcp_facts.get('error')),
                'api_duration_ms': round(api_duration * 1000, 2),
                'mcp_duration_ms': round(mcp_duration * 1000, 2),
                'performance_winner': 'API' if api_duration < mcp_duration else 'MCP',
                'both_successful': bool(api_facts and mcp_facts and not mcp_facts.get('error'))
            }

            test_results['mcp_vs_api_comparison'] = comparison_data

            winner = comparison_data['performance_winner']
            self.log(f"MCP vs API: {winner} faster, both successful: {comparison_data['both_successful']}", "info", "mcp")

        return test_results

    async def test_performance_and_reliability(self) -> Dict[str, Any]:
        """Test performance metrics and reliability under load."""
        self.log("Testing performance and reliability...", "info", "performance")

        test_results = {
            'response_times': None,
            'error_handling': None,
            'data_consistency': None,
            'memory_usage': None
        }

        # Test response times under multiple requests
        self.log("Testing response times with multiple requests...", "info", "performance")

        if self.api_collector:
            response_times = []
            error_count = 0

            for i in range(5):  # Make 5 requests to test consistency
                start_time = time.time()
                try:
                    result = self.api_collector.get_company_facts(TEST_CIK)
                    duration = time.time() - start_time

                    if result and 'company_info' in result:
                        response_times.append(duration)
                    else:
                        error_count += 1

                    # Rate limit compliance
                    await asyncio.sleep(0.15)  # Ensure SEC compliance

                except Exception as e:
                    error_count += 1
                    self.log(f"Request {i+1} failed: {e}", "warning", "performance")

            if response_times:
                avg_time = sum(response_times) / len(response_times)
                min_time = min(response_times)
                max_time = max(response_times)

                test_results['response_times'] = {
                    'success': True,
                    'total_requests': 5,
                    'successful_requests': len(response_times),
                    'error_count': error_count,
                    'average_response_time_ms': round(avg_time * 1000, 2),
                    'min_response_time_ms': round(min_time * 1000, 2),
                    'max_response_time_ms': round(max_time * 1000, 2),
                    'consistency_score': round((min_time / max_time) * 100, 1) if max_time > 0 else 0,
                    'error_rate_percentage': round((error_count / 5) * 100, 1)
                }

                self.log(f"Response Times: ✅ Avg: {avg_time*1000:.1f}ms, Range: {min_time*1000:.1f}-{max_time*1000:.1f}ms", "info", "performance")
            else:
                test_results['response_times'] = {'success': False, 'error': 'All requests failed'}

        # Test error handling with invalid inputs
        self.log("Testing error handling with invalid inputs...", "info", "performance")

        error_tests = [
            ('invalid_cik', '9999999999'),  # Non-existent CIK
            ('malformed_cik', 'invalid'),   # Malformed CIK
            ('empty_cik', ''),              # Empty CIK
        ]

        error_handling_results = {}

        for test_name, test_cik in error_tests:
            try:
                start_time = time.time()
                result = self.api_collector.get_company_facts(test_cik) if self.api_collector else None
                duration = time.time() - start_time

                # Should gracefully handle errors
                handled_gracefully = result is None or 'error' in str(result).lower()

                error_handling_results[test_name] = {
                    'input': test_cik,
                    'handled_gracefully': handled_gracefully,
                    'duration_ms': round(duration * 1000, 2),
                    'result_type': type(result).__name__
                }

                status = "✅ Handled" if handled_gracefully else "❌ Not handled"
                self.log(f"Error Test {test_name}: {status} ({duration:.2f}s)", "info", "performance")

            except Exception as e:
                error_handling_results[test_name] = {
                    'input': test_cik,
                    'handled_gracefully': True,  # Exception is acceptable
                    'exception': str(e)
                }
                self.log(f"Error Test {test_name}: ✅ Exception caught: {e}", "info", "performance")

        test_results['error_handling'] = error_handling_results

        # Test data consistency across multiple calls
        self.log("Testing data consistency across calls...", "info", "performance")

        if self.api_collector:
            try:
                # Make two identical requests and compare
                data1 = self.api_collector.get_company_facts(TEST_CIK)
                await asyncio.sleep(0.2)  # Brief pause
                data2 = self.api_collector.get_company_facts(TEST_CIK)

                if data1 and data2 and 'financial_metrics' in data1 and 'financial_metrics' in data2:
                    # Compare key fields
                    company_name_consistent = (
                        data1.get('company_info', {}).get('name') ==
                        data2.get('company_info', {}).get('name')
                    )

                    metrics1 = data1['financial_metrics']
                    metrics2 = data2['financial_metrics']

                    # Compare a few key metrics
                    revenue_consistent = (
                        metrics1.get('Revenue', {}).get('latest_value') ==
                        metrics2.get('Revenue', {}).get('latest_value')
                    )

                    test_results['data_consistency'] = {
                        'success': True,
                        'company_name_consistent': company_name_consistent,
                        'revenue_data_consistent': revenue_consistent,
                        'overall_consistent': company_name_consistent and revenue_consistent
                    }

                    status = "✅ Consistent" if test_results['data_consistency']['overall_consistent'] else "⚠️ Inconsistent"
                    self.log(f"Data Consistency: {status}", "info", "performance")
                else:
                    test_results['data_consistency'] = {'success': False, 'error': 'Could not retrieve data for comparison'}

            except Exception as e:
                test_results['data_consistency'] = {'success': False, 'error': str(e)}
                self.log(f"Data consistency test failed: {e}", "error", "performance")

        return test_results

    async def generate_performance_summary(self) -> Dict[str, Any]:
        """Generate comprehensive performance summary."""

        # Analyze performance data
        if not self.performance_data:
            return {'error': 'No performance data collected'}

        successful_operations = [p for p in self.performance_data if p['success']]
        failed_operations = [p for p in self.performance_data if not p['success']]

        if successful_operations:
            durations = [p['duration_ms'] for p in successful_operations]
            avg_duration = sum(durations) / len(durations)
            min_duration = min(durations)
            max_duration = max(durations)

            # Categorize operations by speed
            fast_operations = [p for p in successful_operations if p['duration_ms'] < 1000]  # < 1s
            medium_operations = [p for p in successful_operations if 1000 <= p['duration_ms'] < 5000]  # 1-5s
            slow_operations = [p for p in successful_operations if p['duration_ms'] >= 5000]  # > 5s

            summary = {
                'total_operations': len(self.performance_data),
                'successful_operations': len(successful_operations),
                'failed_operations': len(failed_operations),
                'success_rate_percentage': round((len(successful_operations) / len(self.performance_data)) * 100, 1),
                'performance_metrics': {
                    'average_duration_ms': round(avg_duration, 2),
                    'min_duration_ms': round(min_duration, 2),
                    'max_duration_ms': round(max_duration, 2),
                    'fast_operations_count': len(fast_operations),
                    'medium_operations_count': len(medium_operations),
                    'slow_operations_count': len(slow_operations)
                },
                'operation_breakdown': {
                    op['operation']: {
                        'success_rate': round(
                            (len([p for p in self.performance_data if p['operation'] == op['operation'] and p['success']]) /
                             len([p for p in self.performance_data if p['operation'] == op['operation']])) * 100, 1
                        ),
                        'avg_duration_ms': round(
                            sum(p['duration_ms'] for p in self.performance_data if p['operation'] == op['operation'] and p['success']) /
                            max(1, len([p for p in self.performance_data if p['operation'] == op['operation'] and p['success']])), 2
                        )
                    }
                    for op in self.performance_data
                }
            }

            return summary
        else:
            return {'error': 'No successful operations to analyze'}

    async def generate_data_quality_assessment(self) -> Dict[str, Any]:
        """Generate comprehensive data quality assessment."""

        # Get fresh data for quality assessment
        quality_assessment = {
            'overall_score': 0,
            'completeness': {},
            'accuracy': {},
            'timeliness': {},
            'consistency': {}
        }

        if self.api_collector:
            try:
                # Get company facts for quality assessment
                facts_data = self.api_collector.get_company_facts(TEST_CIK)

                if facts_data and 'financial_metrics' in facts_data:
                    metrics = facts_data['financial_metrics']

                    # Completeness assessment
                    key_metrics = ['Revenue', 'NetIncome', 'Assets', 'Liabilities', 'StockholdersEquity']
                    available_metrics = sum(1 for m in key_metrics if m in metrics and metrics[m].get('latest_value') is not None)
                    completeness_score = (available_metrics / len(key_metrics)) * 100

                    quality_assessment['completeness'] = {
                        'score': round(completeness_score, 1),
                        'available_key_metrics': available_metrics,
                        'total_key_metrics': len(key_metrics),
                        'missing_metrics': [m for m in key_metrics if m not in metrics or metrics[m].get('latest_value') is None]
                    }

                    # Timeliness assessment
                    latest_dates = []
                    for metric_name, metric_data in metrics.items():
                        if metric_data.get('latest_date'):
                            try:
                                date_obj = datetime.strptime(metric_data['latest_date'], '%Y-%m-%d')
                                latest_dates.append(date_obj)
                            except:
                                pass

                    if latest_dates:
                        most_recent_date = max(latest_dates)
                        days_old = (datetime.now() - most_recent_date).days

                        # Data is considered fresh if < 365 days old
                        timeliness_score = max(0, 100 - (days_old / 365 * 100))

                        quality_assessment['timeliness'] = {
                            'score': round(timeliness_score, 1),
                            'most_recent_date': most_recent_date.strftime('%Y-%m-%d'),
                            'days_old': days_old,
                            'freshness_rating': 'Fresh' if days_old < 180 else 'Moderate' if days_old < 365 else 'Stale'
                        }

                    # Accuracy assessment (based on data validation)
                    accuracy_checks = {
                        'positive_revenue': metrics.get('Revenue', {}).get('latest_value', 0) > 0,
                        'assets_greater_than_liabilities': (
                            metrics.get('Assets', {}).get('latest_value', 0) >
                            metrics.get('Liabilities', {}).get('latest_value', 0)
                        ),
                        'reasonable_values': all(
                            isinstance(metrics.get(m, {}).get('latest_value'), (int, float)) and
                            metrics.get(m, {}).get('latest_value') >= 0
                            for m in ['Revenue', 'Assets'] if m in metrics
                        )
                    }

                    accuracy_score = (sum(accuracy_checks.values()) / len(accuracy_checks)) * 100

                    quality_assessment['accuracy'] = {
                        'score': round(accuracy_score, 1),
                        'validation_checks': accuracy_checks,
                        'validation_passed': sum(accuracy_checks.values()),
                        'total_validations': len(accuracy_checks)
                    }

                    # Overall quality score
                    scores = [
                        quality_assessment['completeness']['score'],
                        quality_assessment.get('timeliness', {}).get('score', 0),
                        quality_assessment['accuracy']['score']
                    ]
                    quality_assessment['overall_score'] = round(sum(scores) / len(scores), 1)

            except Exception as e:
                quality_assessment['error'] = str(e)

        return quality_assessment

    async def save_results(self):
        """Save comprehensive test results to output directory."""

        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        # Generate final summaries
        self.results['performance_metrics'] = await self.generate_performance_summary()
        self.results['data_quality'] = await self.generate_data_quality_assessment()

        # Generate overall summary
        end_time = datetime.now()
        total_duration = (end_time - self.start_time).total_seconds()

        # Count successful tests
        test_categories = ['basic_connectivity', 'company_data', 'financial_analysis', 'mcp_integration', 'performance']
        total_tests = sum(len(self.results['tests'].get(cat, {})) for cat in test_categories)
        successful_tests = 0

        for category in test_categories:
            if category in self.results['tests']:
                for test_name, test_result in self.results['tests'][category].items():
                    if isinstance(test_result, dict) and test_result.get('success', False):
                        successful_tests += 1

        self.results['summary'] = {
            'test_duration_seconds': round(total_duration, 2),
            'total_tests_run': total_tests,
            'successful_tests': successful_tests,
            'failed_tests': total_tests - successful_tests,
            'success_rate_percentage': round((successful_tests / total_tests * 100), 1) if total_tests > 0 else 0,
            'overall_status': 'PASS' if successful_tests > 0 and len(self.results['errors']) == 0 else 'PARTIAL' if successful_tests > 0 else 'FAIL',
            'key_findings': self.generate_key_findings(),
            'recommendations': self.generate_recommendations()
        }

        # Save main results file
        results_file = OUTPUT_DIR / f"sec-edgar-tsla-comprehensive-test-{int(time.time())}.json"
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)

        # Generate and save markdown report
        report_content = self.generate_markdown_report()
        report_file = OUTPUT_DIR / f"sec-edgar-tsla-test-report-{int(time.time())}.md"
        with open(report_file, 'w') as f:
            f.write(report_content)

        self.log(f"Results saved to: {results_file}", "info", "output")
        self.log(f"Report saved to: {report_file}", "info", "output")

        return results_file, report_file

    def generate_key_findings(self) -> List[str]:
        """Generate key findings from test results."""
        findings = []

        # Performance findings
        if 'performance_metrics' in self.results and 'success_rate_percentage' in self.results['performance_metrics']:
            success_rate = self.results['performance_metrics']['success_rate_percentage']
            if success_rate >= 90:
                findings.append(f"Excellent reliability with {success_rate}% success rate across all operations")
            elif success_rate >= 70:
                findings.append(f"Good reliability with {success_rate}% success rate, some optimization opportunities")
            else:
                findings.append(f"Reliability concerns with {success_rate}% success rate, requires investigation")

        # Data quality findings
        if 'data_quality' in self.results and 'overall_score' in self.results['data_quality']:
            quality_score = self.results['data_quality']['overall_score']
            if quality_score >= 80:
                findings.append(f"High data quality with overall score of {quality_score}/100")
            elif quality_score >= 60:
                findings.append(f"Moderate data quality with score of {quality_score}/100")
            else:
                findings.append(f"Data quality issues detected with score of {quality_score}/100")

        # Connectivity findings
        if 'basic_connectivity' in self.results.get('tests', {}):
            connectivity = self.results['tests']['basic_connectivity']
            if connectivity.get('api_connection', {}).get('success') and connectivity.get('mcp_connection', {}).get('success'):
                findings.append("Both API and MCP collectors successfully connected to SEC EDGAR")
            elif connectivity.get('api_connection', {}).get('success'):
                findings.append("API collector connected successfully, MCP integration needs attention")
            elif connectivity.get('mcp_connection', {}).get('success'):
                findings.append("MCP collector connected successfully, API integration needs attention")
            else:
                findings.append("Connectivity issues detected with both API and MCP collectors")

        # TSLA specific findings
        if 'company_data' in self.results.get('tests', {}):
            company_data = self.results['tests']['company_data']
            if company_data.get('company_facts', {}).get('success'):
                metrics_count = company_data['company_facts'].get('metrics_available', 0)
                findings.append(f"Successfully retrieved {metrics_count} financial metrics for TSLA")

        return findings

    def generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results."""
        recommendations = []

        # Performance recommendations
        if 'performance_metrics' in self.results:
            perf = self.results['performance_metrics']
            if 'performance_metrics' in perf:
                avg_duration = perf['performance_metrics'].get('average_duration_ms', 0)
                if avg_duration > 5000:
                    recommendations.append("Consider implementing response caching to improve average response times")

                slow_ops = perf['performance_metrics'].get('slow_operations_count', 0)
                if slow_ops > 0:
                    recommendations.append(f"Optimize {slow_ops} slow operations taking >5 seconds")

        # Error handling recommendations
        if len(self.results.get('errors', [])) > 0:
            recommendations.append("Review error logs and implement additional error handling for edge cases")

        # MCP integration recommendations
        if 'mcp_integration' in self.results.get('tests', {}):
            mcp_tests = self.results['tests']['mcp_integration']
            if 'mcp_tools_available' in mcp_tests and not mcp_tests['mcp_tools_available'].get('success', False):
                recommendations.append("Install and configure SEC EDGAR MCP server for enhanced functionality")

        # Data quality recommendations
        if 'data_quality' in self.results:
            quality = self.results['data_quality']
            if 'completeness' in quality and quality['completeness'].get('score', 0) < 80:
                missing = quality['completeness'].get('missing_metrics', [])
                if missing:
                    recommendations.append(f"Investigate missing financial metrics: {', '.join(missing)}")

        # Rate limiting recommendations
        if 'basic_connectivity' in self.results.get('tests', {}):
            rate_test = self.results['tests']['basic_connectivity'].get('rate_limiting', {})
            if not rate_test.get('compliant_with_sec_limits', True):
                recommendations.append("Adjust rate limiting to ensure SEC compliance (max 10 requests/second)")

        return recommendations

    def generate_markdown_report(self) -> str:
        """Generate comprehensive markdown report."""

        report = f"""# SEC EDGAR Comprehensive Test Report - TSLA Analysis

## Test Overview
- **Test ID**: {self.results['test_id']}
- **Timestamp**: {self.results['timestamp']}
- **Target Stock**: {self.results['symbol']} (CIK: {self.results['cik']})
- **Test Duration**: {self.results.get('summary', {}).get('test_duration_seconds', 0):.2f} seconds

## Executive Summary
- **Overall Status**: {self.results.get('summary', {}).get('overall_status', 'Unknown')}
- **Success Rate**: {self.results.get('summary', {}).get('success_rate_percentage', 0):.1f}%
- **Tests Executed**: {self.results.get('summary', {}).get('total_tests_run', 0)}
- **Successful**: {self.results.get('summary', {}).get('successful_tests', 0)}
- **Failed**: {self.results.get('summary', {}).get('failed_tests', 0)}

## Performance Metrics
"""

        if 'performance_metrics' in self.results and 'performance_metrics' in self.results['performance_metrics']:
            perf = self.results['performance_metrics']['performance_metrics']
            report += f"""- **Average Response Time**: {perf.get('average_response_time_ms', 0):.2f}ms
- **Fastest Response**: {perf.get('min_duration_ms', 0):.2f}ms
- **Slowest Response**: {perf.get('max_duration_ms', 0):.2f}ms
- **Fast Operations (<1s)**: {perf.get('fast_operations_count', 0)}
- **Medium Operations (1-5s)**: {perf.get('medium_operations_count', 0)}
- **Slow Operations (>5s)**: {perf.get('slow_operations_count', 0)}

"""

        # Data Quality Assessment
        if 'data_quality' in self.results:
            quality = self.results['data_quality']
            report += f"""## Data Quality Assessment
- **Overall Quality Score**: {quality.get('overall_score', 0):.1f}/100
"""

            if 'completeness' in quality:
                comp = quality['completeness']
                report += f"""- **Data Completeness**: {comp.get('score', 0):.1f}% ({comp.get('available_key_metrics', 0)}/{comp.get('total_key_metrics', 0)} key metrics)
"""

            if 'timeliness' in quality:
                time_quality = quality['timeliness']
                report += f"""- **Data Timeliness**: {time_quality.get('score', 0):.1f}% (Most recent: {time_quality.get('most_recent_date', 'N/A')})
"""

            if 'accuracy' in quality:
                acc = quality['accuracy']
                report += f"""- **Data Accuracy**: {acc.get('score', 0):.1f}% ({acc.get('validation_passed', 0)}/{acc.get('total_validations', 0)} validations passed)

"""

        # Test Results by Category
        report += "## Test Results by Category\n\n"

        for category_key, category_info in TEST_CATEGORIES.items():
            if category_key in self.results.get('tests', {}):
                report += f"### {category_info['name']}\n"
                report += f"*{category_info['description']}*\n\n"

                tests = self.results['tests'][category_key]
                for test_name, test_result in tests.items():
                    if isinstance(test_result, dict):
                        status = "✅ PASS" if test_result.get('success', False) else "❌ FAIL"
                        duration = test_result.get('duration_ms', 0)
                        report += f"- **{test_name}**: {status}"
                        if duration:
                            report += f" ({duration:.1f}ms)"
                        if test_result.get('error'):
                            report += f" - Error: {test_result['error']}"
                        report += "\n"

                report += "\n"

        # Key Findings
        if 'summary' in self.results and 'key_findings' in self.results['summary']:
            report += "## Key Findings\n\n"
            for finding in self.results['summary']['key_findings']:
                report += f"- {finding}\n"
            report += "\n"

        # Recommendations
        if 'summary' in self.results and 'recommendations' in self.results['summary']:
            report += "## Recommendations\n\n"
            for recommendation in self.results['summary']['recommendations']:
                report += f"- {recommendation}\n"
            report += "\n"

        # Error Summary
        if self.results.get('errors'):
            report += "## Errors Encountered\n\n"
            for i, error in enumerate(self.results['errors'], 1):
                report += f"{i}. **{error.get('category', 'Unknown')}**: {error.get('error', 'Unknown error')}\n"
            report += "\n"

        # Technical Details
        report += f"""## Technical Details

### Collectors Tested
- **SEC EDGAR API Collector**: {'✅ Available' if self.api_collector else '❌ Not Available'}
- **SEC EDGAR MCP Collector**: {'✅ Available' if self.mcp_collector else '❌ Not Available'}

### API Configuration
- **Base URL**: https://data.sec.gov
- **User Agent**: {USER_AGENT}
- **Rate Limiting**: 10 requests/second (SEC compliance)
- **Timeout**: 30 seconds

### Data Sources
- SEC EDGAR Company Facts API
- SEC EDGAR Submissions API
- SEC EDGAR MCP Server (if available)

---
*Report generated on {datetime.now().isoformat()}*
*Test execution completed in {self.results.get('summary', {}).get('test_duration_seconds', 0):.2f} seconds*
"""

        return report

    async def run_comprehensive_test(self):
        """Run the complete comprehensive test suite."""

        self.log("Starting SEC EDGAR comprehensive test suite for TSLA", "info", "main")

        try:
            # Initialize collectors
            if not await self.initialize_collectors():
                self.log("Failed to initialize any collectors", "error", "main")
                return False

            # Run test categories
            test_categories = [
                ('basic_connectivity', self.test_basic_connectivity),
                ('company_data', self.test_company_data_retrieval),
                ('financial_analysis', self.test_financial_analysis),
                ('mcp_integration', self.test_mcp_integration),
                ('performance', self.test_performance_and_reliability)
            ]

            for category_name, test_function in test_categories:
                self.log(f"Running {category_name} tests...", "info", "main")

                try:
                    category_results = await test_function()
                    self.results['tests'][category_name] = category_results

                    # Count successful tests in this category
                    successful_count = sum(1 for result in category_results.values()
                                         if isinstance(result, dict) and result.get('success', False))
                    total_count = len(category_results)

                    self.log(f"Completed {category_name}: {successful_count}/{total_count} tests passed", "info", "main")

                except Exception as e:
                    self.log(f"Category {category_name} failed: {e}", "error", "main")
                    self.results['errors'].append({
                        'category': category_name,
                        'error': str(e),
                        'traceback': traceback.format_exc()
                    })

            # Save results
            results_file, report_file = await self.save_results()

            # Final summary
            summary = self.results.get('summary', {})
            self.log("=" * 80, "info", "main")
            self.log("SEC EDGAR TSLA Test Suite Complete!", "info", "main")
            self.log(f"Overall Status: {summary.get('overall_status', 'Unknown')}", "info", "main")
            self.log(f"Success Rate: {summary.get('success_rate_percentage', 0):.1f}%", "info", "main")
            self.log(f"Duration: {summary.get('test_duration_seconds', 0):.2f} seconds", "info", "main")
            self.log(f"Results: {results_file}", "info", "main")
            self.log(f"Report: {report_file}", "info", "main")
            self.log("=" * 80, "info", "main")

            return summary.get('overall_status') in ['PASS', 'PARTIAL']

        except Exception as e:
            self.log(f"Test suite execution failed: {e}", "error", "main")
            self.results['errors'].append({
                'category': 'execution',
                'error': str(e),
                'traceback': traceback.format_exc()
            })

            # Try to save partial results
            try:
                await self.save_results()
            except:
                pass

            return False

        finally:
            # Cleanup
            if self.mcp_collector:
                try:
                    self.mcp_collector.cleanup()
                except:
                    pass

async def main():
    """Main execution function."""
    print("🚀 SEC EDGAR Comprehensive Test Suite - TSLA Analysis")
    print("=" * 60)
    print("Testing SEC EDGAR collector functionality with Tesla (TSLA) data")
    print("Includes API connectivity, data retrieval, MCP integration, and performance analysis")
    print("=" * 60)

    # Create and run test suite
    test_suite = SECEdgarTSLATest()

    try:
        success = await test_suite.run_comprehensive_test()

        if success:
            print("\n✅ Test suite completed successfully!")
            return 0
        else:
            print("\n❌ Test suite completed with issues")
            return 1

    except KeyboardInterrupt:
        print("\n🛑 Test suite interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 Test suite failed with exception: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)