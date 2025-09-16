#!/usr/bin/env python3
"""
Test the original Alpha Vantage collector that was converted from mock to real data
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
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    logger.warning("python-dotenv not available")

async def test_original_collector():
    """Test the original Alpha Vantage MCP collector."""
    logger.info("=== Testing Original Alpha Vantage MCP Collector ===")

    try:
        from data_collectors.commercial.mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector

        api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '4M20CQ7QT67RJ835')
        collector = AlphaVantageMCPCollector(api_key=api_key)

        logger.info(f"Created collector: {collector}")

        # Test connection
        connection_result = await collector.establish_connection_async()
        logger.info(f"Connection established: {connection_result}")

        if connection_result:
            # Test data collection
            filters = {
                'companies': ['AAPL'],
                'real_time': True
            }

            logger.info(f"Testing data collection with filters: {filters}")
            data = await collector.collect_data(filters)

            if data.get('error'):
                logger.error(f"❌ Collection error: {data['error']}")
            else:
                summary = data.get('summary', {})
                logger.info(f"✅ Collection successful")
                logger.info(f"Summary: {summary}")

                # Check for market data
                market_data = data.get('data', {}).get('market_data', {})
                if market_data:
                    logger.info("Market data found:")
                    for tool, tool_data in market_data.items():
                        logger.info(f"  {tool}: {type(tool_data).__name__}")

        # Cleanup
        await collector.cleanup()

    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_original_collector())