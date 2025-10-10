
#!/usr/bin/env python3

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Tuple
import urllib.parse
import urllib.request
import urllib.error

try:
    from dotenv import load_dotenv
except ImportError:
    print("Missing dependency: python-dotenv\nInstall it with: pip install python-dotenv")
    sys.exit(1)

load_dotenv()  # Load .env file from current directory

BASE = "https://financialmodelingprep.com"

ENDPOINTS: List[Tuple[str, str]] = [
    # Insider trading
    ("/api/v4/insider-trading?symbol=AAPL", "Insider trading by symbol (AAPL)"),
    ("/stable/insider-trading/latest", "Latest insider trades"),
    ("/stable/insider-trading/search?symbol=AAPL", "Search insider trades by symbol"),
    ("/stable/insider-trading/reporting-name?name=Cook", "Search insider trades by name (Tim Cook)"),
    ("/stable/insider-roaster?symbol=AAPL", "List of insiders by symbol"),
    ("/stable/insider-trade-statistics", "Insider trading statistics"),
    ("/api/v4/insider-trading-transaction-type", "List of insider trading transaction types"),
    ("/api/v4/insider-trading-rss-feed", "Insider trading RSS feed"),

    # Congressional trading
    ("/stable/house-trades", "All House member trades"),
    ("/stable/house-trades?symbol=AAPL", "House member trades for AAPL"),
    ("/stable/house-latest", "Latest House disclosures"),
    ("/stable/house-trading-by-name?name=Johnson", "House trades by member name (Johnson)"),
    ("/stable/senate-trading", "All Senate trades"),
    ("/stable/senate-trading?symbol=AAPL", "Senate trades for AAPL"),
    ("/api/v4/senate-disclosure", "Senate financial disclosures"),
    ("/api/v4/house-disclosure", "House financial disclosures"),

    # Institutional ownership and hedge funds
    ("/api/v4/institutional-ownership/symbol-ownership?symbol=AAPL", "Institutional ownership (AAPL)"),
    ("/api/v4/institutional-ownership/latest", "Latest institutional ownership"),
    ("/api/v4/hedge-fund-holdings", "List of hedge funds and holdings"),
    ("/api/v4/hedge-fund-portfolio?manager=Michael%20Burry", "Hedge fund portfolio (Michael Burry)"),
    ("/api/v4/mutual-fund-ownership/symbol-ownership?symbol=AAPL", "Mutual fund ownership (AAPL)"),
    ("/api/v3/etf-holder/SPY", "ETF holders (SPY)"),
    ("/api/v3/etf-sector-weightings/SPY", "ETF sector weights (SPY)"),
    ("/api/v3/etf-country-weightings/SPY", "ETF country weights (SPY)"),
]

@dataclass
class ProbeResult:
    endpoint: str
    description: str
    status: int
    ok: bool
    bytes: int
    error: str

def http_get(url: str, retries: int = 3, backoff: float = 1.0, timeout: int = 20):
    last_err = ""
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                data = resp.read()
                return resp.getcode(), data, ""
        except urllib.error.HTTPError as e:
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
            last_err = str(e)
            if attempt < retries:
                time.sleep(backoff * attempt)
                continue
            return 0, b"", last_err
    return 0, b"", last_err

def build_url(path: str, apikey: str) -> str:
    sep = "&" if "?" in path else "?"
    return f"{BASE}{path}{sep}apikey={urllib.parse.quote(apikey)}"

def main():
    parser = argparse.ArgumentParser(description="Probe FMP insider, institutional, and congressional endpoints.")
    parser.add_argument("--sleep", type=float, default=0.3, help="Sleep time between requests (default 0.3s)")
    parser.add_argument("--out-json", default="fmp_extended_probe.json", help="Output JSON file")
    parser.add_argument("--out-csv", default="fmp_extended_probe.csv", help="Output CSV file")
    args = parser.parse_args()

    api_key = os.getenv("FMP_API_KEY")
    if not api_key:
        print("ERROR: Missing FMP_API_KEY in .env file or environment.", file=sys.stderr)
        sys.exit(2)

    total = len(ENDPOINTS)
    results: List[ProbeResult] = []
    print(f"Probing {total} endpoints (insider, institutional, congressional)...\n")

    for i, (path, desc) in enumerate(ENDPOINTS, 1):
        url = build_url(path, api_key)
        status, data, err = http_get(url)
        ok = status == 200 and len(data) > 0
        results.append(ProbeResult(endpoint=path, description=desc, status=status, ok=ok, bytes=len(data), error=err))
        status_msg = "✅ OK" if ok else f"❌ {status or 'ERR'}"
        print(f"[{i:>2}/{total}] {path} → {status_msg} ({len(data)} bytes)")
        if err:
            print(f"     └─ {err}")
        time.sleep(args.sleep)

    ok_count = sum(1 for r in results if r.ok)
    print(f"\nSummary: {ok_count}/{len(results)} endpoints accessible.")
    print(f"Results saved to {args.out_json} and {args.out_csv}")

    with open(args.out_json, "w", encoding="utf-8") as jf:
        json.dump([asdict(r) for r in results], jf, indent=2)

    with open(args.out_csv, "w", newline="", encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow(["endpoint", "description", "status", "ok", "bytes", "error"])
        for r in results:
            writer.writerow([r.endpoint, r.description, r.status, r.ok, r.bytes, r.error])

if __name__ == "__main__":
    main()
