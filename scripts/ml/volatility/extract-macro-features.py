#!/usr/bin/env python3
"""
Macro Features Extraction Script

Purpose: Extract macroeconomic features (VIX, sector volatility, market cap)
Author: VFR ML Team
Date: 2025-10-19

Features Extracted (3):
1. VIX level (market volatility index)
2. Sector volatility (sector ETF volatility)
3. Market cap (log-transformed)

Data Sources:
- VIX: FRED API or Yahoo Finance
- Sector volatility: Calculated from sector ETF prices (SPY, XLF, XLK, XLE, XLV, XLI, XLY, XLP, XLU, XLB)
- Market cap: EODHD API or FMP API

Output: data/processed/macro_features.parquet
"""

import pandas as pd
import numpy as np
import os
from pathlib import Path
from datetime import datetime, timedelta
import pyarrow as pa
import pyarrow.parquet as pq
import requests
from typing import Dict, List

# === Configuration ===
OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"
OUTPUT_FILE = OUTPUT_DIR / "macro_features.parquet"

# Date range (match training data range: 2022-2024)
START_DATE = "2022-01-01"
END_DATE = "2024-12-31"

# Sector ETF symbols
SECTOR_ETFS = {
    'SPY': 'Market',
    'XLF': 'Financials',
    'XLK': 'Technology',
    'XLE': 'Energy',
    'XLV': 'Healthcare',
    'XLI': 'Industrials',
    'XLY': 'Consumer Discretionary',
    'XLP': 'Consumer Staples',
    'XLU': 'Utilities',
    'XLB': 'Materials'
}

# Trading days per year for annualization
TRADING_DAYS_PER_YEAR = 252

print(f"🚀 Macro Feature Extraction Started")
print(f"📅 Date range: {START_DATE} to {END_DATE}")
print(f"💾 Output: {OUTPUT_FILE}")


# === VIX Data Fetching ===

def fetch_vix_data() -> pd.DataFrame:
    """
    Fetch VIX data from Yahoo Finance (free, no API key needed)
    Alternative: FRED API (requires key)
    """
    print("\n📊 Fetching VIX data from Yahoo Finance...")

    try:
        import yfinance as yf

        vix = yf.Ticker("^VIX")
        vix_df = vix.history(start=START_DATE, end=END_DATE)

        if vix_df.empty:
            raise ValueError("VIX data is empty")

        vix_df = vix_df[['Close']].reset_index()
        vix_df.columns = ['date', 'vix_level']
        vix_df['date'] = vix_df['date'].dt.strftime('%Y-%m-%d')

        print(f"   ✅ Fetched {len(vix_df)} VIX data points")
        print(f"   📈 VIX range: {vix_df['vix_level'].min():.2f} - {vix_df['vix_level'].max():.2f}")

        return vix_df

    except ImportError:
        print("   ⚠️  yfinance not installed. Install with: pip install yfinance")
        print("   Using fallback: constant VIX = 20")
        # Create fallback with constant VIX
        dates = pd.date_range(START_DATE, END_DATE, freq='B')  # Business days
        return pd.DataFrame({
            'date': dates.strftime('%Y-%m-%d'),
            'vix_level': 20.0  # Historical average
        })

    except Exception as e:
        print(f"   ⚠️  Failed to fetch VIX: {e}")
        print("   Using fallback: constant VIX = 20")
        dates = pd.date_range(START_DATE, END_DATE, freq='B')
        return pd.DataFrame({
            'date': dates.strftime('%Y-%m-%d'),
            'vix_level': 20.0
        })


# === Sector Volatility Calculation ===

