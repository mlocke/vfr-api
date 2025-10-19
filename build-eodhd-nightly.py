#!/usr/bin/env python3
"""
Nightly EODHD Options Dataset Builder with Progress Tracking

Runs automatically via cron, processes a batch of tickers each night,
tracks progress, and notifies when complete.

Usage:
    python3 build-eodhd-nightly.py
"""

import os
import json
import sys
import importlib.util
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from pathlib import Path

# Import the dataset builder module (has hyphens in filename)
spec = importlib.util.spec_from_file_location("builder", "./build-eodhd-options-dataset-fixed.py")
builder_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder_module)
EODHDOptionsDatasetBuilder = builder_module.EODHDOptionsDatasetBuilder

# Configuration
PROGRESS_FILE = './data/eodhd_options/progress.json'
BATCH_SIZE = 25  # Process 25 tickers per night (varies based on ticker size)
MAX_API_CALLS = 9000  # Stop at ~90% of daily limit (9,000 requests × 10 credits = 90,000/100,000)
LOG_FILE = './data/eodhd_options/nightly_build.log'

# Email Configuration
# Set your email details here or use environment variables
EMAIL_ENABLED = os.getenv('EODHD_EMAIL_ENABLED', 'false').lower() == 'true'
EMAIL_TO = os.getenv('EODHD_EMAIL_TO', 'your-email@example.com')
EMAIL_FROM = os.getenv('EODHD_EMAIL_FROM', EMAIL_TO)
SMTP_SERVER = os.getenv('EODHD_SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('EODHD_SMTP_PORT', '587'))
SMTP_USERNAME = os.getenv('EODHD_SMTP_USERNAME', EMAIL_FROM)
SMTP_PASSWORD = os.getenv('EODHD_SMTP_PASSWORD', '')  # Use app password for Gmail

def log(message):
    """Log message to file and stdout"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"[{timestamp}] {message}"
    print(log_msg)

    # Append to log file
    with open(LOG_FILE, 'a') as f:
        f.write(log_msg + '\n')

def send_email(subject, body):
    """Send email notification"""
    if not EMAIL_ENABLED:
        return

    if not SMTP_PASSWORD:
        log("⚠️  Email enabled but no SMTP password configured")
        return

    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = EMAIL_TO
        msg['Subject'] = subject

        # Add body
        msg.attach(MIMEText(body, 'plain'))

        # Connect and send
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()

        log(f"📧 Email sent to {EMAIL_TO}")
    except Exception as e:
        log(f"❌ Failed to send email: {str(e)}")

def load_progress():
    """Load progress from file"""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            return json.load(f)
    else:
        return {
            'completed_tickers': [],
            'failed_tickers': [],
            'started_at': datetime.now().isoformat(),
            'last_run': None,
            'total_api_calls': 0,
            'total_contracts': 0
        }

def save_progress(progress):
    """Save progress to file"""
    progress['last_run'] = datetime.now().isoformat()
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

def get_sp500_tickers():
    """Get S&P 500 ticker list"""
    tickers = []

    # Try to load from financials.csv
    if os.path.exists('financials.csv'):
        import csv
        with open('financials.csv', 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                tickers.append(row['Symbol'])
        log(f"Loaded {len(tickers)} tickers from financials.csv")
    else:
        # Default major tickers (fallback)
        tickers = [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD',
            'NFLX', 'DIS', 'BABA', 'V', 'MA', 'JPM', 'BAC', 'WFC', 'GS',
            'SPY', 'QQQ', 'IWM', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLU',
            'INTC', 'CSCO', 'ORCL', 'CRM', 'ADBE', 'PYPL', 'UBER', 'LYFT',
            'F', 'GM', 'T', 'VZ', 'KO', 'PEP', 'WMT', 'TGT', 'HD', 'LOW',
            'MCD', 'SBUX', 'NKE', 'BA', 'CAT', 'DE', 'MMM', 'HON', 'UNP'
        ]
        log(f"Using {len(tickers)} default tickers (financials.csv not found)")

    return tickers

def send_completion_notification(progress):
    """Send notification when dataset build is complete"""
    total_tickers = len(progress['completed_tickers']) + len(progress['failed_tickers'])
    success_rate = len(progress['completed_tickers']) / total_tickers * 100 if total_tickers > 0 else 0

    message = f"""
{'='*80}
🎉 EODHD OPTIONS DATASET BUILD COMPLETE 🎉
{'='*80}

Started: {progress['started_at']}
Completed: {datetime.now().isoformat()}

Statistics:
  ✅ Successful: {len(progress['completed_tickers'])} tickers
  ❌ Failed: {len(progress['failed_tickers'])} tickers
  📊 Success Rate: {success_rate:.1f}%
  📞 Total API Calls: {progress['total_api_calls']:,}
  📋 Total Contracts: {progress['total_contracts']:,}

Dataset Location: ./data/eodhd_options/

{'='*80}
"""

    log(message)

    # Write completion marker
    completion_file = './data/eodhd_options/BUILD_COMPLETE.txt'
    with open(completion_file, 'w') as f:
        f.write(message)

def main():
    """Main nightly build process"""
    log("="*80)
    log("Starting nightly EODHD options dataset build")
    log("="*80)

    # Load progress
    progress = load_progress()

    # Get all tickers
    all_tickers = get_sp500_tickers()

    # Get remaining tickers
    completed = set(progress['completed_tickers'])
    failed = set(progress['failed_tickers'])
    remaining = [t for t in all_tickers if t not in completed and t not in failed]

    log(f"Progress: {len(completed)} completed, {len(failed)} failed, {len(remaining)} remaining")

    if not remaining:
        log("✅ All tickers completed!")
        send_completion_notification(progress)
        return 0

    # Get batch for tonight
    batch = remaining[:BATCH_SIZE]
    log(f"Tonight's batch: {len(batch)} tickers")
    log(f"Tickers: {', '.join(batch)}")

    # Build dataset
    builder = EODHDOptionsDatasetBuilder()

    for i, ticker in enumerate(batch):
        log(f"\n[{i+1}/{len(batch)}] Processing {ticker}...")

        # Check if we're approaching API limit
        if builder.api_call_count >= MAX_API_CALLS:
            log(f"⚠️  Approaching API limit ({builder.api_call_count:,} calls), stopping for tonight")
            break

        try:
            data = builder.get_options_data(ticker)

            if data and len(data) > 0:
                # Save data
                today = datetime.now().strftime('%Y-%m-%d')
                # builder.save_to_json(ticker, data, today)  # Disabled to save disk space
                builder.save_to_csv(ticker, data, today)

                # Update progress
                progress['completed_tickers'].append(ticker)
                progress['total_contracts'] += len(data)

                log(f"✅ {ticker}: {len(data):,} contracts saved")
            else:
                progress['failed_tickers'].append(ticker)
                log(f"❌ {ticker}: No data retrieved")

        except Exception as e:
            progress['failed_tickers'].append(ticker)
            log(f"❌ {ticker}: Error - {str(e)}")

        # Update progress after each ticker
        progress['total_api_calls'] = builder.api_call_count
        save_progress(progress)

    # Final summary
    log("\n" + "="*80)
    log("Nightly build summary")
    log("="*80)
    log(f"API calls used tonight: {builder.api_call_count:,}")
    log(f"Total progress: {len(progress['completed_tickers'])}/{len(all_tickers)} tickers")

    remaining_after = len(all_tickers) - len(progress['completed_tickers']) - len(progress['failed_tickers'])

    # Prepare email summary
    success_tonight = len([t for t in batch if t in progress['completed_tickers']])
    failed_tonight = len([t for t in batch if t in progress['failed_tickers']])

    email_body = f"""EODHD Options Dataset - Nightly Build Report
{'='*60}

Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Tonight's Results:
  ✅ Successful: {success_tonight} tickers
  ❌ Failed: {failed_tonight} tickers
  📞 API Calls: {builder.api_call_count:,}

Overall Progress:
  Completed: {len(progress['completed_tickers'])}/{len(all_tickers)} tickers ({len(progress['completed_tickers'])/len(all_tickers)*100:.1f}%)
  Failed: {len(progress['failed_tickers'])} tickers
  Remaining: {remaining_after} tickers

  Total API Calls Used: {progress['total_api_calls']:,}
  Total Contracts: {progress['total_contracts']:,}
"""

    if remaining_after == 0:
        log("\n🎉 Dataset build COMPLETE!")
        email_body += f"\n🎉 DATASET BUILD COMPLETE! 🎉\n\nAll tickers processed successfully."
        send_completion_notification(progress)
        send_email("✅ EODHD Dataset Build COMPLETE", email_body)
    else:
        estimated_days = (remaining_after / BATCH_SIZE) + 1
        log(f"Estimated nights remaining: {estimated_days:.0f}")
        email_body += f"\nEstimated nights remaining: {estimated_days:.0f}\n"
        send_email(f"EODHD Nightly Build Report - {len(progress['completed_tickers'])}/{len(all_tickers)} Complete", email_body)

    log("="*80)

    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:
        log(f"FATAL ERROR: {str(e)}")
        import traceback
        log(traceback.format_exc())
        sys.exit(1)
