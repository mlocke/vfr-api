# Smart-Money-Flow Model Plan

**Date:** 2025-10-12

## 🎯 Objective
Build a **Smart-Money-Flow Model** that tracks institutional behavior and other "smart money" signals to forecast stock market movements and identify accumulation/distribution phases.

---

## 📦 Data Inputs

| Signal Type              | Description                                               | Source (Free/Paid)                            |
|--------------------------|-----------------------------------------------------------|------------------------------------------------|
| Institutional Activity   | 13F filings from hedge funds/institutional investors      | ✅ [SEC EDGAR](https://www.sec.gov/edgar/)     |
| Insider Buying/Selling   | Form 4 filings from executives                            | ✅ [OpenInsider](https://openinsider.com/)     |
| News Sentiment           | Sentiment scoring of financial headlines                  | ✅ EODHD News + Sentiment API (Free Tier)      |
| Price & Volume Trends    | Historical OHLCV data for selected tickers                | ✅ EODHD EOD API (Free or Demo Key)            |
| ETF Rebalancing          | Sector rotation trends from ETF flows                     | ❌ Not available (Consider ETFdb API)          |
| Economic & Macro Events  | Fed policy, CPI, GDP, unemployment, etc.                  | ✅ [FRED API](https://fred.stlouisfed.org/)    |
| Congressional Trading    | US Congress stock trades (disclosures)                    | ✅ [QuiverQuant](https://www.quiverquant.com/) |

---

## 🧠 Model Structure

1. **Input Layer**  
   Collect raw data (daily or weekly) from each of the above sources.

2. **Feature Engineering**  
   - Institutional Accumulation Score (from 13F delta by ticker)
   - Insider Activity Index (net buy/sell Form 4s)
   - Congressional Trade Pressure (normalized trade size)
   - Sentiment Score (7-day MA)
   - Price Momentum, Volume Spikes (normalized)

3. **Data Normalization**  
   Scale all features to allow ML algorithms to converge better.

4. **Model Type**  
   Use ensemble methods (e.g. Random Forest, Gradient Boosting) or LSTM for time-series patterns.

5. **Output**  
   Daily or weekly Smart-Money-Flow Score per ticker or sector.

---

## 🔌 Data Collection Pipeline

### Phase 1: Symbol Universe

Use small universe of high-interest tickers:
- `AAPL`, `TSLA`, `MSFT`, `MCD`, `VTI` (supported by demo key in EODHD)

### Phase 2: Data Sources Setup

| Task                           | Source/API                  | Frequency     |
|--------------------------------|-----------------------------|---------------|
| Pull 13F Holdings              | SEC EDGAR HTML/CSV Scraper  | Quarterly     |
| Pull Congressional Trades      | QuiverQuant API             | Daily         |
| Pull Insider Trades (Form 4)   | OpenInsider Web Scraper     | Daily         |
| Pull Price/Volume/Sentiment    | EODHD API (Demo or Free)    | Daily         |
| Pull Macro Data (e.g., CPI)    | FRED API                    | Monthly       |

---

## 📂 Storage Format

- Store all datasets as CSV locally
- Use a database (e.g., SQLite or Postgres) for scaled use
- Maintain timestamped logs for data refresh

---

## 🛠 Tools & Stack

- **Languages:** Python (pandas, scikit-learn, requests, beautifulsoup)
- **Database:** SQLite (or cloud: Supabase/Firebase/Postgres)
- **Scheduler:** Cron or Prefect/Airflow for automation
- **Dashboard (Optional):** Streamlit or Dash for visualization

---

## 🚀 Milestones

1. ✅ Collect and store 1 month of data
2. ✅ Build feature engineering scripts
3. ⏳ Train & evaluate baseline model
4. ⏳ Backtest signal performance
5. ⏳ Publish dashboard or alerts

---

## 📌 Notes

- Avoid free-tier API exhaustion by prioritizing batch data pulls (e.g., EOD, QuiverQuant).
- For scaling, consider switching to EODHD paid tier or hosted datasets (Quandl, Intrinio).
- Do not include options data in this model (used in separate system).

