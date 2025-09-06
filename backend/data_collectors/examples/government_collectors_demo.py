"""
Government Data Collectors Usage Examples

This script demonstrates how to use all government data collectors
to gather comprehensive financial and economic data for analysis.

Government sources covered:
- SEC EDGAR: Company filings and financial statements
- FRED: Economic indicators and monetary data
- Treasury Direct: Treasury securities and bond data

All examples include error handling, rate limiting, and data validation.
"""

import os
import sys
import pandas as pd
from datetime import date, timedelta
import logging

# Add parent directories to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from government import SECEdgarCollector, FREDCollector, TreasuryDirectCollector
from base import CollectorConfig, DateRange, DataFrequency
from config_example import get_config_for_collector, DATE_RANGES, SYMBOL_LISTS

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def demo_sec_edgar_collector():
    """Demonstrate SEC EDGAR collector capabilities."""
    print("\n" + "="*60)
    print("SEC EDGAR COLLECTOR DEMO")
    print("="*60)
    
    # Initialize collector (no API key required)
    config = get_config_for_collector("sec_edgar", "dev")
    collector = SECEdgarCollector(config)
    
    # Test authentication/connection
    print("\n1. Testing SEC EDGAR connection...")
    if collector.authenticate():
        print("✅ Successfully connected to SEC EDGAR API")
        
        # Get connection details
        connection_info = collector.test_connection()
        print(f"   Response time: {connection_info['response_time_ms']:.2f}ms")
        print(f"   Rate limit status: {collector.get_rate_limits()['can_proceed']}")
    else:
        print("❌ Failed to connect to SEC EDGAR API")
        return
    
    # Get company facts for major tech companies
    print("\n2. Getting company financial facts...")
    tech_stocks = ["AAPL", "MSFT", "GOOGL"]
    
    for symbol in tech_stocks:
        print(f"\n   Getting facts for {symbol}...")
        try:
            facts = collector.get_company_facts(symbol)
            if facts:
                print(f"   ✅ Retrieved data for {facts.get('entityName', symbol)}")
                print(f"      CIK: {facts.get('cik', 'N/A')}")
                print(f"      Available facts: {len(facts.get('facts', {}).get('us-gaap', {}))}")
            else:
                print(f"   ❌ No data found for {symbol}")
        except Exception as e:
            print(f"   ❌ Error getting facts for {symbol}: {e}")
    
    # Get recent filings
    print("\n3. Getting recent company filings...")
    date_range = DATE_RANGES["last_month"]
    
    try:
        filings_data = collector.collect_batch(
            symbols=["AAPL"],
            date_range=date_range,
            data_type="filings"
        )
        
        if not filings_data.empty:
            print(f"   ✅ Found {len(filings_data)} recent filings for AAPL")
            print(f"   Recent filing types: {filings_data['form_type'].value_counts().head().to_dict()}")
        else:
            print("   ❌ No recent filings found")
            
    except Exception as e:
        print(f"   ❌ Error getting filings: {e}")
    
    # Test symbol validation
    print("\n4. Validating symbols...")
    test_symbols = ["AAPL", "INVALID_SYMBOL", "MSFT", "XYZ123"]
    validation_results = collector.validate_symbols(test_symbols)
    
    for symbol, is_valid in validation_results.items():
        status = "✅ Valid" if is_valid else "❌ Invalid"
        print(f"   {symbol}: {status}")


