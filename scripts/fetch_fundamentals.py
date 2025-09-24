#!/usr/bin/env python3
"""
Fetch fundamental data using yfinance library.
This script is called by the Node.js backend to get real fundamental data.
"""

import sys
import json
import time
import yfinance as yf
from typing import Dict, Any, Optional

def get_fundamental_data(symbol: str) -> Dict[str, Any]:
    """
    Fetch fundamental data for a given stock symbol.

    Args:
        symbol: Stock ticker symbol (e.g., 'AAPL', 'HD')

    Returns:
        Dict containing fundamental ratios and metrics
    """
    try:
        # Create ticker object
        ticker = yf.Ticker(symbol.upper())

        # Get company info
        info = ticker.info

        # Extract and calculate fundamental ratios
        fundamentals = {
            "symbol": symbol.upper(),
            "success": True,
            "timestamp": int(time.time() * 1000),  # Add timestamp in milliseconds
            "source": "yfinance",  # Add source field</

            # Valuation Ratios
            "peRatio": info.get("trailingPE"),
            "forwardPE": info.get("forwardPE"),
            "pegRatio": info.get("pegRatio"),
            "pbRatio": info.get("priceToBook"),
            "priceToSales": info.get("priceToSalesTrailing12Months"),
            "priceToFreeCashFlow": info.get("priceToFreeCashFlowsPerShare"),
            "enterpriseValue": info.get("enterpriseValue"),
            "evToRevenue": info.get("enterpriseToRevenue"),
            "evToEbitda": info.get("enterpriseToEbitda"),

            # Profitability Ratios
            "roe": info.get("returnOnEquity"),
            "roa": info.get("returnOnAssets"),
            "grossProfitMargin": info.get("grossMargins"),
            "operatingMargin": info.get("operatingMargins"),
            "netProfitMargin": info.get("profitMargins"),
            "ebitdaMargin": info.get("ebitdaMargins"),

            # Financial Health
            "debtToEquity": info.get("debtToEquity"),
            "currentRatio": info.get("currentRatio"),
            "quickRatio": info.get("quickRatio"),
            "interestCoverage": info.get("interestCoverage"),
            "totalDebt": info.get("totalDebt"),
            "totalCash": info.get("totalCash"),
            "cashPerShare": info.get("totalCashPerShare"),

            # Dividend & Yield
            "dividendYield": info.get("dividendYield"),
            "dividendRate": info.get("dividendRate"),
            "payoutRatio": info.get("payoutRatio"),
            "fiveYearAvgDividendYield": info.get("fiveYearAvgDividendYield"),

            # Growth Metrics
            "revenueGrowth": info.get("revenueGrowth"),
            "earningsGrowth": info.get("earningsGrowth"),
            "revenuePerShare": info.get("revenuePerShare"),
            "earningsPerShare": info.get("trailingEps"),

            # Share Information
            "marketCap": info.get("marketCap"),
            "sharesOutstanding": info.get("sharesOutstanding"),
            "floatShares": info.get("floatShares"),
            "beta": info.get("beta"),

            # Additional Metrics
            "bookValue": info.get("bookValue"),
            "priceToBook": info.get("priceToBook"),
            "forwardEps": info.get("forwardEps"),
            "trailingEps": info.get("trailingEps"),
            "pegRatio": info.get("pegRatio"),

            # Company Info
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "fullTimeEmployees": info.get("fullTimeEmployees"),
            "country": info.get("country"),
            "currency": info.get("currency")
        }

        # Convert None values to null for JSON serialization
        # and ensure numeric values are properly formatted
        for key, value in fundamentals.items():
            if value is None:
                fundamentals[key] = None
            elif isinstance(value, (int, float)) and key not in ["success", "fullTimeEmployees", "sharesOutstanding", "floatShares", "marketCap", "enterpriseValue", "totalDebt", "totalCash"]:
                # Round ratios to 4 decimal places
                fundamentals[key] = round(value, 4) if value is not None else None

        return fundamentals

    except Exception as e:
        return {
            "symbol": symbol.upper(),
            "success": False,
            "error": str(e)
        }

def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python fetch_fundamentals.py <SYMBOL>"
        }))
        sys.exit(1)

    symbol = sys.argv[1]
    result = get_fundamental_data(symbol)

    # Output as JSON
    print(json.dumps(result, default=str))

if __name__ == "__main__":
    main()