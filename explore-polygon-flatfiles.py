#!/usr/bin/env python3
"""
Explore Polygon.io flat file access and available datasets
"""

import boto3
from botocore.client import Config
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Polygon flat file access
ACCESS_KEY_ID = os.getenv('ACCESS_KEY_ID')
SECRET_ACCESS_KEY = os.getenv('SECRET_ACCESS_KEY')
S3_ENDPOINT_URL = os.getenv('S3_ENDPOINT_URL', 'https://files.polygon.io')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'flatfiles')

print("=" * 80)
print("POLYGON.IO FLAT FILE EXPLORER")
print("=" * 80)
print(f"\nEndpoint: {S3_ENDPOINT_URL}")
print(f"Bucket: {S3_BUCKET_NAME}")
print(f"Access Key ID: {ACCESS_KEY_ID[:20]}...")
print("\n" + "=" * 80)

# Create S3 client for Polygon
s3_client = boto3.client(
    's3',
    endpoint_url=S3_ENDPOINT_URL,
    aws_access_key_id=ACCESS_KEY_ID,
    aws_secret_access_key=SECRET_ACCESS_KEY,
    config=Config(signature_version='s3v4')
)

try:
    print("\n📂 Listing available datasets in bucket...")
    print("-" * 80)

    # List objects in the bucket
    response = s3_client.list_objects_v2(
        Bucket=S3_BUCKET_NAME,
        Delimiter='/',
        MaxKeys=100
    )

    if 'CommonPrefixes' in response:
        print("\n✅ Available Dataset Directories:\n")
        for prefix in response['CommonPrefixes']:
            dir_name = prefix['Prefix'].rstrip('/')
            print(f"  📁 {dir_name}")

            # Try to peek into each directory
            try:
                sub_response = s3_client.list_objects_v2(
                    Bucket=S3_BUCKET_NAME,
                    Prefix=prefix['Prefix'],
                    Delimiter='/',
                    MaxKeys=10
                )

                if 'CommonPrefixes' in sub_response:
                    print(f"     Subdirectories:")
                    for sub_prefix in sub_response['CommonPrefixes'][:5]:
                        sub_dir = sub_prefix['Prefix'].replace(prefix['Prefix'], '').rstrip('/')
                        print(f"       - {sub_dir}")
                    if len(sub_response['CommonPrefixes']) > 5:
                        print(f"       ... and {len(sub_response['CommonPrefixes']) - 5} more")

                if 'Contents' in sub_response:
                    print(f"     Sample files ({len(sub_response['Contents'])} files):")
                    for obj in sub_response['Contents'][:3]:
                        file_name = obj['Key'].split('/')[-1]
                        size_mb = obj['Size'] / (1024 * 1024)
                        print(f"       - {file_name} ({size_mb:.2f} MB)")

            except Exception as e:
                print(f"     (Unable to peek inside: {str(e)[:50]}...)")

            print()

    if 'Contents' in response:
        print("\n📄 Root-level files:")
        for obj in response['Contents']:
            size_mb = obj['Size'] / (1024 * 1024)
            print(f"  - {obj['Key']} ({size_mb:.2f} MB)")

    # Try specific common Polygon directories
    print("\n" + "=" * 80)
    print("🔍 Checking for common Polygon dataset types...")
    print("-" * 80)

    common_prefixes = [
        'us_stocks_sip/trades_v1/',
        'us_stocks_sip/quotes_v1/',
        'us_stocks_sip/day_aggs_v1/',
        'us_stocks_sip/minute_aggs_v1/',
        'us_options_opra/trades_v1/',
        'stocks/',
        'options/',
        'forex/',
        'crypto/'
    ]

    for prefix in common_prefixes:
        try:
            check = s3_client.list_objects_v2(
                Bucket=S3_BUCKET_NAME,
                Prefix=prefix,
                MaxKeys=1
            )

            if 'Contents' in check or 'CommonPrefixes' in check:
                print(f"  ✅ {prefix} - EXISTS")
            else:
                print(f"  ❌ {prefix} - Not found")
        except Exception as e:
            print(f"  ❌ {prefix} - Error: {str(e)[:50]}")

    print("\n" + "=" * 80)
    print("✨ Exploration complete!")
    print("=" * 80)

except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    print("\nThis could mean:")
    print("  1. Your API key doesn't have flat file access")
    print("  2. Invalid credentials")
    print("  3. Network connectivity issue")
    print("  4. Your Polygon plan doesn't include flat files")

    print("\n💡 Tip: Flat file access requires a Business or Enterprise plan with Polygon")
