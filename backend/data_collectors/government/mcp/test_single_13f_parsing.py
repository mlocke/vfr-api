#!/usr/bin/env python3
"""
Test single 13F filing parsing to validate real XML parsing works.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the tools directory to the Python path
sys.path.insert(0, str(Path(__file__).parent / "tools"))

from tools.institutional_tracking_tools import Form13FProcessor

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_single_13f_parsing():
    """Test parsing a single known 13F filing."""
    processor = Form13FProcessor()
    
    try:
        # Test with the specific filing we examined earlier
        cik = "0001602119"  # 1060 Capital
        quarter = "2024-Q1"
        
        logger.info(f"Testing individual 13F parsing for CIK {cik}")
        
        # Get holdings for this specific institution
        holdings = await processor.get_13f_holdings(cik, quarter)
        
        if holdings:
            logger.info(f"✓ Successfully parsed {len(holdings)} holdings")
            
            for i, holding in enumerate(holdings[:3], 1):  # Show first 3
                logger.info(f"  Holding {i}:")
                logger.info(f"    Institution: {holding.institution_name}")
                logger.info(f"    CUSIP: {holding.cusip}")
                logger.info(f"    Shares: {holding.shares_held:,}")
                logger.info(f"    Value: ${holding.market_value:,.0f}")
                logger.info(f"    Filing Date: {holding.filing_date}")
        else:
            logger.error("✗ No holdings parsed")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await processor.cleanup()


if __name__ == '__main__':
    asyncio.run(test_single_13f_parsing())