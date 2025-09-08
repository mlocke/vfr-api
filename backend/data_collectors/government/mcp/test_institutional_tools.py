#!/usr/bin/env python3
"""
Test Harness for Institutional Tracking MCP Tools

This script tests the institutional tracking tools to identify what's working
vs. what needs real implementation.

Usage:
    python test_institutional_tools.py
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

# Add the tools directory to the Python path
sys.path.insert(0, str(Path(__file__).parent / "tools"))

from tools.institutional_tracking_tools import (
    get_institutional_positions,
    track_smart_money,
    calculate_ownership_changes,
    analyze_13f_trends
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class InstitutionalToolsTester:
    """Test harness for institutional tracking MCP tools."""
    
    def __init__(self):
        self.test_results = {}
        self.test_ticker = 'AAPL'  # Widely held stock for testing
        self.test_quarter = '2024-Q1'  # Q1 2024 - should have complete filings
    
    async def run_all_tests(self):
        """Run all institutional tracking tool tests."""
        logger.info("Starting Institutional Tracking Tools Test Suite")
        logger.info("=" * 60)
        
        # Test each tool
        await self.test_institutional_positions()
        await self.test_smart_money_tracking()
        await self.test_ownership_changes()
        await self.test_13f_trends()
        
        # Print summary
        self.print_test_summary()
    
    async def test_institutional_positions(self):
        """Test get_institutional_positions tool."""
        logger.info("Testing get_institutional_positions tool...")
        
        try:
            logger.info(f"  Getting institutional positions for {self.test_ticker}")
            result = await get_institutional_positions(self.test_ticker, self.test_quarter)
            logger.debug(f"    Raw result: {result}")
            
            # Validate result structure
            success = result.get('success', False)
            has_data = bool(result.get('institutional_ownership'))
            
            if success and has_data:
                data = result['institutional_ownership']
                logger.info(f"    ✓ Success: Retrieved institutional data")
                
                # Validate data structure
                required_fields = ['total_institutional_shares', 'percent_of_float', 'number_of_institutions']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    logger.info(f"    ✓ Data structure valid")
                    logger.info(f"    ✓ {data['number_of_institutions']} institutions holding {data['percent_of_float']}% of float")
                    
                    # Check top holders
                    top_holders = data.get('top_institutional_holders', [])
                    logger.info(f"    ✓ Top holders data: {len(top_holders)} institutions")
                    
                    self.test_results['institutional_positions'] = {
                        'status': 'PASS',
                        'institutions_count': data['number_of_institutions'],
                        'percent_of_float': data['percent_of_float'],
                        'top_holders_count': len(top_holders)
                    }
                else:
                    logger.error(f"    ✗ Missing required fields: {missing_fields}")
                    self.test_results['institutional_positions'] = {
                        'status': 'FAIL',
                        'error': f'Missing fields: {missing_fields}'
                    }
            else:
                error = result.get('error', 'Unknown error')
                logger.error(f"    ✗ Failed: {error}")
                self.test_results['institutional_positions'] = {
                    'status': 'FAIL',
                    'error': error
                }
                
        except Exception as e:
            logger.error(f"    ✗ Exception: {e}")
            self.test_results['institutional_positions'] = {
                'status': 'ERROR',
                'error': str(e)
            }
        
        logger.info("")
    
    async def test_smart_money_tracking(self):
        """Test track_smart_money tool."""
        logger.info("Testing track_smart_money tool...")
        
        test_tickers = [self.test_ticker, 'MSFT']
        
        try:
            logger.info(f"  Tracking smart money for {test_tickers}")
            result = await track_smart_money(test_tickers)
            
            success = result.get('success', False)
            
            if success:
                analysis = result.get('smart_money_analysis', {})
                flows = analysis.get('flows', {})
                summary = analysis.get('summary', {})
                
                if flows and summary:
                    logger.info(f"    ✓ Success: Analyzed {len(flows)} stocks")
                    logger.info(f"    ✓ Net flow: ${summary.get('net_flow', 0):,.0f}")
                    logger.info(f"    ✓ Inflows: {summary.get('stocks_with_inflows', 0)} stocks")
                    logger.info(f"    ✓ Outflows: {summary.get('stocks_with_outflows', 0)} stocks")
                    
                    self.test_results['smart_money_tracking'] = {
                        'status': 'PASS',
                        'stocks_analyzed': len(flows),
                        'net_flow': summary.get('net_flow', 0),
                        'has_flow_data': all('net_flow' in flow_data for flow_data in flows.values() if isinstance(flow_data, dict))
                    }
                else:
                    logger.error(f"    ✗ Incomplete smart money analysis data")
                    self.test_results['smart_money_tracking'] = {
                        'status': 'FAIL',
                        'error': 'Incomplete analysis data'
                    }
            else:
                error = result.get('error', 'Unknown error')
                logger.error(f"    ✗ Failed: {error}")
                self.test_results['smart_money_tracking'] = {
                    'status': 'FAIL',
                    'error': error
                }
                
        except Exception as e:
            logger.error(f"    ✗ Exception: {e}")
            self.test_results['smart_money_tracking'] = {
                'status': 'ERROR',
                'error': str(e)
            }
        
        logger.info("")
    
    async def test_ownership_changes(self):
        """Test calculate_ownership_changes tool."""
        logger.info("Testing calculate_ownership_changes tool...")
        
        test_quarters = 4
        
        try:
            logger.info(f"  Calculating ownership changes for {self.test_ticker} over {test_quarters} quarters")
            result = await calculate_ownership_changes(self.test_ticker, test_quarters)
            
            success = result.get('success', False)
            
            if success:
                analysis = result.get('ownership_analysis', {})
                quarterly_data = analysis.get('quarterly_data', [])
                changes = analysis.get('changes', {})
                trends = analysis.get('trends', {})
                
                if quarterly_data and changes and trends:
                    logger.info(f"    ✓ Success: Analyzed {len(quarterly_data)} quarters")
                    logger.info(f"    ✓ Trend direction: {trends.get('trend_direction', 'unknown')}")
                    logger.info(f"    ✓ Institutional interest: {trends.get('institutional_interest', 'unknown')}")
                    logger.info(f"    ✓ Overall share change: {trends.get('overall_share_change', 0):,.0f}")
                    
                    self.test_results['ownership_changes'] = {
                        'status': 'PASS',
                        'quarters_analyzed': len(quarterly_data),
                        'trend_direction': trends.get('trend_direction'),
                        'change_periods': len(changes)
                    }
                else:
                    logger.error(f"    ✗ Incomplete ownership analysis data")
                    self.test_results['ownership_changes'] = {
                        'status': 'FAIL',
                        'error': 'Incomplete analysis data'
                    }
            else:
                error = result.get('error', 'Unknown error')
                logger.error(f"    ✗ Failed: {error}")
                self.test_results['ownership_changes'] = {
                    'status': 'FAIL',
                    'error': error
                }
                
        except Exception as e:
            logger.error(f"    ✗ Exception: {e}")
            self.test_results['ownership_changes'] = {
                'status': 'ERROR',
                'error': str(e)
            }
        
        logger.info("")
    
    async def test_13f_trends(self):
        """Test analyze_13f_trends tool."""
        logger.info("Testing analyze_13f_trends tool...")
        
        try:
            logger.info(f"  Analyzing 13F trends for {self.test_quarter}")
            result = await analyze_13f_trends(self.test_quarter)
            
            success = result.get('success', False)
            
            if success:
                trends = result.get('filing_trends', {})
                total_filings = trends.get('total_filings', 0)
                notable_institutions = trends.get('notable_institutions', [])
                timeline_stats = trends.get('timeline_stats', {})
                
                if trends and total_filings > 0:
                    logger.info(f"    ✓ Success: Analyzed {total_filings} 13F filings")
                    logger.info(f"    ✓ Notable institutions tracked: {len(notable_institutions)}")
                    logger.info(f"    ✓ Filing period: {timeline_stats.get('earliest_filing')} to {timeline_stats.get('latest_filing')}")
                    logger.info(f"    ✓ Peak filing date: {timeline_stats.get('peak_filing_date')}")
                    
                    self.test_results['13f_trends'] = {
                        'status': 'PASS',
                        'total_filings': total_filings,
                        'notable_institutions': len(notable_institutions),
                        'has_timeline_data': bool(timeline_stats)
                    }
                else:
                    logger.error(f"    ✗ No 13F filing data found")
                    self.test_results['13f_trends'] = {
                        'status': 'FAIL',
                        'error': 'No filing data'
                    }
            else:
                error = result.get('error', 'Unknown error')
                logger.error(f"    ✗ Failed: {error}")
                self.test_results['13f_trends'] = {
                    'status': 'FAIL',
                    'error': error
                }
                
        except Exception as e:
            logger.error(f"    ✗ Exception: {e}")
            self.test_results['13f_trends'] = {
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
            logger.info(f"⚠️  {passed_tests}/{total_tests} tests passed (some using mock data)")
        else:
            logger.error("❌ All tests failed")
        
        # Save results to file
        results_file = Path(__file__).parent / "institutional_test_results.json"
        with open(results_file, 'w') as f:
            json.dump(self.test_results, f, indent=2, default=str)
        
        logger.info(f"Detailed results saved to: {results_file}")


async def main():
    """Main test runner."""
    tester = InstitutionalToolsTester()
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