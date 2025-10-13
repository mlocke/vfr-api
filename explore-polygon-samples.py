#!/usr/bin/env python3
"""
Explore Polygon flat file samples and date ranges
"""

import boto3
from botocore.client import Config
import os
from dotenv import load_dotenv
from datetime import datetime
import io
import gzip

# Load environment variables
load_dotenv()

# Configure Polygon flat file access
s3_client = boto3.client(
    's3',
    endpoint_url=os.getenv('S3_ENDPOINT_URL', 'https://files.polygon.io'),
    aws_access_key_id=os.getenv('ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('SECRET_ACCESS_KEY'),
    config=Config(signature_version='s3v4')
)

BUCKET = os.getenv('S3_BUCKET_NAME', 'flatfiles')

def explore_dataset(prefix, limit=5):
    """Explore a specific dataset directory"""
    print(f"\n{'='*80}")
    print(f"📂 {prefix}")
    print(f"{'='*80}")

    try:
        # List files in this directory
        response = s3_client.list_objects_v2(
            Bucket=BUCKET,
            Prefix=prefix,
            MaxKeys=100
        )

        if 'Contents' not in response:
            print("  ❌ No files found")
            return

        files = response['Contents']
        print(f"\n  Total files found: {len(files)}")

        # Show first few files
        print(f"\n  📄 Sample files (showing {min(limit, len(files))}):")
        for i, obj in enumerate(files[:limit]):
            file_name = obj['Key'].split('/')[-1]
            size_mb = obj['Size'] / (1024 * 1024)
            modified = obj['LastModified'].strftime('%Y-%m-%d %H:%M')
            print(f"    {i+1}. {file_name}")
            print(f"       Size: {size_mb:.2f} MB | Modified: {modified}")

        if len(files) > limit:
            print(f"    ... and {len(files) - limit} more files")

        # Try to extract date range from filenames
        print(f"\n  📅 Date range detection:")
        dates = []
        for obj in files:
            filename = obj['Key'].split('/')[-1]
            # Try to extract date (format: YYYY-MM-DD)
            parts = filename.split('-')
            if len(parts) >= 3:
                try:
                    year = int(parts[0].split('_')[-1])
                    month = int(parts[1])
                    day = int(parts[2].split('.')[0])
                    dates.append(datetime(year, month, day))
                except:
                    pass

        if dates:
            earliest = min(dates)
            latest = max(dates)
            print(f"    Earliest: {earliest.strftime('%Y-%m-%d')}")
            print(f"    Latest: {latest.strftime('%Y-%m-%d')}")
            print(f"    Span: {(latest - earliest).days} days")
        else:
            print("    Could not parse dates from filenames")

        # Try to peek at one file
        if files:
            print(f"\n  👁️  Peeking at first file...")
            try:
                first_file = files[0]
                print(f"    Downloading: {first_file['Key'].split('/')[-1]}")

                # Download file
                obj = s3_client.get_object(Bucket=BUCKET, Key=first_file['Key'])
                content = obj['Body'].read()

                # Check if gzipped
                if first_file['Key'].endswith('.gz'):
                    content = gzip.decompress(content)

                # Show first few lines
                lines = content.decode('utf-8').split('\n')[:5]
                print(f"    First {len(lines)} lines:")
                for line in lines:
                    print(f"      {line[:120]}{'...' if len(line) > 120 else ''}")

            except Exception as e:
                print(f"    ⚠️  Could not peek: {str(e)[:100]}")

    except Exception as e:
        print(f"  ❌ Error: {str(e)}")

# Explore key datasets
print("="*80)
print("POLYGON FLAT FILE DATASET EXPLORER")
print("="*80)

datasets_to_explore = [
    'us_stocks_sip/day_aggs_v1/',
    'us_stocks_sip/minute_aggs_v1/',
    'us_stocks_sip/trades_v1/',
    'us_options_opra/day_aggs_v1/',
    'us_options_opra/trades_v1/',
    'global_crypto/day_aggs_v1/',
    'global_forex/day_aggs_v1/',
    'us_indices/day_aggs_v1/'
]

for dataset in datasets_to_explore:
    explore_dataset(dataset, limit=3)

print("\n" + "="*80)
print("✨ Exploration complete!")
print("="*80)
print("\n💡 Next steps:")
print("  1. Choose a dataset that fits your needs")
print("  2. Download files using boto3 S3 client")
print("  3. Parse CSV/JSON data for analysis")
print("  4. Consider building a local cache/database")
