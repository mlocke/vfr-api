#!/usr/bin/env python3
"""
Download SEC Insider Trading and 13F data with proper rate limiting
"""
import os
import time
import requests
from pathlib import Path

# Set up directories
BASE_DIR = Path("/Users/michaellocke/WebstormProjects/Home/public/vfr-api/data/smart_money_raw")
INSIDER_DIR = BASE_DIR / "insider_form4"
INSTITUTIONAL_DIR = BASE_DIR / "institutional_13f"

INSIDER_DIR.mkdir(parents=True, exist_ok=True)
INSTITUTIONAL_DIR.mkdir(parents=True, exist_ok=True)

# SEC requires a User-Agent with contact info
HEADERS = {
    'User-Agent': 'VFR API Research vfr-api@example.com',
    'Accept-Encoding': 'gzip, deflate',
    'Host': 'www.sec.gov'
}

def download_file(url, output_path, delay=10):
    """Download a file with rate limiting"""
    print(f"Downloading: {url}")

    try:
        response = requests.get(url, headers=HEADERS, timeout=60)

        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                f.write(response.content)
            print(f"  ✓ Saved to: {output_path} ({len(response.content)} bytes)")
            time.sleep(delay)  # SEC rate limit: max 10 requests per second
            return True
        else:
            print(f"  ✗ Failed with status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def download_insider_data():
    """Download Form 4 insider trading data"""
    print("\n=== Downloading SEC Form 4 Insider Trading Data ===\n")

    # Years available (SEC typically has quarterly data from 2003-present)
    years = [2024, 2023, 2022, 2021, 2020, 2019, 2018]

    for year in years:
        url = f"https://www.sec.gov/files/dera/data/form-4/form-4_{year}.zip"
        output_path = INSIDER_DIR / f"form-4_{year}.zip"

        if output_path.exists():
            print(f"  ⊘ Skipping {year} (already exists)")
            continue

        download_file(url, output_path, delay=10)

def download_13f_data():
    """Download 13F institutional holdings data"""
    print("\n=== Downloading SEC 13F Institutional Holdings Data ===\n")

    # 13F data is typically released quarterly
    # Format: https://www.sec.gov/files/dera/data/form-13f/YYYY-QQ.zip
    years = [2024, 2023, 2022, 2021, 2020]
    quarters = ['01', '02', '03', '04']

    for year in years:
        for quarter in quarters:
            url = f"https://www.sec.gov/files/dera/data/form-13f/{year}-{quarter}.zip"
            output_path = INSTITUTIONAL_DIR / f"13f_{year}_Q{quarter}.zip"

            if output_path.exists():
                print(f"  ⊘ Skipping {year} Q{quarter} (already exists)")
                continue

            download_file(url, output_path, delay=10)

if __name__ == "__main__":
    print("SEC Data Downloader")
    print("=" * 60)
    print("Note: SEC enforces rate limits. This will take time.")
    print("=" * 60)

    download_insider_data()
    download_13f_data()

    print("\n" + "=" * 60)
    print("Download complete! Check the data/smart_money_raw/ directory")
    print("=" * 60)
