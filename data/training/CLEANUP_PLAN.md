# Data/Training Directory Cleanup Plan

## Summary
- **Total files**: 238 CSV files
- **Checkpoints**: 188 files (~500 MB)
- **Files to delete**: 209 files
- **Files to keep**: 29 files
- **Space to free**: ~550 MB

---

## ✅ KEEP (29 files - Essential Production Data)

### Polygon News Datasets (2 files - 99 MB)
- `polygon_news_2023.csv` (59 MB) - 109,906 articles, 160 tickers
- `polygon_news_2024.csv` (40 MB) - 70,709 articles, 160 tickers
**Reason**: Primary news data for sentiment analysis

### Early Signal Detection (4 files - 500K)
- `production-dataset-v1.0.csv` (250K) - 1,051 rows, production dataset
- `train.csv` (200K) - Training split (841 rows)
- `val.csv` (26K) - Validation split (106 rows)
- `test.csv` (26K) - Test split (107 rows)
**Reason**: Used to train Early Signal Model v1.0.0 (93.3% accuracy)

### Price Prediction (4 files - 33 MB)
- `price-prediction-yf-top100.csv` (33 MB) - Full dataset (73,200 rows)
- `price-train.csv` (23 MB) - Training split
- `price-val.csv` (4.8 MB) - Validation split
- `price-test.csv` (4.8 MB) - Test split
**Reason**: Used to train Price Prediction models v1.0.0-v1.2.0

### Combined FinBERT (4 files - 1.5 MB)
- `combined-finbert-price-features.csv` (758K) - Source dataset with FinBERT sentiment
- `combined-train.csv` (528K) - Training split (1,031 rows)
- `combined-val.csv` (114K) - Validation split (222 rows)
- `combined-test.csv` (114K) - Test split (222 rows)
**Reason**: Used to train Price Prediction Model v1.3.0 with sentiment

### Sentiment Fusion (4 files - 2 MB)
- `sentiment-fusion-training.csv` (1 MB) - Full dataset
- `sentiment-fusion-train.csv` (702K) - Training split
- `sentiment-fusion-val.csv` (152K) - Validation split
- `sentiment-fusion-test.csv` (151K) - Test split
**Reason**: Latest sentiment fusion dataset, ready for model training

---

## ❌ DELETE (209 files - ~550 MB)

### 1. Checkpoint Files (188 files - ~500 MB)
**Sentiment Fusion Checkpoints (178 files)**:
- `sentiment-fusion-checkpoint-50.csv` through `sentiment-fusion-checkpoint-8900.csv`
**Reason**: Already merged into final `sentiment-fusion-training.csv`

**Price Prediction Checkpoints (10 files)**:
- `price-prediction-yf-top100_checkpoint_20.csv` through `_checkpoint_100.csv`
**Reason**: Already merged into final `price-prediction-yf-top100.csv`

### 2. Test/POC Files (6 files - ~1 MB)
- `test_polygon_news_AAPL_2024.csv` - Test sample
- `test_polygon_news_TSLA_2024.csv` - Test sample
- `test_polygon_news_TSLA_2025_jan-sep.csv` - Test sample
- `price-prediction-poc.csv` - Proof of concept (only 70 rows)
- `test-fix-5stocks.csv` - Test file
- `test-fix.csv` - Test file
**Reason**: Test files, not production datasets

### 3. Superseded Early Signal Files (4 files - ~560K)
- `early-signal-v1.csv` (8.6K) - Superseded by production-dataset-v1.0
- `early-signal-v2.csv` (63K) - Superseded by production-dataset-v1.0
- `early-signal-v2-fixed-macro.csv` (250K) - Identical to production-dataset-v1.0
- `early-signal-combined-1051-v2.csv` (241K) - Superseded by production-dataset-v1.0
**Reason**: Older versions, production-dataset-v1.0 is the final version

### 4. Superseded Price Prediction Files (4 files - ~900K)
- `price-prediction-test.csv` (25K) - Early test dataset
- `price-prediction-top100.csv` (198K) - Superseded by yf-top100 version
- `price-prediction-with-sentiment-test.csv` (479K) - Test run
- `price-sentiment-test-test.csv` (72K) - Test split
- `price-sentiment-test-train.csv` (336K) - Test split
- `price-sentiment-test-val.csv` (72K) - Test split
**Reason**: Superseded by yf-top100 dataset and combined-finbert datasets

### 5. Old Sentiment Fusion Files (2 files - ~2.4 MB)
- `sentiment-fusion-training-old.csv` (1.4 MB) - Old version
- `sentiment-fusion-training-5pct.csv` (994K) - Partial 5% sample dataset
**Reason**: Superseded by current sentiment-fusion-training.csv

---

## Execution Plan

1. Delete all 188 checkpoint files
2. Delete 6 test/POC files
3. Delete 4 superseded early signal files
4. Delete 7 superseded price prediction files
5. Delete 2 old sentiment fusion files

**Total deletions**: 209 files
**Space freed**: ~550 MB
