#!/bin/bash
#
# Download Kaggle Financial Datasets
# Usage: ./download-kaggle-datasets.sh
#

set -e

echo "=================================================="
echo "KAGGLE DATASET DOWNLOADER FOR FINANCIAL DATA"
echo "=================================================="
echo ""

# Create datasets directory
mkdir -p datasets/kaggle
cd datasets/kaggle

echo "📊 Downloading Financial Datasets..."
echo ""

# 1. Massive Stock Market Data (NASDAQ, NYSE, S&P500)
echo "1️⃣  Stock Market Data (NASDAQ, NYSE, S&P500) - 1.1GB"
echo "    Downloaded 21,211 times, 373 votes"
kaggle datasets download -d paultimothymooney/stock-market-data
unzip -q stock-market-data.zip -d stock-market-data && rm stock-market-data.zip
echo "    ✅ Downloaded to: datasets/kaggle/stock-market-data/"
echo ""

# 2. S&P 500 Companies with Financial Information
echo "2️⃣  S&P 500 Companies with Financial Information - 30KB"
echo "    Downloaded 7,517 times, 81 votes"
kaggle datasets download -d paytonfisher/sp-500-companies-with-financial-information
unzip -q sp-500-companies-with-financial-information.zip -d sp500-financials && rm sp-500-companies-with-financial-information.zip
echo "    ✅ Downloaded to: datasets/kaggle/sp500-financials/"
echo ""

# 3. 200+ Financial Indicators
echo "3️⃣  200+ Financial Indicators of US Stocks (2014-2018) - 15MB"
echo "    Downloaded 18,730 times, 293 votes"
kaggle datasets download -d cnic92/200-financial-indicators-of-us-stocks-20142018
unzip -q 200-financial-indicators-of-us-stocks-20142018.zip -d financial-indicators && rm 200-financial-indicators-of-us-stocks-20142018.zip
echo "    ✅ Downloaded to: datasets/kaggle/financial-indicators/"
echo ""

# 4. World Stock Prices (Daily Updating)
echo "4️⃣  World Stock Prices (Daily Updating) - 12MB"
echo "    Downloaded 9,815 times, 151 votes"
kaggle datasets download -d nelgiriyewithana/world-stock-prices-daily-updating
unzip -q world-stock-prices-daily-updating.zip -d world-stock-prices && rm world-stock-prices-daily-updating.zip
echo "    ✅ Downloaded to: datasets/kaggle/world-stock-prices/"
echo ""

# 5. S&P 500 Stock Data
echo "5️⃣  S&P 500 Stock Data - 20MB"
echo "    Downloaded 98,571 times, 1,098 votes"
kaggle datasets download -d camnugent/sandp500
unzip -q sandp500.zip -d sandp500 && rm sandp500.zip
echo "    ✅ Downloaded to: datasets/kaggle/sandp500/"
echo ""

# 6. NSE Future and Options Data
echo "6️⃣  NSE Future and Options Data 2024 - 187MB"
echo "    Downloaded 676 times, 10 votes"
kaggle datasets download -d kaalicharan9080/nse-future-and-options-data
unzip -q nse-future-and-options-data.zip -d nse-options && rm nse-future-and-options-data.zip
echo "    ✅ Downloaded to: datasets/kaggle/nse-options/"
echo ""

# 7. Financial News Headlines
echo "7️⃣  Financial News Headlines Data - 4MB"
echo "    Downloaded 6,368 times, 48 votes"
kaggle datasets download -d notlucasp/financial-news-headlines
unzip -q financial-news-headlines.zip -d financial-news && rm financial-news-headlines.zip
echo "    ✅ Downloaded to: datasets/kaggle/financial-news/"
echo ""

# 8. NASDAQ Daily Stock Prices
echo "8️⃣  NASDAQ Daily Stock Prices - 112MB"
echo "    Downloaded 2,081 times, 43 votes (Updated: 2025-10-12)"
kaggle datasets download -d svaningelgem/nasdaq-daily-stock-prices
unzip -q nasdaq-daily-stock-prices.zip -d nasdaq-daily && rm nasdaq-daily-stock-prices.zip
echo "    ✅ Downloaded to: datasets/kaggle/nasdaq-daily/"
echo ""

echo ""
echo "=================================================="
echo "✨ All datasets downloaded successfully!"
echo "=================================================="
echo ""
echo "📂 Location: $(pwd)"
echo ""
echo "💡 Next steps:"
echo "  1. Explore CSV/Parquet files in each directory"
echo "  2. Import into your PostgreSQL database"
echo "  3. Build features for ML models"
echo "  4. Combine with Polygon API data"
echo ""