def demo_fred_collector():
    """Demonstrate FRED collector capabilities."""
    print("\n" + "="*60)
    print("FRED COLLECTOR DEMO")
    print("="*60)
    
    # Check if API key is available
    api_key = os.getenv("FRED_API_KEY")
    if not api_key:
        print("❌ FRED_API_KEY not found in environment variables")
        print("   Get a free API key at: https://fred.stlouisfed.org/docs/api/api_key.html")
        print("   Then set FRED_API_KEY in your .env file")
        return
    
    # Initialize collector
    config = get_config_for_collector("fred", "dev")
    config.api_key = api_key
    collector = FREDCollector(config)
    
    # Test authentication
    print("\n1. Testing FRED API connection...")
    if collector.authenticate():
        print("✅ Successfully connected to FRED API")
        
        connection_info = collector.test_connection()
        print(f"   Response time: {connection_info['response_time_ms']:.2f}ms")
        print(f"   API key valid: {connection_info.get('api_key_valid', True)}")
    else:
        print("❌ Failed to authenticate with FRED API")
        return
    
    # Get popular economic indicators
    print("\n2. Getting popular economic indicators...")
    popular_indicators = collector.get_popular_indicators()
    
    for series_id, description in list(popular_indicators.items())[:5]:
        print(f"   {series_id}: {description}")
    
    # Get economic data
    print("\n3. Collecting economic time series data...")
    economic_symbols = SYMBOL_LISTS["fred_economic_indicators"][:3]  # First 3 indicators
    date_range = DATE_RANGES["last_year"]
    
    try:
        economic_data = collector.collect_batch(
            symbols=economic_symbols,
            date_range=date_range,
            frequency=DataFrequency.MONTHLY,
            data_type="series"
        )
        
        if not economic_data.empty:
            print(f"   ✅ Collected {len(economic_data)} economic data points")
            print(f"   Series collected: {economic_data['series_id'].unique().tolist()}")
            print(f"   Date range: {economic_data.index.min()} to {economic_data.index.max()}")
        else:
            print("   ❌ No economic data collected")
            
    except Exception as e:
        print(f"   ❌ Error collecting economic data: {e}")
    
    # Get latest observations
    print("\n4. Getting latest economic observations...")
    for series_id in ["UNRATE", "FEDFUNDS", "GDP"]:  # Unemployment, Fed Funds, GDP
        try:
            latest = collector.get_latest_observation(series_id)
            if latest:
                print(f"   {series_id}: {latest.get('value', 'N/A')} ({latest.get('date', 'N/A')})")
            else:
                print(f"   {series_id}: No data available")
        except Exception as e:
            print(f"   {series_id}: Error - {e}")
    
    # Search for series
    print("\n5. Searching FRED database...")
    search_results = collector.search_series("unemployment rate", limit=3)
    
    if search_results:
        print(f"   Found {len(search_results)} series matching 'unemployment rate':")
        for series in search_results:
            print(f"   - {series.get('id', 'N/A')}: {series.get('title', 'N/A')}")
    else:
        print("   No search results found")
    
    # NEW: Get recent updates
    print("\n6. Getting recently updated economic series...")
    try:
        recent_updates = collector.get_series_updates(limit=5)
        if recent_updates:
            print(f"   ✅ Found {len(recent_updates)} recently updated series:")
            for series in recent_updates:
                print(f"   - {series.get('id', 'N/A')}: {series.get('title', 'N/A')[:60]}...")
                print(f"     Last updated: {series.get('last_updated', 'N/A')}")
        else:
            print("   ❌ No recent updates found")
    except Exception as e:
        print(f"   ❌ Error getting updates: {e}")
    
    # NEW: Get economic releases
    print("\n7. Getting major economic data releases...")
    try:
        releases = collector.get_releases(limit=10)
        if releases:
            print(f"   ✅ Found {len(releases)} economic releases:")
            major_releases = ['Employment Situation', 'Gross Domestic Product', 'Consumer Price Index']
            for release in releases[:5]:
                release_name = release.get('name', 'N/A')
                if any(major in release_name for major in major_releases):
                    print(f"   📊 {release_name} (ID: {release.get('id', 'N/A')})")
        else:
            print("   ❌ No releases found")
    except Exception as e:
        print(f"   ❌ Error getting releases: {e}")
    
    # NEW: Get economic calendar
    print("\n8. Getting upcoming economic calendar...")
    try:
        calendar = collector.get_economic_calendar(days_ahead=14)
        if calendar:
            print(f"   ✅ Found {len(calendar)} upcoming economic releases:")
            for item in calendar[:3]:
                print(f"   📅 {item.get('date', 'N/A')}: {item.get('release_name', 'N/A')}")
        else:
            print("   ❌ No upcoming releases found")
    except Exception as e:
        print(f"   ❌ Error getting calendar: {e}")
    
    # NEW: Get key indicators dashboard
    print("\n9. Getting key indicators dashboard...")
    try:
        dashboard = collector.get_key_indicators_dashboard()
        if dashboard:
            print("   ✅ Key Economic Indicators Dashboard:")
            
            # Employment indicators
            employment = dashboard.get('employment', {})
            if employment:
                print("   📈 Employment:")
                for indicator, data in employment.items():
                    value = data.get('value', 'N/A')
                    date = data.get('date', 'N/A')
                    units = data.get('units', '')
                    print(f"      {indicator}: {value} {units} (as of {date})")
            
            # Inflation indicators  
            inflation = dashboard.get('inflation', {})
            if inflation:
                print("   💰 Inflation:")
                for indicator, data in inflation.items():
                    value = data.get('value', 'N/A')
                    date = data.get('date', 'N/A')
                    print(f"      {indicator}: {value}% (as of {date})")
                    
        else:
            print("   ❌ No dashboard data available")
    except Exception as e:
        print(f"   ❌ Error getting dashboard: {e}")
    
    # NEW: Advanced tag search
    print("\n10. Advanced series search by tags...")
    try:
        # Find employment-related series
        employment_series = collector.get_tags_series(['employment', 'monthly'], limit=3)
        if employment_series:
            print(f"   ✅ Found {len(employment_series)} employment series:")
            for series in employment_series:
                print(f"   - {series.get('id', 'N/A')}: {series.get('title', 'N/A')[:50]}...")
        else:
            print("   ❌ No employment series found by tags")
    except Exception as e:
        print(f"   ❌ Error with tag search: {e}")


