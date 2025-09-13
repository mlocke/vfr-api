# Financial Analysis Engine Architecture and Implementation Guide

## Overview

This document outlines the complete architecture for building a financial analysis engine that processes data from MCP servers to generate intelligent stock predictions and recommendations. The engine serves as the "brain" of your financial research website, transforming raw market data into actionable investment insights.

## System Architecture

### Data Flow and Processing Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                    Financial Research Website                   │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React/Vue)                                           │
│  ├─ Stock Charts                                               │
│  ├─ Prediction Panels                                          │
│  └─ Recommendation Lists                                       │
├─────────────────────────────────────────────────────────────────┤
│  Analysis Engine (Your Backend)                                │
│  ├─ Sentiment Analysis Module                                  │
│  ├─ Technical Analysis Engine                                  │
│  ├─ Fundamental Analysis Module                                │
│  ├─ Prediction Engine                                          │
│  └─ Recommendation Generator                                   │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer (MCP Servers)                                      │
│  ├─ Alpha Vantage MCP (News, Sentiment, Indicators)           │
│  ├─ Polygon.io MCP (Real-time Prices, Low Latency)            │
│  └─ Financial Modeling Prep MCP (Financials, Fundamentals)    │
└─────────────────────────────────────────────────────────────────┘
```

## Core Analysis Modules

### 1. Sentiment Analysis Module

```python
import torch
from transformers import BertTokenizer, BertForSequenceClassification
import numpy as np
from datetime import datetime, timedelta

