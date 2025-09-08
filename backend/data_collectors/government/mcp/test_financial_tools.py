#!/usr/bin/env python3
"""
Test Harness for Financial Analysis MCP Tools

This script tests the financial analysis tools directly without requiring
a full MCP server setup. It validates the tools with real SEC data.

Usage:
    python test_financial_tools.py
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

# Add the tools directory to the Python path
sys.path.insert(0, str(Path(__file__).parent / "tools"))

from tools.financial_analysis_tools import (
    get_quarterly_financials,
    analyze_financial_trends,
    compare_peer_metrics,
    get_xbrl_facts
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FinancialToolsTester:
    """Test harness for financial analysis MCP tools."""
    
    def __init__(self):
        self.test_results = {}
        self.test_tickers = ['AAPL', 'MSFT']  # Major stocks for reliable testing
    
    async def run_all_tests(self):
        """Run all financial tool tests."""
        logger.info("Starting Financial Analysis Tools Test Suite")
        logger.info("=" * 60)
        
        # Test each tool
        await self.test_quarterly_financials()
        await self.test_financial_trends()
        await self.test_peer_comparison()
        await self.test_xbrl_facts()
        
        # Print summary
        self.print_test_summary()
    
    async def test_quarterly_financials(self):
        """Test get_quarterly_financials tool."""
        logger.info("Testing get_quarterly_financials tool...")
        
        for ticker in self.test_tickers:
            try:
                logger.info(f"  Getting quarterly financials for {ticker}")
                result = await get_quarterly_financials(ticker, quarters=2)
                logger.debug(f"    Raw result: {result}")
                
                # Validate result structure
                success = result.get('success', False)
                has_data = bool(result.get('data'))
                
                if success and has_data:
                    data = result['data']
                    logger.info(f"    ✓ Success: Retrieved {len(data)} quarters")
                    
                    # Validate data structure
                    first_quarter = data[0]
                    required_fields = ['ticker', 'filing_date', 'period_type']
                    missing_fields = [field for field in required_fields if field not in first_quarter]
                    
                    if not missing_fields:
                        logger.info(f"    ✓ Data structure valid")
                        
                        # Check for financial metrics
                        financial_fields = ['revenue', 'net_income', 'total_assets']
                        available_metrics = [field for field in financial_fields if first_quarter.get(field) is not None]
                        
                        logger.info(f"    ✓ Available metrics: {available_metrics}")
                        
                        self.test_results[f'quarterly_financials_{ticker}'] = {
                            'status': 'PASS',
                            'quarters_retrieved': len(data),
                            'available_metrics': available_metrics
                        }
                    else:
                        logger.error(f"    ✗ Missing required fields: {missing_fields}")
                        self.test_results[f'quarterly_financials_{ticker}'] = {
                            'status': 'FAIL',
                            'error': f'Missing fields: {missing_fields}'
                        }
                else:
                    error = result.get('error', 'Unknown error')
                    logger.error(f"    ✗ Failed: {error}")
                    self.test_results[f'quarterly_financials_{ticker}'] = {
                        'status': 'FAIL',
                        'error': error
                    }
                    
            except Exception as e:
                logger.error(f"    ✗ Exception: {e}")
                self.test_results[f'quarterly_financials_{ticker}'] = {
                    'status': 'ERROR',
                    'error': str(e)
                }
        
        logger.info("")
    
    async def test_financial_trends(self):
        """Test analyze_financial_trends tool."""
        logger.info("Testing analyze_financial_trends tool...")
        
        test_metrics = ['revenue', 'net_income', 'total_assets']
        
        for ticker in self.test_tickers:
            try:
                logger.info(f"  Analyzing trends for {ticker}")
                result = await analyze_financial_trends(ticker, test_metrics)
                
                success = result.get('success', False)
                
                if success:
                    trend_analysis = result.get('trend_analysis', {})
                    trends = trend_analysis.get('trends', {})
                    
                    if trends:
                        logger.info(f"    ✓ Success: Analyzed {len(trends)} metrics")
                        
                        # Check trend analysis quality
                        valid_trends = []
                        for metric, trend_data in trends.items():
                            if 'growth_rates' in trend_data and 'average_growth' in trend_data:
                                valid_trends.append(metric)
                                avg_growth = trend_data['average_growth']
                                logger.info(f"      {metric}: {avg_growth:.2f}% average growth")
                        
                        self.test_results[f'financial_trends_{ticker}'] = {
                            'status': 'PASS',
                            'metrics_analyzed': valid_trends,
                            'trends_count': len(valid_trends)
                        }
                    else:
                        logger.error(f"    ✗ No trend data returned")
                        self.test_results[f'financial_trends_{ticker}'] = {
                            'status': 'FAIL',
                            'error': 'No trend data'
                        }
                else:
                    error = result.get('error', 'Unknown error')
                    logger.error(f"    ✗ Failed: {error}")
                    self.test_results[f'financial_trends_{ticker}'] = {
                        'status': 'FAIL',
                        'error': error
                    }
                    
            except Exception as e:
                logger.error(f"    ✗ Exception: {e}")
                self.test_results[f'financial_trends_{ticker}'] = {
                    'status': 'ERROR',
                    'error': str(e)
                }
        
        logger.info("")
    
    async def test_peer_comparison(self):
        """Test compare_peer_metrics tool."""
        logger.info("Testing compare_peer_metrics tool...")
        
        test_metric = 'revenue'
        
        try:
            logger.info(f"  Comparing {test_metric} for {self.test_tickers}")
            result = await compare_peer_metrics(self.test_tickers, test_metric)
            
            success = result.get('success', False)
            
            if success:
                peer_comparison = result.get('peer_comparison', {})
                companies = peer_comparison.get('companies', {})
                rankings = peer_comparison.get('rankings', [])
                
                if companies and rankings:
                    logger.info(f"    ✓ Success: Compared {len(companies)} companies")
                    
                    # Show rankings
                    for i, ranking in enumerate(rankings):
                        ticker = ranking['ticker']
                        value = ranking['value']
                        if value:
                            logger.info(f"      #{i+1}: {ticker} - ${value:,.0f}")
                    
                    self.test_results['peer_comparison'] = {
                        'status': 'PASS',
                        'companies_compared': len(companies),
                        'rankings_generated': len(rankings)
                    }
                else:
                    logger.error(f"    ✗ Incomplete comparison data")
                    self.test_results['peer_comparison'] = {
                        'status': 'FAIL',
                        'error': 'Incomplete comparison data'
                    }
            else:
                error = result.get('error', 'Unknown error')
                logger.error(f"    ✗ Failed: {error}")
                self.test_results['peer_comparison'] = {
                    'status': 'FAIL',
                    'error': error
                }
                
        except Exception as e:
            logger.error(f"    ✗ Exception: {e}")
            self.test_results['peer_comparison'] = {
                'status': 'ERROR',
                'error': str(e)
            }
        
        logger.info("")
    
    async def test_xbrl_facts(self):
        """Test get_xbrl_facts tool."""
        logger.info("Testing get_xbrl_facts tool...")
        
        test_fact = 'Revenues'
        test_ticker = 'AAPL'
        
        try:
            logger.info(f"  Getting XBRL fact '{test_fact}' for {test_ticker}")
            result = await get_xbrl_facts(test_ticker, test_fact)
            
            success = result.get('success', False)
            
            if success:
                fact_data = result.get('fact_data', {})
                
                if fact_data:
                    logger.info(f"    ✓ Success: Retrieved XBRL fact data")
                    
                    # Check for units data
                    units = fact_data.get('units', {})
                    if units:
                        logger.info(f"      Available units: {list(units.keys())}")
                        
                        # Count data points
                        total_points = sum(len(unit_data) for unit_data in units.values())
                        logger.info(f"      Total data points: {total_points}")
                    
                    self.test_results['xbrl_facts'] = {
                        'status': 'PASS',
                        'fact_retrieved': test_fact,
                        'has_units': bool(units)
                    }
                else:
                    logger.error(f"    ✗ No fact data returned")
                    self.test_results['xbrl_facts'] = {
                        'status': 'FAIL',
                        'error': 'No fact data'
                    }
            else:
                error = result.get('error', 'Unknown error')
                logger.error(f"    ✗ Failed: {error}")
                
                # If fact not found, try to show available facts
                available_facts = result.get('available_facts', [])
                if available_facts:
                    logger.info(f"      Available facts sample: {available_facts[:5]}")
                
                self.test_results['xbrl_facts'] = {
                    'status': 'FAIL',
                    'error': error,
                    'available_facts_sample': available_facts[:10] if available_facts else []
                }
                
        except Exception as e:
            logger.error(f"    ✗ Exception: {e}")
            self.test_results['xbrl_facts'] = {
                'status': 'ERROR',
                'error': str(e)
            }
        
        logger.info("")
    
    def print_test_summary(self):
        """Print test results summary."""
        logger.info("Test Results Summary")
        logger.info("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['status'] == 'PASS')
        failed_tests = sum(1 for result in self.test_results.values() if result['status'] == 'FAIL')
        error_tests = sum(1 for result in self.test_results.values() if result['status'] == 'ERROR')
        
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {failed_tests}")
        logger.info(f"Errors: {error_tests}")
        logger.info("")
        
        # Detailed results
        for test_name, result in self.test_results.items():
            status = result['status']
            if status == 'PASS':
                logger.info(f"✓ {test_name}: PASSED")
            elif status == 'FAIL':
                logger.error(f"✗ {test_name}: FAILED - {result.get('error', 'Unknown')}")
            else:  # ERROR
                logger.error(f"✗ {test_name}: ERROR - {result.get('error', 'Unknown')}")
        
        logger.info("")
        
        # Overall result
        if failed_tests == 0 and error_tests == 0:
            logger.info("🎉 All tests passed!")
        elif passed_tests > 0:
            logger.info(f"⚠️  {passed_tests}/{total_tests} tests passed")
        else:
            logger.error("❌ All tests failed")
        
        # Save results to file
        results_file = Path(__file__).parent / "test_results.json"
        with open(results_file, 'w') as f:
            json.dump(self.test_results, f, indent=2, default=str)
        
        logger.info(f"Detailed results saved to: {results_file}")


async def main():
    """Main test runner."""
    tester = FinancialToolsTester()
    await tester.run_all_tests()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"Test runner error: {e}")
        import traceback
        traceback.print_exc()