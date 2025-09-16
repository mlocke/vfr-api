#!/usr/bin/env python3
"""
Debug test for the updated Alpha Vantage Direct Collector
"""

import os
import sys
import asyncio
import logging
from pathlib import Path

# Add backend to Python path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    logger.warning("python-dotenv not available")

async def test_direct_tool_call():
    """Test direct tool call with debugging."""
    logger.info("=== Testing Direct Tool Call with Debug ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_direct_collector import AlphaVantageDirectCollector

        api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '4M20CQ7QT67RJ835')
        collector = AlphaVantageDirectCollector(api_key=api_key)

        # Establish connection
        connection_result = await collector.establish_connection_async()
        logger.info(f"Connection established: {connection_result}")

        # Test direct tool call
        logger.info("Testing direct GLOBAL_QUOTE call...")
        try:
            result = await collector._call_alpha_vantage_tool('GLOBAL_QUOTE', {'symbol': 'AAPL'})
            logger.info(f"Tool call result: {result}")

            if result:
                logger.info("✅ Tool call successful")
                logger.info(f"Result type: {type(result)}")
                logger.info(f"Result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")

                # Check for Global Quote data
                if isinstance(result, dict) and 'Global Quote' in result:
                    quote = result['Global Quote']
                    logger.info(f"Quote data: {quote}")
                    symbol = quote.get('01. symbol', 'Unknown')
                    price = quote.get('05. price', 'Unknown')
                    logger.info(f"Found quote: {symbol} at ${price}")
                else:
                    logger.warning(f"Unexpected result format: {result}")

            else:
                logger.error("❌ Tool call returned None or empty result")

        except Exception as e:
            logger.error(f"❌ Tool call failed: {e}")
            import traceback
            traceback.print_exc()

        # Cleanup
        await collector.cleanup()

    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()

async def test_collect_data():
    """Test collect_data method with debugging."""
    logger.info("\n=== Testing collect_data Method ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_direct_collector import AlphaVantageDirectCollector

        api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '4M20CQ7QT67RJ835')
        collector = AlphaVantageDirectCollector(api_key=api_key)

        # Test real-time data collection
        filters = {
            'companies': ['AAPL'],
            'real_time': True
        }

        logger.info(f"Testing data collection with filters: {filters}")
        data = await collector.collect_data(filters)

        logger.info(f"Collection result type: {type(data)}")
        logger.info(f"Collection result keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")

        if data.get('error'):
            logger.error(f"❌ Collection error: {data['error']}")
        else:
            summary = data.get('summary', {})
            logger.info(f"Summary: {summary}")

            # Check data structure
            data_section = data.get('data', {})
            logger.info(f"Data section keys: {list(data_section.keys())}")

            if 'market_data' in data_section:
                market_data = data_section['market_data']
                logger.info(f"Market data: {market_data}")

                # Check for specific tool results
                if 'GLOBAL_QUOTE' in market_data:
                    quote_data = market_data['GLOBAL_QUOTE']
                    logger.info(f"GLOBAL_QUOTE result: {quote_data}")

        # Cleanup
        await collector.cleanup()

    except Exception as e:
        logger.error(f"collect_data test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_direct_tool_call())
    asyncio.run(test_collect_data())