class SentimentAnalyzer:
    """
    Analyzes financial news sentiment using FinBERT and custom weighting algorithms
    """
    
    def __init__(self):
        self.tokenizer = BertTokenizer.from_pretrained('ProsusAI/finbert')
        self.model = BertForSequenceClassification.from_pretrained('ProsusAI/finbert')
        self.source_credibility = {
            'Reuters': 0.95,
            'Bloomberg': 0.95,
            'WSJ': 0.90,
            'CNBC': 0.85,
            'MarketWatch': 0.80,
            'Yahoo Finance': 0.75,
            'default': 0.70
        }
    
    def analyze_news_impact(self, news_articles, stock_ticker):
        """
        Takes raw news from MCP, returns weighted sentiment score
        
        Args:
            news_articles: List of news articles from MCP servers
            stock_ticker: Target stock symbol
            
        Returns:
            dict: Comprehensive sentiment analysis
        """
        if not news_articles:
            return {'overall_sentiment': 0.0, 'confidence': 0.0, 'article_count': 0}
        
        sentiments = []
        total_weight = 0
        
        for article in news_articles:
            # Analyze individual article
            sentiment_score = self._analyze_single_article(article.text)
            
            # Calculate weights
            source_weight = self.source_credibility.get(article.source, 0.70)
            recency_weight = self._calculate_recency_weight(article.published_date)
            relevance_weight = self._calculate_relevance_weight(article.text, stock_ticker)
            
            # Combined weight
            total_article_weight = source_weight * recency_weight * relevance_weight
            
            sentiments.append({
                'score': sentiment_score,
                'weight': total_article_weight,
                'article_id': article.id
            })
            total_weight += total_article_weight
        
        # Calculate weighted average sentiment
        if total_weight > 0:
            weighted_sentiment = sum(s['score'] * s['weight'] for s in sentiments) / total_weight
        else:
            weighted_sentiment = 0.0
        
        return {
            'overall_sentiment': weighted_sentiment,
            'confidence': min(total_weight / len(news_articles), 1.0),
            'article_count': len(news_articles),
            'sentiment_trend': self._calculate_sentiment_trend(sentiments),
            'detailed_scores': sentiments
        }
    
    def _analyze_single_article(self, text):
        """Analyze sentiment of a single article using FinBERT"""
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, 
                               padding=True, max_length=512)
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
        # Convert to sentiment score (-1 to 1)
        # FinBERT outputs: [negative, neutral, positive]
        neg, neu, pos = predictions[0].tolist()
        sentiment_score = pos - neg  # Range: -1 to 1
        
        return sentiment_score
    
    def _calculate_recency_weight(self, published_date):
        """Calculate weight based on article recency"""
        now = datetime.now()
        age_hours = (now - published_date).total_seconds() / 3600
        
        if age_hours < 1:
            return 1.0
        elif age_hours < 24:
            return 0.9
        elif age_hours < 72:
            return 0.7
        elif age_hours < 168:  # 1 week
            return 0.5
        else:
            return 0.3
    
    def _calculate_relevance_weight(self, text, ticker):
        """Calculate how relevant the article is to the specific stock"""
        ticker_mentions = text.lower().count(ticker.lower())
        company_name_mentions = self._count_company_mentions(text, ticker)
        
        relevance_score = min((ticker_mentions + company_name_mentions) * 0.2, 1.0)
        return max(relevance_score, 0.1)  # Minimum relevance
    
    def _calculate_sentiment_trend(self, sentiments):
        """Calculate if sentiment is improving or deteriorating"""
        if len(sentiments) < 2:
            return 0.0
        
        recent_sentiment = np.mean([s['score'] for s in sentiments[:len(sentiments)//2]])
        older_sentiment = np.mean([s['score'] for s in sentiments[len(sentiments)//2:]])
        
        return recent_sentiment - older_sentiment
```

### 2. Technical Analysis Engine

```python
import pandas as pd
import numpy as np
from scipy import stats
import talib

class TechnicalAnalyzer:
    """
    Comprehensive technical analysis engine for stock price patterns and indicators
    """
    
    def __init__(self):
        self.pattern_weights = {
            'strong_bullish': 0.8,
            'bullish': 0.6,
            'neutral': 0.0,
            'bearish': -0.6,
            'strong_bearish': -0.8
        }
    
    def analyze_technical_patterns(self, price_data):
        """
        Comprehensive technical analysis of price data
        
        Args:
            price_data: DataFrame with OHLCV data
            
        Returns:
            dict: Technical analysis results
        """
        df = pd.DataFrame(price_data)
        
        analysis = {
            'trend_analysis': self._analyze_trend(df),
            'support_resistance': self._find_support_resistance_levels(df),
            'pattern_recognition': self._detect_chart_patterns(df),
            'momentum_indicators': self._calculate_momentum_indicators(df),
            'volume_analysis': self._analyze_volume_patterns(df),
            'volatility_analysis': self._analyze_volatility(df),
            'overall_technical_score': 0.0
        }
        
        # Calculate overall technical score
        analysis['overall_technical_score'] = self._calculate_overall_score(analysis)
        
        return analysis
    
    def _analyze_trend(self, df):
        """Identify trend direction and strength"""
        closes = df['close'].values
        
        # Multiple timeframe trend analysis
        short_trend = self._linear_trend(closes[-20:])  # 20-day trend
        medium_trend = self._linear_trend(closes[-50:])  # 50-day trend
        long_trend = self._linear_trend(closes[-200:])  # 200-day trend
        
        # Moving average analysis
        ma_20 = talib.SMA(closes, timeperiod=20)
        ma_50 = talib.SMA(closes, timeperiod=50)
        ma_200 = talib.SMA(closes, timeperiod=200)
        
        current_price = closes[-1]
        
        trend_signals = {
            'short_term_trend': short_trend,
            'medium_term_trend': medium_trend,
            'long_term_trend': long_trend,
            'price_vs_ma20': (current_price - ma_20[-1]) / ma_20[-1],
            'price_vs_ma50': (current_price - ma_50[-1]) / ma_50[-1],
            'price_vs_ma200': (current_price - ma_200[-1]) / ma_200[-1],
            'ma_alignment': self._check_ma_alignment(ma_20[-1], ma_50[-1], ma_200[-1])
        }
        
        return trend_signals
    
    def _find_support_resistance_levels(self, df):
        """Identify key support and resistance levels"""
        highs = df['high'].values
        lows = df['low'].values
        closes = df['close'].values
        
        # Find pivot points
        resistance_levels = self._find_resistance_levels(highs)
        support_levels = self._find_support_levels(lows)
        
        current_price = closes[-1]
        
        return {
            'nearest_resistance': self._find_nearest_level(current_price, resistance_levels, 'above'),
            'nearest_support': self._find_nearest_level(current_price, support_levels, 'below'),
            'resistance_strength': self._calculate_level_strength(resistance_levels),
            'support_strength': self._calculate_level_strength(support_levels),
            'price_position': self._calculate_price_position(current_price, support_levels, resistance_levels)
        }
    
    def _detect_chart_patterns(self, df):
        """Detect common chart patterns"""
        closes = df['close'].values
        highs = df['high'].values
        lows = df['low'].values
        
        patterns = {
            'head_and_shoulders': self._detect_head_and_shoulders(highs, lows),
            'double_top': self._detect_double_top(highs),
            'double_bottom': self._detect_double_bottom(lows),
            'ascending_triangle': self._detect_ascending_triangle(highs, lows),
            'descending_triangle': self._detect_descending_triangle(highs, lows),
            'symmetrical_triangle': self._detect_symmetrical_triangle(highs, lows),
            'flag_pattern': self._detect_flag_pattern(closes),
            'wedge_pattern': self._detect_wedge_pattern(highs, lows)
        }
        
        return patterns
    
    def _calculate_momentum_indicators(self, df):
        """Calculate various momentum indicators"""
        closes = df['close'].values
        highs = df['high'].values
        lows = df['low'].values
        volumes = df['volume'].values
        
        indicators = {
            'rsi': talib.RSI(closes, timeperiod=14)[-1],
            'macd': self._calculate_macd_signal(closes),
            'stochastic': self._calculate_stochastic(highs, lows, closes),
            'williams_r': talib.WILLR(highs, lows, closes, timeperiod=14)[-1],
            'cci': talib.CCI(highs, lows, closes, timeperiod=14)[-1],
            'mfi': talib.MFI(highs, lows, closes, volumes, timeperiod=14)[-1],
            'adx': talib.ADX(highs, lows, closes, timeperiod=14)[-1]
        }
        
        # Interpret indicators
        indicators['momentum_score'] = self._interpret_momentum_indicators(indicators)
        
        return indicators
    
    def _analyze_volume_patterns(self, df):
        """Analyze volume patterns and trends"""
        volumes = df['volume'].values
        closes = df['close'].values
        
        volume_analysis = {
            'average_volume': np.mean(volumes[-20:]),
            'volume_trend': self._linear_trend(volumes[-20:]),
            'volume_price_correlation': np.corrcoef(volumes[-20:], closes[-20:])[0, 1],
            'volume_breakout': self._detect_volume_breakout(volumes),
            'on_balance_volume': talib.OBV(closes, volumes)[-1],
            'volume_weighted_average_price': talib.AVGPRICE(df['open'], df['high'], df['low'], df['close'])[-1]
        }
        
        return volume_analysis
    
    def _analyze_volatility(self, df):
        """Analyze price volatility patterns"""
        closes = df['close'].values
        highs = df['high'].values
        lows = df['low'].values
        
        returns = np.diff(np.log(closes))
        
        volatility_analysis = {
            'historical_volatility': np.std(returns) * np.sqrt(252),  # Annualized
            'average_true_range': talib.ATR(highs, lows, closes, timeperiod=14)[-1],
            'bollinger_bands': self._calculate_bollinger_position(closes),
            'volatility_trend': self._analyze_volatility_trend(returns),
            'volatility_percentile': self._calculate_volatility_percentile(returns)
        }
        
        return volatility_analysis
    
    def _calculate_overall_score(self, analysis):
        """Calculate overall technical score from all indicators"""
        scores = []
        
        # Trend score
        trend_score = (
            analysis['trend_analysis']['short_term_trend'] * 0.4 +
            analysis['trend_analysis']['medium_term_trend'] * 0.4 +
            analysis['trend_analysis']['long_term_trend'] * 0.2
        )
        scores.append(trend_score * 0.3)
        
        # Momentum score
        momentum_score = analysis['momentum_indicators']['momentum_score']
        scores.append(momentum_score * 0.3)
        
        # Pattern score
        pattern_scores = [p.get('bullish_probability', 0) - p.get('bearish_probability', 0) 
                         for p in analysis['pattern_recognition'].values() if isinstance(p, dict)]
        pattern_score = np.mean(pattern_scores) if pattern_scores else 0
        scores.append(pattern_score * 0.2)
        
        # Support/Resistance score
        sr_score = analysis['support_resistance']['price_position']
        scores.append(sr_score * 0.2)
        
        return np.sum(scores)
```

### 3. Fundamental Analysis Module

```python
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class FundamentalAnalyzer:
    """
    Comprehensive fundamental analysis of company financials and metrics
    """
    
    def __init__(self):
        self.industry_benchmarks = {}  # Load from database or config
        self.scoring_weights = {
            'growth': 0.25,
            'profitability': 0.25,
            'financial_health': 0.25,
            'valuation': 0.25
        }
    
    def analyze_fundamentals(self, financial_data, market_data):
        """
        Comprehensive fundamental analysis
        
        Args:
            financial_data: Company financial statements and metrics
            market_data: Current market data (price, market cap, etc.)
            
        Returns:
            dict: Fundamental analysis results
        """
        analysis = {
            'growth_analysis': self._analyze_growth_metrics(financial_data),
            'profitability_analysis': self._analyze_profitability(financial_data),
            'financial_health': self._analyze_financial_health(financial_data),
            'valuation_analysis': self._analyze_valuation(financial_data, market_data),
            'competitive_position': self._analyze_competitive_position(financial_data),
            'management_effectiveness': self._analyze_management_effectiveness(financial_data),
            'overall_fundamental_score': 0.0
        }
        
        # Calculate overall fundamental score
        analysis['overall_fundamental_score'] = self._calculate_fundamental_score(analysis)
        
        return analysis
    
    def _analyze_growth_metrics(self, financial_data):
        """Analyze revenue, earnings, and other growth metrics"""
        income_statements = financial_data.get('income_statements', [])
        
        if len(income_statements) < 2:
            return {'insufficient_data': True}
        
        # Calculate growth rates
        revenue_growth = self._calculate_growth_rates([stmt['revenue'] for stmt in income_statements])
        earnings_growth = self._calculate_growth_rates([stmt['net_income'] for stmt in income_statements])
        
        # Free cash flow growth
        cash_flows = financial_data.get('cash_flow_statements', [])
        fcf_growth = self._calculate_fcf_growth(cash_flows) if cash_flows else 0
        
        growth_analysis = {
            'revenue_growth_1yr': revenue_growth.get('1_year', 0),
            'revenue_growth_3yr_avg': revenue_growth.get('3_year_avg', 0),
            'revenue_growth_5yr_avg': revenue_growth.get('5_year_avg', 0),
            'earnings_growth_1yr': earnings_growth.get('1_year', 0),
            'earnings_growth_3yr_avg': earnings_growth.get('3_year_avg', 0),
            'free_cash_flow_growth': fcf_growth,
            'growth_consistency': self._calculate_growth_consistency(revenue_growth, earnings_growth),
            'growth_acceleration': self._detect_growth_acceleration(revenue_growth, earnings_growth)
        }
        
        # Score growth metrics
        growth_analysis['growth_score'] = self._score_growth_metrics(growth_analysis)
        
        return growth_analysis
    
    def _analyze_profitability(self, financial_data):
        """Analyze various profitability metrics"""
        income_statements = financial_data.get('income_statements', [])
        balance_sheets = financial_data.get('balance_sheets', [])
        
        if not income_statements or not balance_sheets:
            return {'insufficient_data': True}
        
        latest_income = income_statements[0]
        latest_balance = balance_sheets[0]
        
        profitability = {
            'gross_margin': latest_income['gross_profit'] / latest_income['revenue'],
            'operating_margin': latest_income['operating_income'] / latest_income['revenue'],
            'net_margin': latest_income['net_income'] / latest_income['revenue'],
            'return_on_assets': latest_income['net_income'] / latest_balance['total_assets'],
            'return_on_equity': latest_income['net_income'] / latest_balance['shareholders_equity'],
            'return_on_invested_capital': self._calculate_roic(latest_income, latest_balance),
            'profit_margin_trend': self._analyze_margin_trends(income_statements),
            'profitability_vs_peers': self._compare_profitability_to_peers(profitability)
        }
        
        # Score profitability
        profitability['profitability_score'] = self._score_profitability_metrics(profitability)
        
        return profitability
    
    def _analyze_financial_health(self, financial_data):
        """Analyze balance sheet strength and financial stability"""
        balance_sheets = financial_data.get('balance_sheets', [])
        cash_flows = financial_data.get('cash_flow_statements', [])
        
        if not balance_sheets:
            return {'insufficient_data': True}
        
        latest_balance = balance_sheets[0]
        
        financial_health = {
            'current_ratio': latest_balance['current_assets'] / latest_balance['current_liabilities'],
            'quick_ratio': (latest_balance['current_assets'] - latest_balance['inventory']) / latest_balance['current_liabilities'],
            'debt_to_equity': latest_balance['total_debt'] / latest_balance['shareholders_equity'],
            'debt_to_assets': latest_balance['total_debt'] / latest_balance['total_assets'],
            'interest_coverage': self._calculate_interest_coverage(financial_data),
            'cash_ratio': latest_balance['cash_and_equivalents'] / latest_balance['current_liabilities'],
            'working_capital': latest_balance['current_assets'] - latest_balance['current_liabilities'],
            'asset_turnover': self._calculate_asset_turnover(financial_data),
            'debt_trend': self._analyze_debt_trends(balance_sheets)
        }
        
        # Calculate financial strength score
        financial_health['financial_health_score'] = self._score_financial_health(financial_health)
        
        return financial_health
    
    def _analyze_valuation(self, financial_data, market_data):
        """Analyze valuation metrics and ratios"""
        income_statements = financial_data.get('income_statements', [])
        cash_flows = financial_data.get('cash_flow_statements', [])
        
        current_price = market_data['current_price']
        shares_outstanding = market_data['shares_outstanding']
        market_cap = current_price * shares_outstanding
        
        latest_income = income_statements[0] if income_statements else {}
        
        valuation = {
            'pe_ratio': current_price / (latest_income.get('earnings_per_share', 1)),
            'price_to_book': current_price / market_data.get('book_value_per_share', 1),
            'price_to_sales': market_cap / latest_income.get('revenue', 1),
            'ev_to_ebitda': self._calculate_ev_ebitda(market_data, latest_income),
            'price_to_free_cash_flow': self._calculate_price_to_fcf(market_data, cash_flows),
            'peg_ratio': self._calculate_peg_ratio(financial_data, market_data),
            'dividend_yield': market_data.get('dividend_yield', 0),
            'valuation_vs_peers': self._compare_valuation_to_peers(valuation),
            'intrinsic_value': self._calculate_intrinsic_value(financial_data, market_data)
        }
        
        # Score valuation metrics
        valuation['valuation_score'] = self._score_valuation_metrics(valuation)
        
        return valuation
    
    def _analyze_competitive_position(self, financial_data):
        """Analyze competitive advantages and market position"""
        # This would typically involve industry comparison data
        return {
            'market_share_trend': 0,  # Placeholder
            'competitive_advantages': [],
            'moat_strength': 'medium',
            'industry_position': 'average'
        }
    
    def _analyze_management_effectiveness(self, financial_data):
        """Analyze management effectiveness through financial metrics"""
        return {
            'capital_allocation_efficiency': 0,  # Placeholder
            'management_guidance_accuracy': 0,
            'insider_ownership': 0,
            'management_score': 0
        }
    
    def _calculate_fundamental_score(self, analysis):
        """Calculate overall fundamental score"""
        scores = {
            'growth': analysis['growth_analysis'].get('growth_score', 0),
            'profitability': analysis['profitability_analysis'].get('profitability_score', 0),
            'financial_health': analysis['financial_health'].get('financial_health_score', 0),
            'valuation': analysis['valuation_analysis'].get('valuation_score', 0)
        }
        
        weighted_score = sum(score * self.scoring_weights[metric] 
                           for metric, score in scores.items())
        
        return weighted_score
```

### 4. Prediction Engine

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import joblib
from datetime import datetime, timedelta

class PredictionEngine:
    """
    Machine learning-based prediction engine that combines all analysis modules
    """
    
    def __init__(self):
        self.models = {
            'short_term': None,  # 1-5 day predictions
            'medium_term': None,  # 1-4 week predictions
            'long_term': None    # 1-3 month predictions
        }
        self.feature_scaler = StandardScaler()
        self.prediction_confidence_threshold = 0.6
        
    def generate_predictions(self, analysis_data):
        """
        Generate comprehensive stock predictions using all analysis modules
        
        Args:
            analysis_data: Combined output from sentiment, technical, and fundamental analysis
            
        Returns:
            dict: Comprehensive predictions with confidence intervals
        """
        # Prepare feature matrix
        features = self._prepare_features(analysis_data)
        
        # Generate predictions for different timeframes
        predictions = {}
        
        for timeframe, model in self.models.items():
            if model is None:
                continue
                
            try:
                prediction_result = self._generate_single_prediction(
                    features, model, timeframe, analysis_data
                )
                predictions[timeframe] = prediction_result
                
            except Exception as e:
                print(f"Error generating {timeframe} prediction: {e}")
                predictions[timeframe] = self._get_default_prediction()
        
        # Generate overall recommendation
        overall_recommendation = self._generate_overall_recommendation(predictions)
        
        return {
            'predictions': predictions,
            'overall_recommendation': overall_recommendation,
            'feature_importance': self._get_feature_importance(analysis_data),
            'risk_assessment': self._assess_prediction_risk(predictions),
            'generated_at': datetime.now().isoformat()
        }
    
    def _prepare_features(self, analysis_data):
        """Convert analysis results into ML feature matrix"""
        features = {}
        
        # Sentiment features
        sentiment = analysis_data.get('sentiment_analysis', {})
        features.update({
            'sentiment_score': sentiment.get('overall_sentiment', 0),
            'sentiment_confidence': sentiment.get('confidence', 0),
            'sentiment_trend': sentiment.get('sentiment_trend', 0),
            'news_volume': sentiment.get('article_count', 0)
        })
        
        # Technical features
        technical = analysis_data.get('technical_analysis', {})
        features.update({
            'technical_score': technical.get('overall_technical_score', 0),
            'rsi': technical.get('momentum_indicators', {}).get('rsi', 50),
            'macd_signal': technical.get('momentum_indicators', {}).get('macd', {}).get('signal', 0),
            'volume_trend': technical.get('volume_analysis', {}).get('volume_trend', 0),
            'volatility': technical.get('volatility_analysis', {}).get('historical_volatility', 0),
            'trend_strength': technical.get('trend_analysis', {}).get('short_term_trend', 0)
        })
        
        # Fundamental features
        fundamental = analysis_data.get('fundamental_analysis', {})
        features.update({
            'fundamental_score': fundamental.get('overall_fundamental_score', 0),
            'revenue_growth': fundamental.get('growth_analysis', {}).get('revenue_growth_1yr', 0),
            'profit_margin': fundamental.get('profitability_analysis', {}).get('net_margin', 0),
            'pe_ratio': fundamental.get('valuation_analysis', {}).get('pe_ratio', 15),
            'debt_to_equity': fundamental.get('financial_health', {}).get('debt_to_equity', 0.5),
            'return_on_equity': fundamental.get('profitability_analysis', {}).get('return_on_equity', 0)
        })
        
        # Market context features
        market = analysis_data.get('market_context', {})
        features.update({
            'market_trend': market.get('market_trend', 0),
            'sector_performance': market.get('sector_performance', 0),
            'vix_level': market.get('vix_level', 20),
            'economic_indicators': market.get('economic_sentiment', 0)
        })
        
        # Convert to numpy array
        feature_array = np.array(list(features.values())).reshape(1, -1)
        
        return {
            'features': feature_array,
            'feature_names': list(features.keys()),
            'raw_features': features
        }
    
    def _generate_single_prediction(self, features, model, timeframe, analysis_data):
        """Generate prediction for a specific timeframe"""
        # Get base prediction from model
        feature_array = features['features']
        scaled_features = self.feature_scaler.transform(feature_array)
        
        base_prediction = model.predict(scaled_features)[0]
        
        # Calculate confidence based on feature consistency
        confidence = self._calculate_prediction_confidence(features, analysis_data, timeframe)
        
        # Generate price targets
        current_price = analysis_data.get('current_price', 100)
        price_targets = self._calculate_price_targets(base_prediction, current_price, confidence)
        
        # Determine action recommendation
        action = self._determine_action(base_prediction, confidence)
        
        return {
            'direction_probability': base_prediction,
            'confidence': confidence,
            'action': action,
            'price_targets': price_targets,
            'timeframe': timeframe,
            'key_factors': self._identify_key_factors(features, model)
        }
    
    def _calculate_prediction_confidence(self, features, analysis_data, timeframe):
        """Calculate confidence level for predictions"""
        confidence_factors = []
        
        # Data quality confidence
        data_completeness = self._assess_data_completeness(analysis_data)
        confidence_factors.append(data_completeness * 0.3)
        
        # Feature agreement confidence
        feature_agreement = self._assess_feature_agreement(features['raw_features'])
        confidence_factors.append(feature_agreement * 0.3)
        
        # Market condition confidence
        market_stability = self._assess_market_stability(analysis_data)
        confidence_factors.append(market_stability * 0.2)
        
        # Historical accuracy confidence (based on timeframe)
        timeframe_confidence = {
            'short_term': 0.8,
            'medium_term': 0.7,
            'long_term': 0.6
        }
        confidence_factors.append(timeframe_confidence.get(timeframe, 0.5) * 0.2)
        
        return min(sum(confidence_factors), 1.0)
    
    def _determine_action(self, prediction_probability, confidence):
        """Determine buy/sell/hold action based on prediction and confidence"""
        if confidence < self.prediction_confidence_threshold:
            return 'HOLD'  # Low confidence = no action
        
        if prediction_probability > 0.7:
            return 'STRONG_BUY'
        elif prediction_probability > 0.6:
            return 'BUY'
        elif prediction_probability < 0.3:
            return 'STRONG_SELL'
        elif prediction_probability < 0.4:
            return 'SELL'
        else:
            return 'HOLD'
    
    def _calculate_price_targets(self, prediction_probability, current_price, confidence):
        """Calculate price targets based on prediction"""
        # Base expected return
        expected_return = (prediction_probability - 0.5) * 2 * 0.15  # Max 15% in either direction
        
        # Adjust for confidence
        adjusted_return = expected_return * confidence
        
        # Calculate targets
        target_price = current_price * (1 + adjusted_return)
        
        # Conservative and aggressive targets
        conservative_target = current_price * (1 + adjusted_return * 0.5)
        aggressive_target = current_price * (1 + adjusted_return * 1.5)
        
        # Stop loss
        stop_loss = current_price * (1 - abs(adjusted_return) * 0.5)
        
        return {
            'target_price': round(target_price, 2),
            'conservative_target': round(conservative_target, 2),
            'aggressive_target': round(aggressive_target, 2),
            'stop_loss': round(stop_loss, 2),
            'expected_return': round(adjusted_return * 100, 2)
        }
    
    def _generate_overall_recommendation(self, predictions):
        """Generate overall recommendation from all timeframe predictions"""
        if not predictions:
            return self._get_default_recommendation()
        
        # Weight different timeframes
        weights = {
            'short_term': 0.2,
            'medium_term': 0.5,
            'long_term': 0.3
        }
        
        weighted_score = 0
        total_weight = 0
        action_votes = []
        
        for timeframe, prediction in predictions.items():
            weight = weights.get(timeframe, 0.33)
            weighted_score += prediction['direction_probability'] * weight
            total_weight += weight
            action_votes.append(prediction['action'])
        
        # Calculate overall probability
        overall_probability = weighted_score / total_weight if total_weight > 0 else 0.5
        
        # Determine consensus action
        consensus_action = self._get_consensus_action(action_votes)
        
        # Calculate overall confidence
        confidences = [p['confidence'] for p in predictions.values()]
        overall_confidence = np.mean(confidences) if confidences else 0.5
        
        return {
            'overall_probability': overall_probability,
            'consensus_action': consensus_action,
            'overall_confidence': overall_confidence,
            'timeframe_agreement': self._calculate_timeframe_agreement(predictions),
            'recommendation_strength': self._calculate_recommendation_strength(predictions)
        }
    
    def train_models(self, training_data):
        """Train prediction models on historical data"""
        # This would be implemented with your historical training data
        # For now, returning placeholder models
        
        for timeframe in self.models.keys():
            # Placeholder: In reality, you'd train on historical data
            self.models[timeframe] = RandomForestRegressor(
                n_estimators=100,
                random_state=42
            )
        
        print("Models trained successfully")
    
    def save_models(self, filepath):
        """Save trained models to disk"""
        joblib.dump({
            'models': self.models,
            'scaler': self.feature_scaler
        }, filepath)
    
    def load_models(self, filepath):
        """Load trained models from disk"""
        saved_data = joblib.load(filepath)
        self.models = saved_data['models']
        self.feature_scaler = saved_data['scaler']
```

### 5. Main Analysis Orchestrator

```python
from datetime import datetime
import asyncio
import logging

class FinancialAnalysisEngine:
    """
    Main orchestrator that coordinates all analysis modules
    """
    
    def __init__(self, mcp_clients):
        self.mcp_clients = mcp_clients
        self.sentiment_analyzer = SentimentAnalyzer()
        self.technical_analyzer = TechnicalAnalyzer()
        self.fundamental_analyzer = FundamentalAnalyzer()
        self.prediction_engine = PredictionEngine()
        
        # Load trained models
        try:
            self.prediction_engine.load_models('models/trained_models.pkl')
        except FileNotFoundError:
            logging.warning("No trained models found. Training new models...")
            self.prediction_engine.train_models({})  # Placeholder
    
    async def analyze_stock(self, ticker, sector=None):
        """
        Complete stock analysis workflow
        
        Args:
            ticker: Stock symbol to analyze
            sector: Optional sector for context
            
        Returns:
            dict: Comprehensive analysis results
        """
        try:
            # Step 1: Gather raw data from MCP servers
            raw_data = await self._gather_raw_data(ticker, sector)
            
            # Step 2: Run all analysis modules in parallel
            analysis_tasks = [
                self._run_sentiment_analysis(raw_data['news'], ticker),
                self._run_technical_analysis(raw_data['price_data']),
                self._run_fundamental_analysis(raw_data['financial_data'], raw_data['market_data'])
            ]
            
            sentiment_analysis, technical_analysis, fundamental_analysis = await asyncio.gather(*analysis_tasks)
            
            # Step 3: Combine all analysis results
            combined_analysis = {
                'ticker': ticker,
                'analysis_timestamp': datetime.now().isoformat(),
                'current_price': raw_data['market_data']['current_price'],
                'sentiment_analysis': sentiment_analysis,
                'technical_analysis': technical_analysis,
                'fundamental_analysis': fundamental_analysis,
                'market_context': await self._get_market_context(sector)
            }
            
            # Step 4: Generate predictions
            predictions = self.prediction_engine.generate_predictions(combined_analysis)
            combined_analysis['predictions'] = predictions
            
            # Step 5: Generate final recommendations
            recommendations = self._generate_final_recommendations(combined_analysis)
            combined_analysis['recommendations'] = recommendations
            
            return combined_analysis
            
        except Exception as e:
            logging.error(f"Error analyzing stock {ticker}: {e}")
            return self._get_error_response(ticker, str(e))
    
    async def analyze_sector(self, sector_name, top_n=10):
        """
        Analyze entire sector and rank stocks
        
        Args:
            sector_name: Name of the sector to analyze
            top_n: Number of top stocks to analyze in detail
            
        Returns:
            dict: Sector analysis with ranked stocks
        """
        try:
            # Get sector stocks
            sector_stocks = await self.mcp_clients['fmp'].get_sector_stocks(sector_name)
            
            # Analyze all stocks in parallel (limited to top_n)
            analysis_tasks = [
                self.analyze_stock(stock['symbol'], sector_name) 
                for stock in sector_stocks[:top_n]
            ]
            
            stock_analyses = await asyncio.gather(*analysis_tasks, return_exceptions=True)
            
            # Rank stocks by overall score
            ranked_stocks = self._rank_stocks_by_score(stock_analyses)
            
            # Generate sector summary
            sector_summary = self._generate_sector_summary(ranked_stocks, sector_name)
            
            return {
                'sector': sector_name,
                'analysis_timestamp': datetime.now().isoformat(),
                'sector_summary': sector_summary,
                'ranked_stocks': ranked_stocks,
                'total_stocks_analyzed': len(stock_analyses)
            }
            
        except Exception as e:
            logging.error(f"Error analyzing sector {sector_name}: {e}")
            return self._get_error_response(sector_name, str(e))
    
    async def _gather_raw_data(self, ticker, sector=None):
        """Gather all required data from MCP servers"""
        data_tasks = {
            'price_data': self.mcp_clients['alpha_vantage'].get_daily_prices(ticker, outputsize='full'),
            'news': self.mcp_clients['alpha_vantage'].get_news_sentiment(tickers=[ticker]),
            'financial_data': self.mcp_clients['fmp'].get_financial_statements(ticker),
            'market_data': self.mcp_clients['polygon'].get_current_market_data(ticker)
        }
        
        if sector:
            data_tasks['sector_data'] = self.mcp_clients['fmp'].get_sector_performance(sector)
        
        return await asyncio.gather_dict(data_tasks)
    
    async def _run_sentiment_analysis(self, news_data, ticker):
        """Run sentiment analysis"""
        return self.sentiment_analyzer.analyze_news_impact(news_data, ticker)
    
    async def _run_technical_analysis(self, price_data):
        """Run technical analysis"""
        return self.technical_analyzer.analyze_technical_patterns(price_data)
    
    async def _run_fundamental_analysis(self, financial_data, market_data):
        """Run fundamental analysis"""
        return self.fundamental_analyzer.analyze_fundamentals(financial_data, market_data)
    
    def _generate_final_recommendations(self, analysis):
        """Generate final investment recommendations"""
        overall_score = self._calculate_overall_stock_score(analysis)
        
        recommendations = {
            'overall_score': overall_score,
            'investment_thesis': self._generate_investment_thesis(analysis),
            'key_risks': self._identify_key_risks(analysis),
            'key_opportunities': self._identify_key_opportunities(analysis),
            'similar_stocks': self._find_similar_stocks(analysis),
            'analyst_consensus': self._get_analyst_consensus(analysis),
            'recommendation_rationale': self._generate_rationale(analysis)
        }
        
        return recommendations
    
    def _calculate_overall_stock_score(self, analysis):
        """Calculate overall investment score"""
        weights = {
            'sentiment': 0.2,
            'technical': 0.3,
            'fundamental': 0.4,
            'prediction_confidence': 0.1
        }
        
        scores = {
            'sentiment': analysis['sentiment_analysis'].get('overall_sentiment', 0),
            'technical': analysis['technical_analysis'].get('overall_technical_score', 0),
            'fundamental': analysis['fundamental_analysis'].get('overall_fundamental_score', 0),
            'prediction_confidence': analysis['predictions']['overall_recommendation'].get('overall_confidence', 0)
        }
        
        # Normalize scores to 0-1 range and calculate weighted average
        normalized_scores = {k: max(0, min(1, (v + 1) / 2)) for k, v in scores.items()}
        overall_score = sum(score * weights[metric] for metric, score in normalized_scores.items())
        
        return round(overall_score * 100, 1)  # Return as percentage
```

## Technology Stack and Dependencies

### Core Dependencies

```python
# requirements.txt
numpy>=1.21.0
pandas>=1.3.0
scikit-learn>=1.0.0
torch>=1.9.0
transformers>=4.15.0
TA-Lib>=0.4.24
scipy>=1.7.0
asyncio
aiohttp>=3.8.0
fastapi>=0.68.0
uvicorn>=0.15.0
pydantic>=1.8.0
python-multipart>=0.0.5
```

### Installation and Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install TA-Lib (technical analysis library)
# On macOS:
brew install ta-lib
pip install TA-Lib

# On Ubuntu:
sudo apt-get install libta-lib-dev
pip install TA-Lib

# On Windows:
# Download and install TA-Lib from: http://prdownloads.sourceforge.net/ta-lib/ta-lib-0.4.0-msvc.zip
pip install TA-Lib
```

## Deployment Architecture

### Production Setup

```python
# main.py - FastAPI application
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Financial Analysis Engine API")

# CORS middleware for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize analysis engine
analysis_engine = FinancialAnalysisEngine(mcp_clients)

@app.post("/api/analyze/stock/{ticker}")
async def analyze_stock(ticker: str, sector: str = None):
    try:
        result = await analysis_engine.analyze_stock(ticker, sector)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze/sector/{sector_name}")
async def analyze_sector(sector_name: str, top_n: int = 10):
    try:
        result = await analysis_engine.analyze_sector(sector_name, top_n)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Frontend Integration

```javascript
// Frontend API integration example
class FinancialAnalysisAPI {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }
    
    async analyzeStock(ticker, sector = null) {
        const response = await fetch(`${this.baseUrl}/api/analyze/stock/${ticker}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sector })
        });
        
        if (!response.ok) {
            throw new Error(`Analysis failed: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    async analyzeSector(sectorName, topN = 10) {
        const response = await fetch(`${this.baseUrl}/api/analyze/sector/${sectorName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ top_n: topN })
        });
        
        return await response.json();
    }
}

