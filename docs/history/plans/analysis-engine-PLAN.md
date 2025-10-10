
# 🧠 Stock Analysis Engine — PLAN.md

**Author:** mlocke  
**Date:** 2025-10-06  
**Platform:** EODHD API (https://eodhd.com/)  
**API Key:** `68cf08e135b402.52970225`  

---

## ⚙️ 1. System Overview

The **Stock Analysis Engine** is a modular AI-driven financial analytics system integrating multiple predictive and analytical models:

1. **Early Signal Detection** – identifies abnormal activity and precursors to market movements.  
2. **Price Prediction** – forecasts near-term price direction and magnitude using historical data.  
3. **Sentiment Fusion Model (new)** – integrates market sentiment, news, and contextual macro indicators to enhance predictive accuracy.

These models feed into a final **Decision Layer** that produces a unified **confidence score** for each stock signal.

---

## 🧩 2. Data Architecture

### Core Data Inputs
| Source | Endpoint | Description |
|---------|-----------|-------------|
| **Market Prices** | `/api/eod/{TICKER}` | Historical OHLCV data (immutable). |
| **Live Prices** | `/api/real-time/{TICKER}` | Delayed live quotes for short-term confirmation. |
| **News** | `/api/news?s={TICKER}` | Historical and real-time financial news. |
| **Sentiment** | `/api/sentiments?s={TICKER}` | Aggregated sentiment polarity and volume. |
| **Options Data** | `/api/mp/unicornbay/options/eod` | Daily end-of-day options and implied volatility. |
| **Technical Indicators** | `/api/technical/{TICKER}` | Derived indicators (volatility, RSI, etc.). |
| **Dividends** | `/api/div/{TICKER}` | Dividend yields and history. |
| **Commodities** | `/api/commodities/{SYMBOL}` | Oil, gold, and other macro context data. |
| **CBOE Data** | `/api/cboe/{TICKER}` | Volatility index (VIX) and derivatives data. |
| **Exchanges** | `/api/exchanges-list` | Market metadata and trading hours. |

---

## 🧠 3. Model Architecture

### 3.1 Early Signal Detection
- Detects early signs of movement (spikes, order flow anomalies).  
- Input: Intraday + volume deltas.  
- Output: Binary probability of emerging signal.

### 3.2 Price Prediction Model
- Time-series regression or sequence model (LSTM/Transformer).  
- Input: Historical OHLCV + technical indicators.  
- Output: Predicted price or % change (1–5 day horizon).

### 3.3 Sentiment Fusion Model
- Integrates sentiment, volatility, and market psychology.  
- Output: Market context probability (Bullish/Neutral/Bearish).

#### Architecture
```
News API → NLP Embeddings (FinBERT/SBERT)
Sentiment API → Polarity Metrics
EOD Data → Returns/Volatility
Options API → Implied Volatility/Put-Call Ratio
Fusion → GRU / Transformer Encoder → Dense → Classifier Head
```

**Targets**
- Classification: {Bullish, Neutral, Bearish}
- Regression: 3–5 day % move magnitude

---

## 🧮 4. Feature Engineering

| Feature Group | Example Variables | Source |
|----------------|-------------------|---------|
| **Sentiment Metrics** | `avg_polarity_7d`, `neg/pos_ratio`, `news_volume` | `/sentiments` |
| **News Topics** | Keyword frequency, embedding clusters | `/news` |
| **Market Behavior** | `return_5d`, `volatility_10d`, `volume_delta` | `/eod`, `/technical` |
| **Options Context** | `implied_volatility`, `put_call_ratio` | `/mp/unicornbay/options/eod` |
| **Macro Regime** | `oil_price_change`, `VIX_level`, `USD_index` | `/commodities`, `/cboe` |

---

## 🔗 5. Endpoints Summary

| # | API | URL Template | Refresh Rate |
|---|-----|---------------|---------------|
| 1 | EOD Historical | `/api/eod/{TICKER}` | Daily (post-close) |
| 2 | Real-Time | `/api/real-time/{TICKER}` | Every 1–5 min |
| 3 | News | `/api/news?s={TICKER}` | Every 10–15 min |
| 4 | Sentiment | `/api/sentiments?s={TICKER}` | 1–3 hours |
| 5 | Options EOD | `/api/mp/unicornbay/options/eod` | Daily (post-close) |
| 6 | Options Contracts | `/api/mp/unicornbay/options/contracts` | Weekly |
| 7 | Technical Indicators | `/api/technical/{TICKER}` | Weekly |
| 8 | Dividends | `/api/div/{TICKER}` | Quarterly |
| 9 | Commodities | `/api/commodities/{SYMBOL}` | 1–3 days |
| 10 | CBOE | `/api/cboe/{TICKER}` | Daily |
| 11 | Exchanges List | `/api/exchanges-list` | Monthly |

---

## 🗃️ 6. Caching & Rate Limit Management

**Objective:** Avoid exceeding the 20-call/day free limit by caching immutable and slow-changing data.

| Endpoint | Cache Strategy | Cache Duration | Notes |
|-----------|----------------|----------------|-------|
| `/eod/{TICKER}` | File-based (Parquet/SQLite) | ♻️ Forever | Immutable historical data. |
| `/div/{TICKER}` | File-based | ♻️ Forever | Historical, static. |
| `/mp/unicornbay/options/eod` | Daily file cache | 1 day | Refresh after market close. |
| `/mp/unicornbay/options/contracts` | Memory/disk | 7 days | Minimal changes weekly. |
| `/sentiments` | JSON cache | 1–7 days | Aggregated, rarely updates intraday. |
| `/news` | In-memory cache | 10–15 min | Rapid updates; cache for deduplication. |
| `/commodities` | Disk cache | 1–3 days | Daily updates. |
| `/cboe` | Disk cache | 1–3 days | Daily close updates. |
| `/exchanges-list` | Disk cache | 30 days | Metadata, static. |
| `/real-time/{TICKER}` | No cache (short TTL) | 1–5 min | Near-live data only. |

**Recommended Tools:**
- Persistent cache: `SQLite` or `DuckDB`  
- Short-term cache: `Redis`, `joblib.Memory`  
- Scheduler: `apscheduler`, `Prefect`, or `Airflow`

---

## 🧰 7. Implementation Stack

| Layer | Tools / Libraries | Purpose |
|-------|--------------------|----------|
| **Data Access** | `requests`, `aiohttp`, `pandas` | API calls and parsing |
| **Caching** | `DuckDB`, `Redis`, `joblib`, `parquet` | Rate-limit control |
| **NLP / Sentiment** | `HuggingFace Transformers (FinBERT)`, `spaCy`, `nltk` | News text embeddings |
| **Modeling** | `PyTorch`, `TensorFlow`, `XGBoost`, `scikit-learn` | Predictive modeling |
| **Storage** | `AWS S3`, `SQLite`, or local FS | Historical data store |
| **Visualization** | `Plotly`, `Dash`, `Streamlit` | Analytics dashboards |
| **Automation** | `cron`, `Airflow`, `apscheduler` | Periodic updates |

---

## 📅 8. Smart Refresh Schedule

| Data Type | Refresh Cadence | Trigger |
|------------|----------------|----------|
| Historical OHLCV | Daily | 21:00 UTC (post-market) |
| Options & Volatility | Daily | Post-close (22:00 UTC) |
| News / Sentiment | Every 10–60 min | Business hours |
| Technical Indicators | Weekly | End of week |
| Dividends | Quarterly | Company reports |
| Exchange / Metadata | Monthly | Manual check |

---

## 🧠 9. Training & Evaluation

| Model | Target Variable | Evaluation Metric | Update Frequency |
|--------|------------------|-------------------|------------------|
| Early Signal Detection | Binary signal | F1, Precision | Weekly retrain |
| Price Prediction | % price change | RMSE, R² | Weekly |
| Sentiment Fusion | Trend class / % move | AUC, Accuracy, MAE | Daily incremental |

---

## 🔒 10. Rate Limit Strategy (Free Tier)

- Daily limit: 20 API calls (core) + 100k (marketplace).  
- Each `/intraday` request = 5 API calls.  
- With caching, target ≤ 5 calls/day average.  
- Always batch tickers into single requests where supported (e.g., `s=AAPL.US,MSFT.US`).

---

## 📈 11. Scalability Plan

- Move caching to **Redis** or **PostgreSQL JSONB** for multiple concurrent models.  
- Deploy models as microservices via **FastAPI**.  
- Store logs and usage metrics for audit.  
- Use **message queues (Kafka/RabbitMQ)** to decouple data ingestion and model inference.

---

## 🧭 12. Future Enhancements

| Area | Enhancement |
|------|--------------|
| **Modeling** | Add Volatility Forecasting and Regime Detection models. |
| **Data** | Integrate ESG and insider trading data feeds. |
| **Automation** | Add backtesting & alert system via WebSocket or Telegram bot. |
| **UX** | Streamlit dashboard for interactive sentiment/price charts. |

---

## ✅ Summary

This plan defines:
- The **core endpoints** used across all models.  
- A **complete caching & refresh strategy** to prevent rate limiting.  
- The **data and model architecture** for integrating the new Sentiment Fusion model.  
- A clear path toward **scalable, production-grade deployment**.
