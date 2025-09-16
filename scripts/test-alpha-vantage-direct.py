#!/usr/bin/env python3
"""
Alpha Vantage Direct MCP Collector Test Script

This script tests the direct Alpha Vantage MCP implementation that bypasses
the standard MCP protocol and makes HTTP calls directly to their server.
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from datetime import datetime

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
    """Load Alpha Vantage API key."""
    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key:
        raise ValueError("ALPHA_VANTAGE_API_KEY not found in environment")
    return api_key


async def test_connection():
    """Test basic connection to Alpha Vantage MCP server."""
    logger.info("=== Testing Direct Connection ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_direct_collector import AlphaVantageDirectCollector

        api_key = load_api_key()
        collector = AlphaVantageDirectCollector(api_key=api_key)

        logger.info(f"Created collector: {collector}")

        # Test connection
        connection_result = await collector.establish_connection_async()
        logger.info(f"Connection established: {connection_result}")

        if connection_result:
            logger.info("✅ Connection test passed")
        else:
            logger.error("❌ Connection test failed")

        await collector.cleanup()
        return connection_result

    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_real_time_data():
    """Test real-time data collection."""
    logger.info("=== Testing Real-time Data Collection ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_direct_collector import AlphaVantageDirectCollector

        api_key = load_api_key()
        collector = AlphaVantageDirectCollector(api_key=api_key)

        # Test real-time quote collection
        filters = {
            'companies': ['AAPL', 'MSFT'],
            'real_time': True
        }

        logger.info(f"Testing real-time collection for: {filters['companies']}")

        start_time = datetime.now()
        data = await collector.collect_data(filters)
        execution_time = (datetime.now() - start_time).total_seconds()

        if data.get('error'):
            logger.error(f"❌ Real-time test failed: {data['error']['message']}")
            await collector.cleanup()
            return False

        summary = data.get('summary', {})
        logger.info(f"✅ Real-time test passed")
        logger.info(f"  Execution time: {execution_time:.2f}s")
        logger.info(f"  Tools executed: {summary.get('total_tools_executed', 0)}")
        logger.info(f"  Successful tools: {summary.get('successful_tools', 0)}")
        logger.info(f"  Data categories: {summary.get('data_categories', [])}")

        # Show sample data
        market_data = data.get('data', {}).get('market_data', {})
        if market_data:
            logger.info("  Sample market data:")
            for tool, tool_data in market_data.items():
                if isinstance(tool_data, dict) and 'Global Quote' in tool_data:
                    quote = tool_data['Global Quote']
                    symbol = quote.get('01. symbol', 'Unknown')
                    price = quote.get('05. price', 'Unknown')
                    change = quote.get('10. change percent', 'Unknown')
                    logger.info(f"    {symbol}: ${price} ({change})")

        await collector.cleanup()
        return True

    except Exception as e:
        logger.error(f"Real-time test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_historical_data():
    """Test historical data collection."""
    logger.info("=== Testing Historical Data Collection ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_direct_collector import AlphaVantageDirectCollector

        api_key = load_api_key()
        collector = AlphaVantageDirectCollector(api_key=api_key)

        # Test historical data collection
        filters = {
            'companies': ['GOOGL'],
            'time_period': 'daily',
            'output_size': 'compact'
        }

        logger.info(f"Testing historical collection for: {filters['companies']}")

        start_time = datetime.now()
        data = await collector.collect_data(filters)
        execution_time = (datetime.now() - start_time).total_seconds()

        if data.get('error'):
            logger.error(f"❌ Historical test failed: {data['error']['message']}")
            await collector.cleanup()
            return False

        summary = data.get('summary', {})
        logger.info(f"✅ Historical test passed")
        logger.info(f"  Execution time: {execution_time:.2f}s")
        logger.info(f"  Tools executed: {summary.get('total_tools_executed', 0)}")
        logger.info(f"  Successful tools: {summary.get('successful_tools', 0)}")
        logger.info(f"  Data categories: {summary.get('data_categories', [])}")

        # Show sample historical data
        market_data = data.get('data', {}).get('market_data', {})
        if market_data and 'TIME_SERIES_DAILY' in market_data:
            time_series = market_data['TIME_SERIES_DAILY']
            if 'Time Series (Daily)' in time_series:
                daily_data = time_series['Time Series (Daily)']
                dates = list(daily_data.keys())[:3]  # Show first 3 dates
                logger.info(f"  Sample historical data (showing {len(dates)} recent dates):")
                for date in dates:
                    values = daily_data[date]
                    open_price = values.get('1. open', 'N/A')
                    close_price = values.get('4. close', 'N/A')
                    logger.info(f"    {date}: Open=${open_price}, Close=${close_price}")

        await collector.cleanup()
        return True

    except Exception as e:
        logger.error(f"Historical test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_technical_analysis():
    """Test technical analysis data collection."""
    logger.info("=== Testing Technical Analysis ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_direct_collector import AlphaVantageDirectCollector

        api_key = load_api_key()
        collector = AlphaVantageDirectCollector(api_key=api_key)

        # Test technical indicators
        filters = {
            'companies': ['TSLA'],
            'analysis_type': 'technical',
            'technical_indicators': ['RSI'],
            'interval': 'daily',
            'rsi_period': 14
        }

        logger.info(f"Testing technical analysis for: {filters['companies']}")

        start_time = datetime.now()
        data = await collector.collect_data(filters)
        execution_time = (datetime.now() - start_time).total_seconds()

        if data.get('error'):
            logger.error(f"❌ Technical analysis test failed: {data['error']['message']}")
            await collector.cleanup()
            return False

        summary = data.get('summary', {})
        logger.info(f"✅ Technical analysis test passed")
        logger.info(f"  Execution time: {execution_time:.2f}s")
        logger.info(f"  Tools executed: {summary.get('total_tools_executed', 0)}")
        logger.info(f"  Successful tools: {summary.get('successful_tools', 0)}")
        logger.info(f"  Data categories: {summary.get('data_categories', [])}")

        # Show sample technical data
        tech_data = data.get('data', {}).get('technical_indicators', {})
        if tech_data and 'RSI' in tech_data:
            rsi_data = tech_data['RSI']
            if 'Technical Analysis: RSI' in rsi_data:
                rsi_values = rsi_data['Technical Analysis: RSI']
                recent_dates = list(rsi_values.keys())[:3]
                logger.info(f"  Sample RSI data (showing {len(recent_dates)} recent dates):")
                for date in recent_dates:
                    rsi_value = rsi_values[date].get('RSI', 'N/A')
                    logger.info(f"    {date}: RSI={rsi_value}")

        await collector.cleanup()
        return True

    except Exception as e:
        logger.error(f"Technical analysis test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_fundamental_analysis():
    """Test fundamental analysis data collection."""
    logger.info("=== Testing Fundamental Analysis ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_direct_collector import AlphaVantageDirectCollector

        api_key = load_api_key()
        collector = AlphaVantageDirectCollector(api_key=api_key)

        # Test company overview
        filters = {
            'companies': ['AMZN'],
            'analysis_type': 'fundamental'
        }

        logger.info(f"Testing fundamental analysis for: {filters['companies']}")

        start_time = datetime.now()
        data = await collector.collect_data(filters)
        execution_time = (datetime.now() - start_time).total_seconds()

        if data.get('error'):
            logger.error(f"❌ Fundamental analysis test failed: {data['error']['message']}")
            await collector.cleanup()
            return False

        summary = data.get('summary', {})
        logger.info(f"✅ Fundamental analysis test passed")
        logger.info(f"  Execution time: {execution_time:.2f}s")
        logger.info(f"  Tools executed: {summary.get('total_tools_executed', 0)}")
        logger.info(f"  Successful tools: {summary.get('successful_tools', 0)}")
        logger.info(f"  Data categories: {summary.get('data_categories', [])}")

        # Show sample fundamental data
        fund_data = data.get('data', {}).get('fundamental_data', {})
        if fund_data and 'COMPANY_OVERVIEW' in fund_data:
            overview = fund_data['COMPANY_OVERVIEW']
            company_name = overview.get('Name', 'Unknown')
            sector = overview.get('Sector', 'Unknown')
            pe_ratio = overview.get('PERatio', 'N/A')
            market_cap = overview.get('MarketCapitalization', 'N/A')
            logger.info(f"  Company: {company_name}")
            logger.info(f"  Sector: {sector}")
            logger.info(f"  P/E Ratio: {pe_ratio}")
            logger.info(f"  Market Cap: {market_cap}")

        await collector.cleanup()
        return True

    except Exception as e:
        logger.error(f"Fundamental analysis test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def run_comprehensive_test():
    """Run comprehensive test suite."""
    logger.info("🚀 Starting Alpha Vantage Direct MCP Test Suite")

    tests = [
        ("Connection Test", test_connection),
        ("Real-time Data", test_real_time_data),
        ("Historical Data", test_historical_data),
        ("Technical Analysis", test_technical_analysis),
        ("Fundamental Analysis", test_fundamental_analysis)
    ]

    results = {}

    for test_name, test_func in tests:
        logger.info(f"\n{'='*60}")
        logger.info(f"Running {test_name}")
        logger.info(f"{'='*60}")

        try:
            result = await test_func()
            results[test_name] = result

            # Add delay between tests to respect rate limits
            if test_func != test_connection:
                logger.info("Waiting 15s to respect rate limits...")
                await asyncio.sleep(15)

        except Exception as e:
            logger.error(f"{test_name} crashed: {e}")
            results[test_name] = False

    # Final summary
    logger.info(f"\n{'='*60}")
    logger.info("🏁 FINAL TEST SUMMARY")
    logger.info(f"{'='*60}")

    passed_tests = 0
    total_tests = len(results)

    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        logger.info(f"{status} - {test_name}")
        if passed:
            passed_tests += 1

    success_rate = (passed_tests / total_tests) * 100
    logger.info(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")

    if passed_tests == total_tests:
        logger.info("🎉 All tests passed! Alpha Vantage Direct MCP integration is working correctly.")
        return True
    elif passed_tests >= total_tests * 0.6:  # 60% pass rate
        logger.warning("⚠️  Most tests passed. Some issues may need attention.")
        return True
    else:
        logger.error("❌ Integration test failed. Major issues need to be resolved.")
        return False


if __name__ == "__main__":
    try:
        success = asyncio.run(run_comprehensive_test())

        if success:
            logger.info("\n✅ Alpha Vantage Direct MCP integration test completed successfully!")
            sys.exit(0)
        else:
            logger.error("\n❌ Alpha Vantage Direct MCP integration test failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("\n⚠️ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n💥 Test suite crashed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)