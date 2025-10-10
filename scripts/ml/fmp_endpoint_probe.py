
#!/usr/bin/env python3

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass, asdict
from typing import Dict, List, Tuple
import urllib.parse
import urllib.request
import urllib.error
from dotenv import load_dotenv

BASE = "https://financialmodelingprep.com"

# Some endpoints live under /api/v3 and others under /api/v4 or /stable
# We'll probe a broad, representative set so you can see exactly what your key can hit.
# You can comment/uncomment categories to narrow the test.
CATEGORIES: Dict[str, List[Tuple[str, str]]] = {
    "Directory & Search": [
        ("/api/v3/stock/list", "GET list of stock symbols"),
        ("/api/v3/financial-statement-symbol-lists", "Symbols with fundamentals coverage"),
        ("/api/v3/symbol/available-indexes", "Available stock indices"),
    ],
    "Company / Profile": [
        ("/api/v3/profile/AAPL", "Company profile (AAPL)"),
        ("/api/v3/quote-short/AAPL", "Quote (short) (AAPL)"),
        ("/api/v3/quote/AAPL", "Quote (full) (AAPL)"),
        ("/api/v3/stock/peers?symbol=AAPL", "Peers (AAPL)"),
        ("/api/v3/stock/price-change/AAPL", "Price change metrics (AAPL)"),
    ],
    "Fundamentals": [
        ("/api/v3/income-statement/AAPL?period=annual&limit=5", "Income statement (AAPL)"),
        ("/api/v3/balance-sheet-statement/AAPL?period=annual&limit=5", "Balance sheet (AAPL)"),
        ("/api/v3/cash-flow-statement/AAPL?period=annual&limit=5", "Cash flow (AAPL)"),
        ("/api/v3/key-metrics/AAPL?period=annual&limit=5", "Key metrics (AAPL)"),
        ("/api/v3/ratios/AAPL?period=annual&limit=5", "Financial ratios (AAPL)"),
        ("/api/v3/enterprise-values/AAPL?period=annual&limit=5", "Enterprise values (AAPL)"),
        ("/api/v3/financial-growth/AAPL?period=annual&limit=5", "Financial growth (AAPL)"),
    ],
    "Historical Prices & Charts": [
        ("/api/v3/historical-price-full/AAPL?serietype=line&timeseries=100", "EOD historical price (AAPL)"),
        ("/api/v3/historical-price-full/stock_dividend/AAPL?timeseries=50", "Dividends (AAPL)"),
        ("/api/v3/historical-price-full/stock_split/AAPL?timeseries=50", "Splits (AAPL)"),
        # Intraday endpoints vary by plan; still probing to confirm
        ("/api/v3/historical-chart/1min/AAPL?timeseries=60", "Intraday 1min (AAPL)"),
        ("/api/v3/historical-chart/5min/AAPL?timeseries=60", "Intraday 5min (AAPL)"),
    ],
    "Calendars & Events": [
        ("/api/v3/earning_calendar?from=2024-01-01&to=2024-12-31&symbol=AAPL", "Earnings calendar (AAPL, 2024)"),
        ("/api/v3/ipo_calendar?from=2024-01-01&to=2024-12-31", "IPO calendar 2024"),
        ("/api/v3/economic_calendar?from=2024-01-01&to=2024-01-10", "Economic calendar (sample range)"),
    ],
    "News & Transcripts": [
        ("/api/v4/general_news?page=0", "General market news (page 0)"),
        ("/api/v4/earning_call_transcript?symbol=AAPL&year=2024&quarter=1", "Earnings call transcript (AAPL 2024 Q1)"),
    ],
    "Ownership & Filings": [
        ("/api/v4/insider-trading?symbol=AAPL", "Insider trading (AAPL)"),
        ("/api/v4/institutional-ownership/symbol-ownership?symbol=AAPL", "13F institutional ownership (AAPL)"),
        ("/api/v3/sec_filings/AAPL?limit=30", "SEC filings (AAPL)"),
    ],
    "ETFs / Index / Funds": [
        ("/api/v3/etf/list", "ETF list"),
        ("/api/v3/etf-holder/SPY", "ETF holders (SPY)"),
        ("/api/v3/etf-sector-weightings/SPY", "ETF sector weights (SPY)"),
        ("/api/v3/etf-country-weightings/SPY", "ETF country weights (SPY)"),
        ("/api/v3/historical-price-full/SPY?serietype=line&timeseries=50", "EOD historical price (SPY)"),
    ],
    "Forex / Crypto / Commodities": [
        ("/api/v3/forex", "Forex pairs list"),
        ("/api/v3/quote/EURUSD", "Forex quote (EURUSD)"),
        ("/api/v3/cryptocurrencies", "Cryptocurrencies list"),
        ("/api/v3/quote/BTCUSD", "Crypto quote (BTCUSD)"),
        ("/api/v3/quotes/commodity", "Commodity quotes"),
    ],
    "Screener & Bulk-ish": [
        ("/api/v3/stock-screener?marketCapMoreThan=2000000000&betaLessThan=1.5&limit=50", "Stock screener (filters)"),
        ("/api/v3/rating/AAPL", "Company rating (AAPL)"),
        ("/api/v3/discounted-cash-flow/AAPL", "DCF valuation (AAPL)"),
    ],
}