// Usage in React component
const StockAnalysis = () => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const api = new FinancialAnalysisAPI();
    
    const analyzeStock = async (ticker) => {
        setLoading(true);
        try {
            const result = await api.analyzeStock(ticker);
            setAnalysis(result);
        } catch (error) {
            console.error('Analysis failed:', error);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div>
            {/* Your UI components */}
        </div>
    );
};
```

## Performance Optimization

### Caching Strategy

```python
import redis
import json
from datetime import timedelta

class AnalysisCache:
    def __init__(self):
        self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        self.cache_ttl = {
            'sentiment': 300,    # 5 minutes
            'technical': 60,     # 1 minute
            'fundamental': 3600, # 1 hour
            'predictions': 900   # 15 minutes
        }
    
    def get_cached_analysis(self, cache_key):
        cached_data = self.redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        return None
    
    def cache_analysis(self, cache_key, data, analysis_type):
        ttl = self.cache_ttl.get(analysis_type, 300)
        self.redis_client.setex(
            cache_key, 
            ttl, 
            json.dumps(data, default=str)
        )
```

### Monitoring and Logging

```python
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('financial_analysis.log'),
        logging.StreamHandler()
    ]
)

class PerformanceMonitor:
    def __init__(self):
        self.analysis_times = {}
        
    def log_analysis_performance(self, ticker, analysis_type, duration):
        logging.info(f"Analysis completed: {ticker} - {analysis_type} - {duration:.2f}s")
        
        # Store for performance analytics
        key = f"{ticker}_{analysis_type}"
        if key not in self.analysis_times:
            self.analysis_times[key] = []
        
        self.analysis_times[key].append({
            'timestamp': datetime.now(),
            'duration': duration
        })
```

## Summary

This Financial Analysis Engine provides a comprehensive foundation for your research-driven financial website. The modular architecture allows you to:

1. **Scale independently** - Each analysis module can be optimized separately
2. **Add new data sources** - Easy integration of additional MCP servers
3. **Customize predictions** - Train models on your specific requirements
4. **Handle real-time data** - Async architecture for responsive user experience
5. **Maintain accuracy** - Comprehensive error handling and validation

The engine transforms raw financial data from MCP servers into intelligent investment recommendations through sophisticated analysis of sentiment, technical patterns, fundamental metrics, and machine learning predictions.