def demo_treasury_direct_collector():
    """Demonstrate Treasury Direct collector capabilities."""
    print("\n" + "="*60)
    print("TREASURY DIRECT COLLECTOR DEMO")
    print("="*60)
    
    # Initialize collector (no API key required)
    config = get_config_for_collector("treasury_direct", "dev")
    collector = TreasuryDirectCollector(config)
    
    # Test connection
    print("\n1. Testing Treasury Direct API connection...")
    if collector.authenticate():
        print("✅ Successfully connected to Treasury Direct API")
        
        connection_info = collector.test_connection()
        print(f"   Response time: {connection_info['response_time_ms']:.2f}ms")
    else:
        print("❌ Failed to connect to Treasury Direct API")
        return
    
    # Get yield curve data
    print("\n2. Getting daily Treasury yield curve...")
    treasury_maturities = ["1 Mo", "3 Mo", "1 Yr", "10 Yr", "30 Yr"]
    date_range = DateRange(
        start_date=date.today() - timedelta(days=30),
        end_date=date.today()
    )
    
    try:
        yield_data = collector.collect_batch(
            symbols=treasury_maturities,
            date_range=date_range,
            data_type="daily_treasury_yield"
        )
        
        if not yield_data.empty:
            print(f"   ✅ Collected {len(yield_data)} yield observations")
            print(f"   Maturities: {yield_data['symbol'].unique().tolist()}")
            
            # Show latest yields
            print("\n   Latest Treasury yields:")
            latest_yields = yield_data.groupby('symbol').last()
            for maturity in treasury_maturities:
                if maturity in latest_yields.index:
                    yield_value = latest_yields.loc[maturity, 'value']
                    yield_date = latest_yields.loc[maturity, 'record_date']
                    print(f"   {maturity}: {yield_value}% (as of {yield_date})")
        else:
            print("   ❌ No yield curve data collected")
            
    except Exception as e:
        print(f"   ❌ Error collecting yield data: {e}")
    
    # Get latest yield curve
    print("\n3. Getting latest individual yields...")
    for maturity in ["10 Yr", "30 Yr"]:
        try:
            latest_yield = collector.get_latest_yield_curve(maturity)
            if latest_yield:
                print(f"   {maturity}: {latest_yield.get('value', 'N/A')}% "
                      f"(as of {latest_yield.get('record_date', 'N/A')})")
            else:
                print(f"   {maturity}: No data available")
        except Exception as e:
            print(f"   {maturity}: Error - {e}")
    
    # Get auction data
    print("\n4. Getting recent Treasury auction data...")
    try:
        auction_data = collector.get_auction_data(
            date_range=DATE_RANGES["last_month"],
            security_type="Bill"
        )
        
        if not auction_data.empty:
            print(f"   ✅ Found {len(auction_data)} recent Treasury bill auctions")
            if 'high_yield' in auction_data.columns:
                avg_yield = auction_data['high_yield'].mean()
                print(f"   Average high yield: {avg_yield:.3f}%")
        else:
            print("   ❌ No recent auction data found")
            
    except Exception as e:
        print(f"   ❌ Error getting auction data: {e}")
    
    # Validate Treasury symbols
    print("\n5. Validating Treasury symbols...")
    test_symbols = ["10 Yr", "Invalid Maturity", "bills", "30 Yr"]
    validation_results = collector.validate_symbols(test_symbols)
    
    for symbol, is_valid in validation_results.items():
        status = "✅ Valid" if is_valid else "❌ Invalid"
        print(f"   {symbol}: {status}")


