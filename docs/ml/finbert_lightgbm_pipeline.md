# 🧠 FinBERT + LightGBM for Financial Price Prediction

**Generated:** 2025-10-09 20:23:15

---

## 🔧 Goal

Use **FinBERT** to extract sentiment features from financial news and feed them into a **LightGBM** model for stock price prediction.

You **do not need to retrain FinBERT** or use any local dataset generated manually.

---

## ✅ Summary

| Component | Purpose |
|----------|---------|
| **FinBERT** | Pre-trained financial sentiment model |
| **Polygon.io News API** | Source of financial news for your top100 stocks |
| **LightGBM** | Gradient boosting model trained on price features + sentiment |

---

## ✅ Pipeline Overview

```
News Text → Pre-trained FinBERT → Sentiment Scores → LightGBM → Price Prediction
```

### Step-by-step:

1. 🔍 **Extract news** via Polygon.io API  
2. 🧠 **Run pre-trained FinBERT** to get sentiment scores:
   - `finbert_positive`
   - `finbert_negative`
   - `finbert_neutral`
3. ➕ **Append these 3 scores** to your 43 existing numerical features
4. 🏁 **Train LightGBM** on the full set of 46 features

---

## ⚠️ Important Notes

- Do **not retrain** or fine-tune FinBERT unless you're adapting it to a radically different domain (e.g., crypto memes, Reddit).
- Use **FinBERT as a feature extractor only.**
- Your `top100` dataset should only serve as **input text** for FinBERT, not as training data for NLP.

---

## 🔒 No Local Dataset

> ❌ Do not use any dataset generated manually or locally  
> ✅ Use only **Polygon.io API** + **pre-trained FinBERT**

---

## 📤 Output

LightGBM will learn how sentiment + price features influence stock movement. No need to label sentiment or retrain FinBERT.

---

## ✅ What Claude Code Needs to Know

- Use **pre-trained FinBERT** as a black-box sentiment scorer
- Use only **API-fetched news data** (Polygon.io)
- Combine FinBERT scores with numerical features
- Train **LightGBM** using 46 features
- Avoid using manually-labeled or local NLP datasets

