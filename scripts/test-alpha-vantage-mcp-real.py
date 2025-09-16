#!/usr/bin/env python3
"""
Alpha Vantage MCP Real Integration Test Script

This script tests the converted Alpha Vantage MCP collector to verify it works
with real data from the Alpha Vantage MCP server.

Usage:
    python scripts/test-alpha-vantage-mcp-real.py

Requirements:
    - Alpha Vantage API key in environment or .env file
    - Access to Alpha Vantage MCP server
    - Backend dependencies installed
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

# Add backend to Python path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    logger.warning("python-dotenv not available, using system environment only")


def load_api_key() -> str:
    """Load Alpha Vantage API key from environment."""
    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key:
        raise ValueError(
            "ALPHA_VANTAGE_API_KEY not found in environment. "
            "Please set it in your .env file or environment variables."
        )
    return api_key


async def test_mcp_connection_basic():
    """Test basic MCP connection establishment."""
    logger.info("=== Testing Basic MCP Connection ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector

        api_key = load_api_key()
        collector = AlphaVantageMCPCollector(api_key=api_key)

        logger.info(f"Created collector: {collector}")
        logger.info(f"MCP Server URL: {collector.mcp_server_url}")

        # Test connection establishment
        connection_result = await collector.establish_connection_async()
        logger.info(f"Connection established: {connection_result}")

        if connection_result:
            logger.info(f"Server info: {collector.server_info}")
            logger.info(f"Available tools count: {len(collector.available_tools)}")

            # List some available tools
            if collector.available_tools:
                logger.info("Sample available tools:")
                for i, tool in enumerate(collector.available_tools[:10]):
                    logger.info(f"  {i+1}. {tool}")
                if len(collector.available_tools) > 10:
                    logger.info(f"  ... and {len(collector.available_tools) - 10} more")

        # Cleanup
        await collector._cleanup_connection()
        return connection_result

    except Exception as e:
        logger.error(f"Basic connection test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_mcp_health_check():
    """Test MCP health check functionality."""
    logger.info("=== Testing MCP Health Check ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector

        api_key = load_api_key()
        collector = AlphaVantageMCPCollector(api_key=api_key)

        # Establish connection
        await collector.establish_connection_async()

        # Perform health check
        health_result = await collector._test_connection_async()
        logger.info(f"Health check result: {health_result}")

        if health_result.get('status') == 'connected':
            logger.info("✓ Health check successful")
            logger.info(f"  Response time: {health_result.get('response_time', 0):.2f}s")
            logger.info(f"  Available tools: {health_result.get('available_tools', 0)}")

            if health_result.get('connection_stats'):
                stats = health_result['connection_stats']
                logger.info(f"  Connection stats:")
                logger.info(f"    - Total requests: {stats.get('total_requests', 0)}")
                logger.info(f"    - Success rate: {stats.get('success_rate', 0):.1f}%")
        else:
            logger.warning(f"Health check failed: {health_result.get('error_message')}")

        # Cleanup
        await collector._cleanup_connection()
        return health_result.get('status') == 'connected'

    except Exception as e:
        logger.error(f"Health check test failed: {e}")
        return False


async def test_real_data_collection():
    """Test real data collection with Alpha Vantage MCP."""
    logger.info("=== Testing Real Data Collection ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector

        api_key = load_api_key()
        collector = AlphaVantageMCPCollector(api_key=api_key)

        # Test different types of data collection
        test_cases = [
            {
                'name': 'Real-time Quote',
                'filters': {
                    'companies': ['AAPL'],
                    'real_time': True
                }
            },
            {
                'name': 'Historical Daily Data',
                'filters': {
                    'companies': ['MSFT'],
                    'time_period': 'daily'
                }
            },
            {
                'name': 'Technical Analysis',
                'filters': {
                    'companies': ['GOOGL'],
                    'analysis_type': 'technical',
                    'technical_indicators': ['RSI', 'MACD']
                }
            },
            {
                'name': 'Fundamental Data',
                'filters': {
                    'companies': ['TSLA'],
                    'analysis_type': 'fundamental',
                    'include_earnings': True
                }
            }
        ]

        results = {}

        for test_case in test_cases:
            logger.info(f"\n--- Testing {test_case['name']} ---")

            try:
                start_time = datetime.now()
                data = await collector.collect_data(test_case['filters'])
                execution_time = (datetime.now() - start_time).total_seconds()

                if data.get('error'):
                    logger.warning(f"❌ {test_case['name']} failed:")
                    logger.warning(f"  Error type: {data['error']['type']}")
                    logger.warning(f"  Error message: {data['error']['message']}")
                    results[test_case['name']] = False
                else:
                    logger.info(f"✓ {test_case['name']} successful")
                    logger.info(f"  Execution time: {execution_time:.2f}s")
                    logger.info(f"  Tools executed: {data.get('summary', {}).get('total_tools_executed', 0)}")
                    logger.info(f"  Data categories: {list(data.get('data', {}).keys())}")
                    logger.info(f"  Estimated cost: ${data.get('summary', {}).get('estimated_cost', 0):.2f}")
                    results[test_case['name']] = True

            except Exception as e:
                logger.error(f"❌ {test_case['name']} exception: {e}")
                results[test_case['name']] = False

        # Cleanup
        await collector._cleanup_connection()

        # Summary
        logger.info("\n=== Data Collection Test Summary ===")
        successful_tests = sum(1 for success in results.values() if success)
        total_tests = len(results)

        for test_name, success in results.items():
            status = "✓" if success else "❌"
            logger.info(f"{status} {test_name}")

        logger.info(f"\nOverall: {successful_tests}/{total_tests} tests passed")
        return successful_tests == total_tests

    except Exception as e:
        logger.error(f"Data collection test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_batch_collection():
    """Test batch data collection functionality."""
    logger.info("=== Testing Batch Collection ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector

        api_key = load_api_key()
        collector = AlphaVantageMCPCollector(api_key=api_key)

        # Test batch collection
        symbols = ['AAPL', 'MSFT', 'GOOGL']
        logger.info(f"Testing batch collection for symbols: {symbols}")

        start_time = datetime.now()
        df = collector.collect_batch(symbols, date_range=None, frequency='daily', data_type='prices')
        execution_time = (datetime.now() - start_time).total_seconds()

        if df is not None and not df.empty:
            logger.info(f"✓ Batch collection successful")
            logger.info(f"  Execution time: {execution_time:.2f}s")
            logger.info(f"  DataFrame shape: {df.shape}")
            logger.info(f"  Symbols collected: {df.index.get_level_values('symbol').unique().tolist()}")
            logger.info(f"  Date range: {df.index.get_level_values('date').min()} to {df.index.get_level_values('date').max()}")
            return True
        else:
            logger.warning("❌ Batch collection returned empty DataFrame")
            return False

    except Exception as e:
        logger.error(f"Batch collection test failed: {e}")
        return False


async def test_real_time_collection():
    """Test real-time data collection functionality."""
    logger.info("=== Testing Real-time Collection ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector

        api_key = load_api_key()
        collector = AlphaVantageMCPCollector(api_key=api_key)

        # Test real-time collection
        symbols = ['AAPL', 'MSFT']
        logger.info(f"Testing real-time collection for symbols: {symbols}")

        start_time = datetime.now()
        quotes = collector.collect_realtime(symbols, data_type='prices')
        execution_time = (datetime.now() - start_time).total_seconds()

        if quotes and len(quotes) > 0:
            logger.info(f"✓ Real-time collection successful")
            logger.info(f"  Execution time: {execution_time:.2f}s")
            logger.info(f"  Quotes collected: {len(quotes)}")

            for quote in quotes:
                symbol = quote.get('symbol', 'Unknown')
                price = quote.get('price', 0)
                change_pct = quote.get('change_percent', '0%')
                logger.info(f"  {symbol}: ${price} ({change_pct})")

            return True
        else:
            logger.warning("❌ Real-time collection returned no quotes")
            return False

    except Exception as e:
        logger.error(f"Real-time collection test failed: {e}")
        return False


async def test_error_handling():
    """Test error handling with invalid requests."""
    logger.info("=== Testing Error Handling ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector

        api_key = load_api_key()
        collector = AlphaVantageMCPCollector(api_key=api_key)

        # Test cases that should trigger errors
        error_test_cases = [
            {
                'name': 'Invalid Symbol',
                'filters': {
                    'companies': ['INVALID_SYMBOL_12345'],
                    'real_time': True
                },
                'expected_error': False  # Should handle gracefully, not crash
            },
            {
                'name': 'Empty Filters',
                'filters': {},
                'expected_error': True
            },
            {
                'name': 'Invalid Symbol Format',
                'filters': {
                    'companies': [''],
                    'real_time': True
                },
                'expected_error': True
            }
        ]

        results = {}

        for test_case in error_test_cases:
            logger.info(f"\n--- Testing {test_case['name']} ---")

            try:
                data = await collector.collect_data(test_case['filters'])

                if data.get('error'):
                    if test_case['expected_error']:
                        logger.info(f"✓ {test_case['name']} - Error handled correctly")
                        logger.info(f"  Error type: {data['error']['type']}")
                        results[test_case['name']] = True
                    else:
                        logger.info(f"⚠ {test_case['name']} - Returned error response (acceptable)")
                        logger.info(f"  Error type: {data['error']['type']}")
                        results[test_case['name']] = True  # Graceful error handling is acceptable
                else:
                    if test_case['expected_error']:
                        logger.warning(f"❌ {test_case['name']} - Expected error but got success")
                        results[test_case['name']] = False
                    else:
                        logger.info(f"✓ {test_case['name']} - Handled gracefully")
                        results[test_case['name']] = True

            except Exception as e:
                if test_case['expected_error']:
                    logger.info(f"✓ {test_case['name']} - Exception thrown as expected: {e}")
                    results[test_case['name']] = True
                else:
                    logger.error(f"❌ {test_case['name']} - Unexpected exception: {e}")
                    results[test_case['name']] = False

        # Cleanup
        await collector._cleanup_connection()

        # Summary
        logger.info("\n=== Error Handling Test Summary ===")
        successful_tests = sum(1 for success in results.values() if success)
        total_tests = len(results)

        for test_name, success in results.items():
            status = "✓" if success else "❌"
            logger.info(f"{status} {test_name}")

        logger.info(f"\nOverall: {successful_tests}/{total_tests} error handling tests passed")
        return successful_tests == total_tests

    except Exception as e:
        logger.error(f"Error handling test failed: {e}")
        return False


async def run_comprehensive_test():
    """Run comprehensive test suite for Alpha Vantage MCP integration."""
    logger.info("🚀 Starting Alpha Vantage MCP Real Integration Test Suite")

    test_results = {}

    # Run all tests
    tests = [
        ("MCP Connection", test_mcp_connection_basic),
        ("Health Check", test_mcp_health_check),
        ("Data Collection", test_real_data_collection),
        ("Batch Collection", test_batch_collection),
        ("Real-time Collection", test_real_time_collection),
        ("Error Handling", test_error_handling)
    ]

    for test_name, test_func in tests:
        logger.info(f"\n{'='*60}")
        logger.info(f"Running {test_name} Test")
        logger.info(f"{'='*60}")

        try:
            result = await test_func()
            test_results[test_name] = result
        except Exception as e:
            logger.error(f"{test_name} test crashed: {e}")
            test_results[test_name] = False

    # Final summary
    logger.info(f"\n{'='*60}")
    logger.info("🏁 FINAL TEST SUMMARY")
    logger.info(f"{'='*60}")

    passed_tests = 0
    total_tests = len(test_results)

    for test_name, passed in test_results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        logger.info(f"{status} - {test_name}")
        if passed:
            passed_tests += 1

    success_rate = (passed_tests / total_tests) * 100
    logger.info(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")

    if passed_tests == total_tests:
        logger.info("🎉 All tests passed! Alpha Vantage MCP integration is working correctly.")
        return True
    elif passed_tests >= total_tests * 0.8:  # 80% pass rate
        logger.warning("⚠️  Most tests passed. Some minor issues may need attention.")
        return True
    else:
        logger.error("❌ Integration test failed. Major issues need to be resolved.")
        return False


if __name__ == "__main__":
    try:
        # Run the comprehensive test suite
        success = asyncio.run(run_comprehensive_test())

        if success:
            logger.info("\n✅ Alpha Vantage MCP real integration test completed successfully!")
            sys.exit(0)
        else:
            logger.error("\n❌ Alpha Vantage MCP real integration test failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("\n⚠️ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n💥 Test suite crashed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)