@dataclass
class ProbeResult:
    category: str
    endpoint: str
    description: str
    status: int
    ok: bool
    bytes: int
    error: str

def http_get(url: str, retries: int = 3, backoff: float = 1.0, timeout: int = 20) -> Tuple[int, bytes, str]:
    last_err = ""
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                data = resp.read()
                return resp.getcode(), data, ""
        except urllib.error.HTTPError as e:
            # 429/5xx → backoff and retry
            last_err = f"HTTPError {e.code}: {e.reason}"
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(backoff * attempt)
                continue
            return e.code, b"", last_err
        except urllib.error.URLError as e:
            last_err = f"URLError: {e.reason}"
            if attempt < retries:
                time.sleep(backoff * attempt)
                continue
            return 0, b"", last_err
        except Exception as e:
            last_err = f"Error: {e}"
            if attempt < retries:
                time.sleep(backoff * attempt)
                continue
            return 0, b"", last_err
    return 0, b"", last_err

def build_url(path: str, apikey: str) -> str:
    # If path already has query params, append apikey with &; else with ?
    sep = "&" if "?" in path else "?"
    return f"{BASE}{path}{sep}apikey={urllib.parse.quote(apikey)}"

def main():
    # Load environment variables from .env file
    load_dotenv()

    parser = argparse.ArgumentParser(description="Probe Financial Modeling Prep endpoints for your API key.")
    parser.add_argument("--apikey", "-k", default=os.getenv("FMP_API_KEY", ""), help="FMP API key (or set FMP_API_KEY in .env file)")
    parser.add_argument("--sleep", type=float, default=0.2, help="Sleep seconds between requests to avoid rate limits (default 0.2)")
    parser.add_argument("--out-json", default="fmp_probe_results.json", help="Output JSON file (default fmp_probe_results.json)")
    parser.add_argument("--out-csv", default="fmp_probe_results.csv", help="Output CSV file (default fmp_probe_results.csv)")
    args = parser.parse_args()

    if not args.apikey:
        print("ERROR: Provide an API key with --apikey or set FMP_API_KEY in .env file.", file=sys.stderr)
        sys.exit(2)

    results: List[ProbeResult] = []

    total = sum(len(v) for v in CATEGORIES.values())
    print(f"Probing {total} endpoints with your key...")
    count = 0

    for category, endpoints in CATEGORIES.items():
        print(f"\n== {category} ==")
        for path, desc in endpoints:
            count += 1
            url = build_url(path, args.apikey)
            status, data, err = http_get(url)
            ok = (status == 200 and len(data) > 0)
            results.append(ProbeResult(
                category=category,
                endpoint=path,
                description=desc,
                status=status,
                ok=ok,
                bytes=len(data),
                error=err
            ))
            status_msg = "✅ OK" if ok else f"❌ {status or 'ERR'}"
            print(f"[{count:>2}/{total}] {path} → {status_msg} ({len(data)} bytes)")
            if err:
                print(f"     └─ {err}")
            time.sleep(args.sleep)

    # Write JSON
    with open(args.out_json, "w", encoding="utf-8") as f:
        json.dump([asdict(r) for r in results], f, indent=2)

    # Write CSV
    with open(args.out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["category", "endpoint", "description", "status", "ok", "bytes", "error"])
        for r in results:
            writer.writerow([r.category, r.endpoint, r.description, r.status, r.ok, r.bytes, r.error])

    # Print summary table
    ok_count = sum(1 for r in results if r.ok)
    print("\nSummary:")
    print(f"  Accessible: {ok_count}/{len(results)}")
    print(f"  Results saved to: {args.out_json}, {args.out_csv}")
    print("\nTip: Re-run with a higher --sleep if you see 429 (rate limit).")

if __name__ == "__main__":
    main()