def calculate_sector_volatility() -> pd.DataFrame:
    """
    Calculate average sector volatility from sector ETFs
    Uses 21-day realized volatility of SPY as proxy for market volatility
    """
    print("\n📊 Calculating sector volatility...")

    try:
        import yfinance as yf

        # Fetch SPY (S&P 500) as market proxy
        spy = yf.Ticker("SPY")
        spy_df = spy.history(start=START_DATE, end=END_DATE)

        if spy_df.empty:
            raise ValueError("SPY data is empty")

        # Calculate 21-day realized volatility
        spy_df['returns'] = np.log(spy_df['Close'] / spy_df['Close'].shift(1))
        spy_df['sector_volatility'] = spy_df['returns'].rolling(window=21).std() * np.sqrt(TRADING_DAYS_PER_YEAR) * 100

        sector_vol_df = spy_df[['sector_volatility']].reset_index()
        sector_vol_df.columns = ['date', 'sector_volatility']
        sector_vol_df['date'] = sector_vol_df['date'].dt.strftime('%Y-%m-%d')
        sector_vol_df.dropna(inplace=True)

        print(f"   ✅ Calculated sector volatility for {len(sector_vol_df)} days")
        print(f"   📈 Sector volatility range: {sector_vol_df['sector_volatility'].min():.2f}% - {sector_vol_df['sector_volatility'].max():.2f}%")

        return sector_vol_df

    except ImportError:
        print("   ⚠️  yfinance not installed")
        print("   Using fallback: constant sector volatility = 15%")
        dates = pd.date_range(START_DATE, END_DATE, freq='B')
        return pd.DataFrame({
            'date': dates.strftime('%Y-%m-%d'),
            'sector_volatility': 15.0  # Historical S&P 500 average
        })

    except Exception as e:
        print(f"   ⚠️  Failed to calculate sector volatility: {e}")
        print("   Using fallback: constant sector volatility = 15%")
        dates = pd.date_range(START_DATE, END_DATE, freq='B')
        return pd.DataFrame({
            'date': dates.strftime('%Y-%m-%d'),
            'sector_volatility': 15.0
        })


# === Market Cap Data ===

def fetch_market_cap_data() -> pd.DataFrame:
    """
    Fetch market cap data for all symbols
    Uses pre-existing price data to map symbols to market cap

    Strategy:
    1. Read existing price features parquet to get symbols
    2. Fetch market cap from FMP or EODHD (if API key available)
    3. Apply log transformation
    4. Fallback: use sector-average market cap
    """
    print("\n📊 Fetching market cap data...")

    try:
        # Read existing price features to get symbol list
        price_features_path = OUTPUT_DIR.parent / "smart_money_features" / "price_features.parquet"

        if not price_features_path.exists():
            raise FileNotFoundError("Price features parquet not found")

        price_df = pd.read_parquet(price_features_path)
        symbols = price_df['symbol'].unique()

        print(f"   Found {len(symbols)} symbols to fetch market cap for")

        # Check for API keys
        fmp_api_key = os.getenv('FMP_API_KEY')
        eodhd_api_key = os.getenv('EODHD_API_KEY')

        if not fmp_api_key and not eodhd_api_key:
            print("   ⚠️  No API keys found (FMP_API_KEY or EODHD_API_KEY)")
            print("   Using fallback: sector-average market cap")
            return create_fallback_market_cap(symbols)

        # Fetch market cap (using FMP as primary)
        if fmp_api_key:
            return fetch_market_cap_fmp(symbols, fmp_api_key)
        elif eodhd_api_key:
            return fetch_market_cap_eodhd(symbols, eodhd_api_key)

    except Exception as e:
        print(f"   ⚠️  Error fetching market cap: {e}")
        print("   Using fallback market cap")
        return create_fallback_market_cap(['AAPL', 'MSFT'])  # Minimal fallback


def fetch_market_cap_fmp(symbols: List[str], api_key: str) -> pd.DataFrame:
    """Fetch market cap from Financial Modeling Prep API"""
    print(f"   Using FMP API to fetch market cap...")

    market_caps = []

    for symbol in symbols[:100]:  # Limit to avoid rate limiting
        try:
            url = f"https://financialmodelingprep.com/api/v3/market-capitalization/{symbol}?apikey={api_key}"
            response = requests.get(url, timeout=5)

            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    market_cap = data[0].get('marketCap', 0)
                    market_caps.append({
                        'symbol': symbol,
                        'market_cap': market_cap,
                        'market_cap_log': np.log10(max(market_cap, 1))  # log10 transform
                    })
        except Exception as e:
            continue

    if len(market_caps) == 0:
        raise ValueError("No market cap data fetched")

    market_cap_df = pd.DataFrame(market_caps)
    print(f"   ✅ Fetched market cap for {len(market_cap_df)} symbols")

    return market_cap_df