def demo_combined_analysis():
    """Demonstrate combining data from multiple government sources."""
    print("\n" + "="*70)
    print("ENHANCED COMBINED GOVERNMENT DATA ANALYSIS DEMO")
    print("="*70)
    
    print("\nThis example shows how to combine data from all government sources")
    print("with the enhanced FRED capabilities for comprehensive analysis...")
    
    # Example analysis framework
    print("\n🔍 Enhanced Analysis Framework:")
    print("   1. SEC EDGAR: Get Apple's recent 10-Q filing for revenue data")
    print("   2. FRED Enhanced: Get economic dashboard + calendar + updates")  
    print("   3. Treasury: Get complete yield curve for risk assessment")
    print("   4. FRED Releases: Track upcoming economic events")
    print("   5. Combine: Multi-dimensional economic context analysis")
    
    print("\n📊 New Enhanced Analysis Capabilities:")
    print("   • Real-time economic indicator dashboard")
    print("   • Economic calendar for event-driven analysis")
    print("   • Recently updated series for fresh insights")
    print("   • Release tracking for earnings timing")
    print("   • Tag-based series discovery for sector analysis")
    print("   • Advanced fundamental analysis with macro context")
    
    print("\n🚀 Enhanced Implementation Patterns:")
    print("\n   📅 Economic Calendar Integration:")
    print("      • Track Fed meetings before earnings analysis")
    print("      • Monitor employment releases for consumer stocks")
    print("      • Watch GDP releases for cyclical sectors")
    
    print("\n   📊 Dashboard-Driven Analysis:")
    print("      • Employment trends → Consumer discretionary stocks")
    print("      • Inflation indicators → Interest rate sensitive sectors")
    print("      • International rates → Export-dependent companies")
    
    print("\n   🔍 Advanced Discovery:")
    print("      • Find all housing-related indicators by tags")
    print("      • Get complete employment release dataset")
    print("      • Track recently updated international series")
    
    print("\n   ⚡ Real-time Integration:")
    print("      • Monitor FRED updates for fresh data")
    print("      • Combine with SEC filing alerts")
    print("      • Cross-reference with Treasury yield changes")
    
    print("\n💡 Pro Implementation Tips:")
    print("   • Use FRED dashboard for daily market context")
    print("   • Set up economic calendar alerts for key releases")
    print("   • Cache government data but refresh on updates")
    print("   • Combine recent updates with company filings")
    print("   • Use tag search for dynamic sector analysis")
    print("   • Track release series for complete datasets")
    
    print("\n🎯 Example Advanced Workflows:")
    print("\n   Workflow 1: Event-Driven Analysis")
    print("      → Check economic calendar")
    print("      → Get pre-release series data") 
    print("      → Identify affected sectors")
    print("      → Pull related company filings")
    print("      → Calculate risk-adjusted returns")
    
    print("\n   Workflow 2: Sector Deep Dive")
    print("      → Use tags to find all housing indicators")
    print("      → Get complete housing release datasets") 
    print("      → Pull housing-related company filings")
    print("      → Analyze Treasury curve impact")
    print("      → Generate sector outlook report")
    
    print("\n   Workflow 3: Market Timing")
    print("      → Monitor recent FRED updates")
    print("      → Track key indicator changes")
    print("      → Check upcoming release calendar")
    print("      → Analyze historical market reactions")
    print("      → Position for economic announcements")
    
    print(f"\n✨ With {len(['series', 'observations', 'series_info', 'series_search', 'series_updates', 'releases', 'release_info', 'release_series', 'release_dates', 'categories', 'category_series', 'sources', 'tags', 'tags_series', 'series_tags', 'economic_calendar', 'dashboard'])} FRED data types available,")
    print("   the possibilities for sophisticated financial analysis are endless!")


def main():
    """Run all government collector demos."""
    print("FINANCIAL DATA COLLECTORS - GOVERNMENT SOURCES DEMO")
    print("=" * 70)
    print("\nThis demo shows how to collect data from official government sources:")
    print("• SEC EDGAR - Public company filings (FREE)")
    print("• FRED - Economic data (FREE with registration)")  
    print("• Treasury Direct - Treasury securities data (FREE)")
    
    try:
        # Run individual demos
        demo_sec_edgar_collector()
        demo_fred_collector()
        demo_treasury_direct_collector()
        demo_combined_analysis()
        
        print("\n" + "="*70)
        print("✅ DEMO COMPLETED SUCCESSFULLY")
        print("="*70)
        print("\nNext steps:")
        print("1. Set up FRED API key for full FRED functionality")
        print("2. Explore the test suite to see more detailed examples")
        print("3. Check the documentation for advanced usage patterns")
        print("4. Consider adding market data collectors for complete coverage")
        
    except KeyboardInterrupt:
        print("\n\n❌ Demo interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Demo failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()