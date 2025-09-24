#!/usr/bin/env python3
"""
Fetch company information and business descriptions using yfinance library.
This script is called by the Node.js backend to get company data for sentiment analysis.
"""

import sys
import json
import time
import yfinance as yf
from typing import Dict, Any, Optional

def get_company_sentiment_data(symbol: str) -> Dict[str, Any]:
    """
    Fetch company information and business description for sentiment analysis.

    Args:
        symbol: Stock ticker symbol (e.g., 'AAPL', 'HD')

    Returns:
        Dict containing company information and business description
    """
    try:
        # Create ticker object
        ticker = yf.Ticker(symbol.upper())

        # Get company info
        info = ticker.info

        # Extract business summary and company information for sentiment analysis
        company_data = {
            "symbol": symbol.upper(),
            "success": True,
            "timestamp": int(time.time() * 1000),
            "source": "yahoo_finance",

            # Company Information for Sentiment Analysis
            "companyName": info.get("longName"),
            "shortName": info.get("shortName"),
            "businessSummary": info.get("longBusinessSummary"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "website": info.get("website"),
            "country": info.get("country"),
            "city": info.get("city"),
            "state": info.get("state"),

            # Financial Context for Sentiment
            "marketCap": info.get("marketCap"),
            "enterpriseValue": info.get("enterpriseValue"),
            "fullTimeEmployees": info.get("fullTimeEmployees"),
            "beta": info.get("beta"),

            # Recent Performance Indicators
            "recommendationKey": info.get("recommendationKey"),
            "recommendationMean": info.get("recommendationMean"),
            "targetHighPrice": info.get("targetHighPrice"),
            "targetLowPrice": info.get("targetLowPrice"),
            "targetMeanPrice": info.get("targetMeanPrice"),
            "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),

            # Risk and Growth Indicators
            "earningsGrowth": info.get("earningsGrowth"),
            "revenueGrowth": info.get("revenueGrowth"),
            "returnOnEquity": info.get("returnOnEquity"),
            "debtToEquity": info.get("debtToEquity"),
            "profitMargins": info.get("profitMargins"),

            # ESG Data if available
            "esgScores": info.get("esgScores"),
            "governanceScore": info.get("governanceScore"),
            "environmentScore": info.get("environmentScore"),
            "socialScore": info.get("socialScore"),
        }

        # Clean up None values and ensure proper formatting
        cleaned_data = {}
        for key, value in company_data.items():
            if value is None:
                cleaned_data[key] = None
            elif isinstance(value, (int, float)) and key not in ["success", "timestamp", "marketCap", "enterpriseValue", "fullTimeEmployees"]:
                # Round ratios and percentages to 4 decimal places
                cleaned_data[key] = round(value, 4) if value is not None else None
            else:
                cleaned_data[key] = value

        return cleaned_data

    except Exception as e:
        return {
            "symbol": symbol.upper(),
            "success": False,
            "error": str(e),
            "timestamp": int(time.time() * 1000)
        }

def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python fetch_company_info.py <SYMBOL>"
        }))
        sys.exit(1)

    symbol = sys.argv[1]
    result = get_company_sentiment_data(symbol)

    # Output as JSON
    print(json.dumps(result, default=str))

if __name__ == "__main__":
    main()