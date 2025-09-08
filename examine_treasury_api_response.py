#!/usr/bin/env python3
"""
Examine Treasury Fiscal Data API Response Structure

This script examines the actual response structure from the Treasury API
to ensure our yield curve analysis is using the correct field mappings.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from pprint import pprint

async def examine_treasury_api():
    """Examine the Treasury API response structure in detail."""
    print("🔍 EXAMINING TREASURY FISCAL DATA API RESPONSE")
    print("=" * 70)
    
    # Working endpoint from our tests
    base_url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2"
    endpoint = "/accounting/od/avg_interest_rates"
    
    # Get recent data
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
    
    url = f"{base_url}{endpoint}"
    params = {
        'filter': f'record_date:gte:{start_date},record_date:lte:{end_date}',
        'sort': '-record_date',
        'page[size]': 10  # Get more records to analyze
    }
    
    headers = {
        'User-Agent': 'StockPicker-DataGov-MCP/1.0',
        'Accept': 'application/json'
    }
    
    print(f"📡 Request URL: {url}")
    print(f"📋 Parameters: {params}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                print(f"\n📊 Response Status: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    
                    print(f"\n🏗️ RESPONSE STRUCTURE:")
                    print(f"Top-level keys: {list(data.keys())}")
                    
                    if 'data' in data:
                        records = data['data']
                        print(f"📈 Records returned: {len(records)}")
                        
                        if records:
                            print(f"\n📋 SAMPLE RECORD STRUCTURE:")
                            sample_record = records[0]
                            print(f"Fields in record: {len(sample_record)}")
                            
                            for field, value in sample_record.items():
                                print(f"  • {field}: {value} ({type(value).__name__})")
                            
                            print(f"\n📊 ANALYZING INTEREST RATE DATA:")
                            
                            # Look for different security types
                            security_types = set()
                            rate_fields = set()
                            
                            for record in records[:5]:  # Check first 5 records
                                if 'security_type_desc' in record:
                                    security_types.add(record['security_type_desc'])
                                
                                # Find fields that might contain rates
                                for field, value in record.items():
                                    if 'rate' in field.lower() or 'yield' in field.lower():
                                        rate_fields.add(field)
                            
                            print(f"Security Types Found: {list(security_types)}")
                            print(f"Rate Fields Found: {list(rate_fields)}")
                            
                            # Group by security type
                            print(f"\n📈 RECORDS BY SECURITY TYPE:")
                            by_security_type = {}
                            for record in records[:10]:
                                sec_type = record.get('security_type_desc', 'Unknown')
                                if sec_type not in by_security_type:
                                    by_security_type[sec_type] = []
                                by_security_type[sec_type].append(record)
                            
                            for sec_type, type_records in by_security_type.items():
                                print(f"\n  🏛️ {sec_type}:")
                                for record in type_records[:2]:  # Show first 2 of each type
                                    rate = record.get('avg_interest_rate_amt', 'N/A')
                                    date = record.get('record_date', 'N/A')
                                    desc = record.get('security_desc', 'N/A')
                                    print(f"    📅 {date}: {desc} = {rate}%")
                    
                    # Check metadata
                    if 'meta' in data:
                        meta = data['meta']
                        print(f"\n📖 METADATA:")
                        print(f"  Total count: {meta.get('total-count', 'N/A')}")
                        print(f"  Total pages: {meta.get('total-pages', 'N/A')}")
                        print(f"  Links: {list(meta.get('links', {}).keys())}")
                    
                    # Save full response for analysis
                    with open('treasury_api_response_sample.json', 'w') as f:
                        json.dump(data, f, indent=2)
                    print(f"\n💾 Full response saved to: treasury_api_response_sample.json")
                    
                    return True
                    
                else:
                    error_text = await response.text()
                    print(f"❌ API Error: {response.status}")
                    print(f"Response: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"💥 Error: {e}")
        return False

async def analyze_yield_curve_mapping():
    """Analyze how to map Treasury data to yield curve points."""
    print(f"\n🔄 ANALYZING YIELD CURVE MAPPING")
    print("=" * 70)
    
    # This is what we need for yield curve analysis
    needed_maturities = [
        '1 Month', '3 Month', '6 Month', 
        '1 Year', '2 Year', '3 Year', '5 Year', 
        '7 Year', '10 Year', '20 Year', '30 Year'
    ]
    
    print(f"📏 Maturities needed for yield curve: {needed_maturities}")
    
    # Load the saved response to analyze
    try:
        with open('treasury_api_response_sample.json', 'r') as f:
            data = json.load(f)
        
        if 'data' in data and data['data']:
            print(f"\n🔍 MAPPING TREASURY DATA TO YIELD CURVE:")
            
            # Group by security description to find yield curve points
            by_description = {}
            for record in data['data']:
                desc = record.get('security_desc', 'Unknown')
                rate = record.get('avg_interest_rate_amt', 'N/A')
                date = record.get('record_date', 'N/A')
                
                if desc not in by_description:
                    by_description[desc] = []
                by_description[desc].append({'rate': rate, 'date': date})
            
            print(f"📊 Available Treasury Securities:")
            for desc in sorted(by_description.keys()):
                latest = by_description[desc][0] if by_description[desc] else {}
                print(f"  • {desc}: {latest.get('rate', 'N/A')}% ({latest.get('date', 'N/A')})")
            
            # Check if we can map to standard yield curve
            print(f"\n💡 YIELD CURVE MAPPING ANALYSIS:")
            found_mappings = []
            for needed in needed_maturities:
                for available in by_description.keys():
                    if needed.lower() in available.lower() or any(term in available.lower() for term in needed.lower().split()):
                        found_mappings.append((needed, available))
                        break
            
            print(f"✅ Found mappings: {len(found_mappings)}")
            for needed, available in found_mappings:
                print(f"  {needed} → {available}")
            
            missing = set(needed_maturities) - {mapping[0] for mapping in found_mappings}
            if missing:
                print(f"❌ Missing mappings: {list(missing)}")
    
    except FileNotFoundError:
        print(f"⚠️ No saved response file found. Run main analysis first.")

async def main():
    """Main analysis function."""
    success = await examine_treasury_api()
    
    if success:
        await analyze_yield_curve_mapping()
        
        print(f"\n🎯 RECOMMENDATIONS:")
        print(f"✅ Current API endpoint is working correctly")
        print(f"✅ No authentication required")
        print(f"✅ Data structure is well-documented")
        print(f"💡 Review the field mappings in _extract_rate() method")
        print(f"📊 Consider using security_desc field for maturity mapping")
    
    print(f"\n📋 ANALYSIS COMPLETE")

if __name__ == "__main__":
    asyncio.run(main())