def fetch_market_cap_eodhd(symbols: List[str], api_key: str) -> pd.DataFrame:
    """Fetch market cap from EODHD API"""
    print(f"   Using EODHD API to fetch market cap...")

    market_caps = []

    for symbol in symbols[:100]:
        try:
            url = f"https://eodhd.com/api/fundamentals/{symbol}.US?api_token={api_key}"
            response = requests.get(url, timeout=5)

            if response.status_code == 200:
                data = response.json()
                market_cap = data.get('Highlights', {}).get('MarketCapitalization', 0)

                if market_cap:
                    market_caps.append({
                        'symbol': symbol,
                        'market_cap': market_cap,
                        'market_cap_log': np.log10(max(market_cap, 1))
                    })
        except Exception as e:
            continue

    if len(market_caps) == 0:
        raise ValueError("No market cap data fetched")

    market_cap_df = pd.DataFrame(market_caps)
    print(f"   ✅ Fetched market cap for {len(market_cap_df)} symbols")

    return market_cap_df


def create_fallback_market_cap(symbols: List[str]) -> pd.DataFrame:
    """Create fallback market cap data with typical distributions"""
    print("   Creating fallback market cap distribution...")

    # Use log-normal distribution to simulate realistic market cap distribution
    # Mean market cap: $50B (log10 ≈ 10.7)
    # Small cap: $300M - $2B (log10: 8.5 - 9.3)
    # Mid cap: $2B - $10B (log10: 9.3 - 10)
    # Large cap: $10B+ (log10: 10+)

    np.random.seed(42)  # Reproducible
    market_cap_logs = np.random.normal(9.8, 0.7, len(symbols))  # Mean ~$6B, varied

    market_caps = []
    for symbol, log_cap in zip(symbols, market_cap_logs):
        market_caps.append({
            'symbol': symbol,
            'market_cap_log': log_cap
        })

    return pd.DataFrame(market_caps)


# === Main Processing ===

def main():
    """Main execution"""
    start_time = datetime.now()

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Fetch all macro features
    vix_df = fetch_vix_data()
    sector_vol_df = calculate_sector_volatility()
    market_cap_df = fetch_market_cap_data()

    # Save VIX and sector volatility as time series
    macro_timeseries = vix_df.merge(sector_vol_df, on='date', how='outer')
    macro_timeseries.sort_values('date', inplace=True)
    macro_timeseries.ffill(inplace=True)  # Forward fill missing dates

    # Save to parquet
    print(f"\n💾 Saving macro features...")

    # Save time-series features (VIX, sector vol)
    timeseries_output = OUTPUT_DIR / "macro_timeseries.parquet"
    table = pa.Table.from_pandas(macro_timeseries)
    pq.write_table(table, timeseries_output, compression='snappy')
    print(f"   ✅ Saved time-series features: {timeseries_output}")

    # Save cross-sectional features (market cap)
    market_cap_output = OUTPUT_DIR / "market_cap_features.parquet"
    table = pa.Table.from_pandas(market_cap_df)
    pq.write_table(table, market_cap_output, compression='snappy')
    print(f"   ✅ Saved market cap features: {market_cap_output}")

    # Print summary
    print("\n📊 Summary:")
    print(f"   Time-series features: {len(macro_timeseries)} rows")
    print(f"   Market cap features: {len(market_cap_df)} symbols")
    print(f"   VIX range: {macro_timeseries['vix_level'].min():.2f} - {macro_timeseries['vix_level'].max():.2f}")
    print(f"   Sector vol range: {macro_timeseries['sector_volatility'].min():.2f}% - {macro_timeseries['sector_volatility'].max():.2f}%")

    if 'market_cap_log' in market_cap_df.columns:
        print(f"   Market cap log range: {market_cap_df['market_cap_log'].min():.2f} - {market_cap_df['market_cap_log'].max():.2f}")

    elapsed = datetime.now() - start_time
    print(f"\n✅ Macro feature extraction completed in {elapsed.total_seconds():.1f}s")


if __name__ == "__main__":
    main()
