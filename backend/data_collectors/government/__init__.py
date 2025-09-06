"""
Government data collectors for official financial and economic data.

This module contains collectors for authoritative government sources:
- SEC EDGAR: Public company filings and reports
- Federal Reserve (FRED): Economic indicators and monetary data
- Treasury Direct: US Treasury securities and bond data
- Bureau of Labor Statistics: Employment and inflation data
- Census Bureau: Economic indicators and demographics

All government sources are free but some require API registration.
"""

from .sec_edgar_collector import SECEdgarCollector
from .fred_collector import FREDCollector
from .treasury_direct_collector import TreasuryDirectCollector

__all__ = [
    "SECEdgarCollector",
    "FREDCollector", 
    "TreasuryDirectCollector"
]