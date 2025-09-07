#!/usr/bin/env python3
"""
Complete FRED Collector Demo with Output Samples
Runs all FRED collector capabilities and saves sample outputs to documentation.
"""

import os
import json
import requests
from datetime import datetime, date, timedelta
from pathlib import Path

# Create output directory
OUTPUT_DIR = Path("docs/project/test_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# FRED API configuration
FRED_API_KEY = "e093a281de7f0d224ed51ad0842fc393"
BASE_URL = "https://api.stlouisfed.org/fred"

def safe_request(url, params, description):
    """Make a safe API request with error handling."""
    try:
        response = requests.get(url, params=params, timeout=15)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ {description}: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ {description}: {e}")
        return None

def save_sample_output(filename, data, description):
    """Save sample data to output directory."""
    filepath = OUTPUT_DIR / filename
    
    # Create a documentation-friendly format
    output = {
        "description": description,
        "timestamp": datetime.now().isoformat(),
        "sample_data": data,
        "data_type": "FRED Economic Data",
        "source": "Federal Reserve Bank of St. Louis"
    }
    
    with open(filepath, 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"✅ Saved: {filename}")

def demo_basic_series_data():
    """Test basic series data retrieval."""
    print("\n📊 1. Testing Basic Series Data...")
    print("-" * 40)
    
    # Popular economic indicators
    indicators = {
        "UNRATE": "Unemployment Rate",
        "FEDFUNDS": "Federal Funds Rate",
        "GDP": "Gross Domestic Product", 
        "CPIAUCSL": "Consumer Price Index",
        "DGS10": "10-Year Treasury Rate"
    }
    
    all_series_data = {}
    
    for series_id, description in indicators.items():
        params = {
            'api_key': FRED_API_KEY,
            'file_type': 'json',
            'series_id': series_id,
            'limit': 12,  # Last 12 observations
            'sort_order': 'desc'
        }
        
        url = f"{BASE_URL}/series/observations"
        data = safe_request(url, params, f"Getting {series_id}")
        
        if data and data.get('observations'):
            latest_obs = data['observations'][0]
            all_series_data[series_id] = {
                "description": description,
                "latest_value": latest_obs.get('value'),
                "latest_date": latest_obs.get('date'),
                "recent_observations": data['observations'][:6],
                "units": data.get('units', 'Unknown'),
                "frequency": data.get('frequency', 'Unknown')
            }
            
            print(f"✅ {series_id}: {latest_obs.get('value')} ({latest_obs.get('date')})")
        else:
            print(f"❌ {series_id}: No data retrieved")
    
    save_sample_output(
        "basic_series_data.json",
        all_series_data,
        "Basic economic indicators with latest values and recent historical data"
    )

def demo_series_updates():
    """Test recently updated series."""
    print("\n🔄 2. Testing Recently Updated Series...")
    print("-" * 40)
    
    params = {
        'api_key': FRED_API_KEY,
        'file_type': 'json',
        'limit': 10,
        'offset': 0
    }
    
    url = f"{BASE_URL}/series/updates"
    data = safe_request(url, params, "Getting series updates")
    
    if data and data.get('seriess'):
        updates_data = {
            "total_updates": len(data['seriess']),
            "recent_updates": []
        }
        
        for series in data['seriess'][:5]:
            series_info = {
                "id": series.get('id'),
                "title": series.get('title'),
                "last_updated": series.get('last_updated'),
                "frequency": series.get('frequency'),
                "units": series.get('units')
            }
            updates_data["recent_updates"].append(series_info)
            print(f"✅ {series.get('id')}: {series.get('title')[:50]}...")
        
        save_sample_output(
            "series_updates.json",
            updates_data,
            "Recently updated economic series from FRED database"
        )
    else:
        print("❌ No series updates retrieved")

def demo_economic_releases():
    """Test economic releases catalog."""
    print("\n📋 3. Testing Economic Releases...")
    print("-" * 40)
    
    params = {
        'api_key': FRED_API_KEY,
        'file_type': 'json',
        'limit': 20
    }
    
    url = f"{BASE_URL}/releases"
    data = safe_request(url, params, "Getting economic releases")
    
    if data and data.get('releases'):
        releases_data = {
            "total_releases": len(data['releases']),
            "major_releases": []
        }
        
        # Focus on major economic releases
        major_keywords = ['Employment', 'GDP', 'Consumer Price', 'Retail', 'Industrial', 'Housing']
        
        for release in data['releases']:
            release_name = release.get('name', '')
            if any(keyword in release_name for keyword in major_keywords):
                release_info = {
                    "id": release.get('id'),
                    "name": release_name,
                    "press_release": release.get('press_release', False),
                    "link": release.get('link', '')
                }
                releases_data["major_releases"].append(release_info)
                print(f"✅ {release_name}")
        
        save_sample_output(
            "economic_releases.json",
            releases_data,
            "Major economic data releases tracked by FRED"
        )
    else:
        print("❌ No economic releases retrieved")

def demo_series_search():
    """Test series search functionality."""
    print("\n🔍 4. Testing Series Search...")
    print("-" * 40)
    
    search_terms = ['unemployment', 'housing', 'inflation']
    all_search_results = {}
    
    for term in search_terms:
        params = {
            'api_key': FRED_API_KEY,
            'file_type': 'json',
            'search_text': term,
            'limit': 5
        }
        
        url = f"{BASE_URL}/series/search"
        data = safe_request(url, params, f"Searching for '{term}'")
        
        if data and data.get('seriess'):
            search_results = []
            for series in data['seriess']:
                series_info = {
                    "id": series.get('id'),
                    "title": series.get('title'),
                    "frequency": series.get('frequency'),
                    "units": series.get('units'),
                    "seasonal_adjustment": series.get('seasonal_adjustment')
                }
                search_results.append(series_info)
            
            all_search_results[term] = {
                "search_term": term,
                "total_found": data.get('count', 0),
                "sample_results": search_results
            }
            
            print(f"✅ '{term}': Found {data.get('count', 0)} series")
        else:
            print(f"❌ '{term}': No results found")
    
    save_sample_output(
        "series_search.json",
        all_search_results,
        "Search results for popular economic topics in FRED database"
    )

def demo_tags_and_categories():
    """Test tags and categories functionality."""
    print("\n🏷️ 5. Testing Tags and Categories...")
    print("-" * 40)
    
    # Get popular tags
    params = {
        'api_key': FRED_API_KEY,
        'file_type': 'json',
        'limit': 20,
        'order_by': 'popularity',
        'sort_order': 'desc'
    }
    
    url = f"{BASE_URL}/tags"
    tags_data = safe_request(url, params, "Getting popular tags")
    
    tags_output = {}
    
    if tags_data and tags_data.get('tags'):
        popular_tags = []
        for tag in tags_data['tags'][:10]:
            tag_info = {
                "name": tag.get('name'),
                "group_id": tag.get('group_id'),
                "popularity": tag.get('popularity', 0)
            }
            popular_tags.append(tag_info)
        
        tags_output["popular_tags"] = popular_tags
        print(f"✅ Retrieved {len(popular_tags)} popular tags")
    
    # Get categories
    params = {
        'api_key': FRED_API_KEY,
        'file_type': 'json',
        'category_id': 0  # Root category
    }
    
    url = f"{BASE_URL}/category/children"
    categories_data = safe_request(url, params, "Getting root categories")
    
    if categories_data and categories_data.get('categories'):
        root_categories = []
        for category in categories_data['categories'][:10]:
            cat_info = {
                "id": category.get('id'),
                "name": category.get('name'),
                "parent_id": category.get('parent_id')
            }
            root_categories.append(cat_info)
        
        tags_output["root_categories"] = root_categories
        print(f"✅ Retrieved {len(root_categories)} root categories")
    
    save_sample_output(
        "tags_and_categories.json",
        tags_output,
        "Popular tags and root categories for organizing FRED data"
    )

def demo_comprehensive_dashboard():
    """Create a comprehensive economic dashboard."""
    print("\n📊 6. Creating Economic Dashboard...")
    print("-" * 40)
    
    # Key indicators for different economic sectors
    dashboard_indicators = {
        "Employment": ["UNRATE", "PAYEMS", "CIVPART"],
        "Inflation": ["CPIAUCSL", "CPILFESL", "PPIFIS"],  
        "Interest_Rates": ["FEDFUNDS", "DGS10", "DGS30"],
        "Economic_Growth": ["GDP", "INDPRO", "RSAFS"],
        "Housing": ["HOUST", "HSNGMI", "MORTGAGE30US"],
        "International": ["DEXUSEU", "DEXJPUS", "DEXCHUS"]
    }
    
    dashboard_data = {}
    
    for sector, indicators in dashboard_indicators.items():
        sector_data = {}
        
        for indicator in indicators:
            params = {
                'api_key': FRED_API_KEY,
                'file_type': 'json',
                'series_id': indicator,
                'limit': 1,
                'sort_order': 'desc'
            }
            
            url = f"{BASE_URL}/series/observations"
            data = safe_request(url, params, f"Getting {indicator}")
            
            if data and data.get('observations'):
                obs = data['observations'][0]
                sector_data[indicator] = {
                    "value": obs.get('value'),
                    "date": obs.get('date'),
                    "description": f"Latest {indicator} data"
                }
                print(f"✅ {sector}/{indicator}: {obs.get('value')} ({obs.get('date')})")
            else:
                print(f"❌ {sector}/{indicator}: No data")
        
        if sector_data:
            dashboard_data[sector] = sector_data
    
    save_sample_output(
        "economic_dashboard.json",
        dashboard_data,
        "Comprehensive economic dashboard with key indicators by sector"
    )

def demo_historical_analysis():
    """Get historical data for trend analysis."""
    print("\n📈 7. Creating Historical Analysis Sample...")
    print("-" * 40)
    
    # Get 2 years of monthly data for key indicators
    end_date = date.today()
    start_date = end_date - timedelta(days=730)  # ~2 years
    
    key_indicators = {
        "UNRATE": "Unemployment Rate",
        "CPIAUCSL": "Consumer Price Index", 
        "FEDFUNDS": "Federal Funds Rate"
    }
    
    historical_data = {}
    
    for series_id, description in key_indicators.items():
        params = {
            'api_key': FRED_API_KEY,
            'file_type': 'json',
            'series_id': series_id,
            'observation_start': start_date.strftime('%Y-%m-%d'),
            'observation_end': end_date.strftime('%Y-%m-%d'),
            'frequency': 'm',  # Monthly
            'sort_order': 'asc'
        }
        
        url = f"{BASE_URL}/series/observations"
        data = safe_request(url, params, f"Getting historical {series_id}")
        
        if data and data.get('observations'):
            # Calculate some basic statistics
            values = [float(obs['value']) for obs in data['observations'] if obs['value'] != '.']
            
            if values:
                historical_data[series_id] = {
                    "description": description,
                    "observations": data['observations'][-12:],  # Last 12 months
                    "statistics": {
                        "current": values[-1] if values else None,
                        "min": min(values),
                        "max": max(values),
                        "average": sum(values) / len(values),
                        "trend": "Rising" if values[-1] > values[0] else "Falling"
                    },
                    "data_points": len(values)
                }
                print(f"✅ {series_id}: {len(values)} data points collected")
            else:
                print(f"❌ {series_id}: No valid values found")
        else:
            print(f"❌ {series_id}: No historical data")
    
    save_sample_output(
        "historical_analysis.json",
        historical_data,
        "Historical analysis with trends and statistics for key economic indicators"
    )

def create_documentation_index():
    """Create an index of all generated samples."""
    print("\n📚 8. Creating Documentation Index...")
    print("-" * 40)
    
    index_data = {
        "generated_at": datetime.now().isoformat(),
        "description": "FRED Economic Data Collector - Sample Outputs",
        "total_files": 0,
        "files": {}
    }
    
    # Scan output directory for generated files
    for file_path in OUTPUT_DIR.glob("*.json"):
        if file_path.name != "index.json":  # Don't include the index itself
            try:
                with open(file_path, 'r') as f:
                    file_data = json.load(f)
                
                index_data["files"][file_path.name] = {
                    "description": file_data.get("description", "No description"),
                    "timestamp": file_data.get("timestamp", "Unknown"),
                    "data_type": file_data.get("data_type", "Unknown")
                }
                index_data["total_files"] += 1
                
            except Exception as e:
                print(f"❌ Error reading {file_path.name}: {e}")
    
    # Save index
    with open(OUTPUT_DIR / "index.json", 'w') as f:
        json.dump(index_data, f, indent=2, default=str)
    
    print(f"✅ Created index with {index_data['total_files']} sample files")

def main():
    """Run complete FRED demo and generate sample outputs."""
    print("🏛️  FRED COLLECTOR - COMPLETE DEMO WITH SAMPLE OUTPUTS")
    print("=" * 65)
    print(f"Output directory: {OUTPUT_DIR.absolute()}")
    print("=" * 65)
    
    try:
        # Run all demo functions
        demo_basic_series_data()
        demo_series_updates()
        demo_economic_releases()
        demo_series_search()
        demo_tags_and_categories()
        demo_comprehensive_dashboard()
        demo_historical_analysis()
        create_documentation_index()
        
        print("\n" + "=" * 65)
        print("🎉 COMPLETE DEMO FINISHED SUCCESSFULLY!")
        print("=" * 65)
        print(f"📁 Sample outputs saved to: {OUTPUT_DIR.absolute()}")
        print("🔍 Check index.json for a complete file listing")
        print("📚 Use these samples for documentation and help pages")
        print("🚀 All FRED collector capabilities have been demonstrated!")
        
    except KeyboardInterrupt:
        print("\n\n❌ Demo interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Demo failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()