// Tier 1 Data Collection Implementation
// Maps data requirements to your existing APIs

interface Tier1DataPacket {
  priceData: PriceVolumeData;
  fundamentals: FundamentalRatios;
  vixAndIndices: IndexData;
  treasuryRates: TreasuryData;
  analystData: AnalystCoverage;
  // optionsData: OptionsData; // TODO: Need new API
}

class Tier1DataCollector {
  constructor(
    private polygon: PolygonAPI,
    private fmp: FinancialModelingPrepAPI,
    private twelveData: TwelveDataAPI,
    private yahoo: YahooFinanceAPI,
    private alphaVantage: AlphaVantageAPI,
    private treasury: TreasuryAPI,
    private fred: FREDAPI
  ) {}

  async collectTier1Data(symbols: string[]): Promise<Tier1DataPacket> {
    // Parallel collection of all Tier 1 data
    const [
      priceData,
      fundamentals,
      vixAndIndices,
      treasuryRates,
      analystData
    ] = await Promise.all([
      this.collectPriceVolumeData(symbols),
      this.collectFundamentalData(symbols),
      this.collectVIXAndIndices(),
      this.collectTreasuryData(),
      this.collectAnalystData(symbols)
    ]);

    return {
      priceData,
      fundamentals,
      vixAndIndices,
      treasuryRates,
      analystData
    };
  }

  // 1. PRICE/VOLUME DATA - Multi-source with fallbacks
  private async collectPriceVolumeData(symbols: string[]): Promise<PriceVolumeData> {
    const results: PriceVolumeData = {};
    
    for (const symbol of symbols) {
      try {
        // Try Polygon first (best quality)
        results[symbol] = await this.getPriceDataFromPolygon(symbol);
      } catch (error) {
        try {
          // Fallback to TwelveData
          results[symbol] = await this.getPriceDataFromTwelveData(symbol);
        } catch (error) {
          try {
            // Fallback to FMP
            results[symbol] = await this.getPriceDataFromFMP(symbol);
          } catch (error) {
            // Last resort - Yahoo
            results[symbol] = await this.getPriceDataFromYahoo(symbol);
          }
        }
      }
    }
    
    return results;
  }

  private async getPriceDataFromPolygon(symbol: string): Promise<SymbolPriceData> {
    const [currentPrice, previousDay, historicalData] = await Promise.all([
      this.polygon.getRealTimePrice(symbol),
      this.polygon.getPreviousDay(symbol),
      this.polygon.getHistoricalData(symbol, '30D') // 30 days for technical analysis
    ]);

    return {
      symbol,
      currentPrice: currentPrice.results[0].c,
      previousClose: previousDay.results[0].c,
      volume: currentPrice.results[0].v,
      historical: historicalData.map(day => ({
        date: day.t,
        open: day.o,
        high: day.h,
        low: day.l,
        close: day.c,
        volume: day.v
      })),
      source: 'polygon'
    };
  }

  private async getPriceDataFromTwelveData(symbol: string): Promise<SymbolPriceData> {
    const [quote, timeSeries] = await Promise.all([
      this.twelveData.getQuote(symbol),
      this.twelveData.getTimeSeries(symbol, 'daily', 30)
    ]);

    return {
      symbol,
      currentPrice: parseFloat(quote.price),
      previousClose: parseFloat(quote.previous_close),
      volume: parseInt(quote.volume),
      historical: timeSeries.values.map(day => ({
        date: day.datetime,
        open: parseFloat(day.open),
        high: parseFloat(day.high),
        low: parseFloat(day.low),
        close: parseFloat(day.close),
        volume: parseInt(day.volume)
      })),
      source: 'twelvedata'
    };
  }

  // 2. FUNDAMENTAL DATA - Primarily from FMP
  private async collectFundamentalData(symbols: string[]): Promise<FundamentalRatios> {
    const fundamentals: FundamentalRatios = {};
    
    for (const symbol of symbols) {
      try {
        // Try FMP first (most comprehensive)
        const profile = await this.fmp.getCompanyProfile(symbol);
        const ratios = await this.fmp.getFinancialRatios(symbol);
        
        fundamentals[symbol] = {
          pe: profile.pe || ratios.priceEarningsRatio,
          pb: ratios.priceToBookRatio,
          ps: ratios.priceToSalesRatio,
          ev_ebitda: ratios.enterpriseValueMultiple,
          roe: ratios.returnOnEquity,
          roa: ratios.returnOnAssets,
          debt_to_equity: ratios.debtEquityRatio,
          current_ratio: ratios.currentRatio,
          quick_ratio: ratios.quickRatio,
          gross_margin: ratios.grossProfitMargin,
          operating_margin: ratios.operatingProfitMargin,
          market_cap: profile.mktCap,
          beta: profile.beta,
          source: 'fmp'
        };
      } catch (error) {
        try {
          // Fallback to Alpha Vantage
          const overview = await this.alphaVantage.getCompanyOverview(symbol);
          fundamentals[symbol] = this.parseAlphaVantageOverview(overview);
        } catch (fallbackError) {
          console.warn(`Could not get fundamentals for ${symbol}`);
          fundamentals[symbol] = null;
        }
      }
    }
    
    return fundamentals;
  }

  // 3. VIX AND MAJOR INDICES
  private async collectVIXAndIndices(): Promise<IndexData> {
    const indices = ['SPY', 'QQQ', 'IWM', '^VIX', 'GLD', 'TLT'];
    const indexData: IndexData = {};
    
    for (const index of indices) {
      try {
        // Use Polygon for index data
        const data = await this.polygon.getRealTimePrice(index);
        indexData[index] = {
          price: data.results[0].c,
          change: data.results[0].c - data.results[0].o,
          volume: data.results[0].v,
          timestamp: new Date()
        };
      } catch (error) {
        try {
          // Fallback to Yahoo
          const data = await this.yahoo.getQuote(index);
          indexData[index] = {
            price: data.regularMarketPrice,
            change: data.regularMarketChange,
            volume: data.regularMarketVolume,
            timestamp: new Date()
          };
        } catch (fallbackError) {
          console.warn(`Could not get data for index ${index}`);
        }
      }
    }
    
    return indexData;
  }

  // 4. TREASURY RATES - Enhanced analysis via FRED API
  private async collectTreasuryData(): Promise<TreasuryData> {
    try {
      // Get enhanced treasury analysis data
      const enhancedData = await this.treasury.getTreasuryAnalysisData();

      if (enhancedData) {
        return {
          rates: enhancedData.rates,
          changes: enhancedData.changes,           // Daily basis point changes
          yieldCurve: {
            slopes: {
              '10Y_2Y': enhancedData.yieldCurve.slope_10Y_2Y,
              '10Y_3M': enhancedData.yieldCurve.slope_10Y_3M,
              '30Y_10Y': enhancedData.yieldCurve.slope_30Y_10Y
            },
            shape: enhancedData.yieldCurve.shape,
            isInverted: enhancedData.yieldCurve.isInverted
          },
          context: {
            momentum: enhancedData.context.momentum,
            avgDailyChange: enhancedData.context.avgDailyChange,
            rateEnvironment: enhancedData.context.momentum === 'rising' ? 'tightening' :
                           enhancedData.context.momentum === 'falling' ? 'easing' : 'stable'
          },
          timestamp: new Date(),
          source: 'treasury-fred'
        };
      }

      // Fallback to basic rates if enhanced data fails
      const basicRates = await this.treasury.getTreasuryRates();
      return {
        rates: basicRates || {},
        changes: {},
        yieldCurve: {},
        context: { momentum: 'unknown' },
        timestamp: new Date(),
        source: 'treasury-fred-basic'
      };

    } catch (error) {
      console.error('Treasury data collection failed:', error);
      return {
        rates: {},
        changes: {},
        yieldCurve: {},
        context: { momentum: 'error' },
        timestamp: new Date(),
        source: 'treasury-error'
      };
    }
  }

  private async getFREDTreasuryRates(): Promise<any> {
    const series = ['DGS1MO', 'DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS5', 'DGS10', 'DGS20', 'DGS30'];
    const rates: any = {};
    
    for (const seriesId of series) {
      try {
        const data = await this.fred.getSeries(seriesId);
        rates[seriesId] = data.observations[data.observations.length - 1].value;
      } catch (error) {
        rates[seriesId] = null;
      }
    }
    
    return rates;
  }

  // 5. ANALYST DATA - Limited coverage, needs enhancement
  private async collectAnalystData(symbols: string[]): Promise<AnalystCoverage> {
    const analystData: AnalystCoverage = {};
    
    for (const symbol of symbols) {
      try {
        // Check if FMP has analyst data
        const analystEstimates = await this.fmp.getAnalystEstimates?.(symbol);
        if (analystEstimates) {
          analystData[symbol] = {
            consensus_rating: analystEstimates.consensusRating,
            price_target: analystEstimates.targetPriceMean,
            num_analysts: analystEstimates.numberOfAnalysts,
            buy_ratings: analystEstimates.numberOfBuyRatings,
            hold_ratings: analystEstimates.numberOfHoldRatings,
            sell_ratings: analystEstimates.numberOfSellRatings,
            source: 'fmp'
          };
        } else {
          // Try alternative approach through Yahoo Finance scraping
          analystData[symbol] = await this.getYahooAnalystData(symbol);
        }
      } catch (error) {
        console.warn(`Could not get analyst data for ${symbol}`);
        analystData[symbol] = null;
      }
    }
    
    return analystData;
  }

  private async getYahooAnalystData(symbol: string): Promise<any> {
    // This would require scraping Yahoo Finance analysis page
    // or using unofficial Yahoo Finance API endpoints
    try {
      const data = await this.yahoo.getAnalysisData?.(symbol);
      return {
        consensus_rating: data.recommendationMean,
        price_target: data.targetMeanPrice,
        num_analysts: data.numberOfAnalystOpinions,
        source: 'yahoo'
      };
    } catch (error) {
      return null;
    }
  }

  // MISSING: Options Data Collection
  // TODO: Implement once options API is added
  private async collectOptionsData(symbols: string[]): Promise<OptionsData> {
    // This will need a new API like CBOE, Tradier, or Polygon Options
    throw new Error('Options data not implemented - need to add options API');
  }
}

// Data type definitions
interface PriceVolumeData {
  [symbol: string]: SymbolPriceData;
}

interface SymbolPriceData {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  volume: number;
  historical: DailyData[];
  source: string;
}

interface DailyData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FundamentalRatios {
  [symbol: string]: {
    pe: number;
    pb: number;
    ps: number;
    ev_ebitda: number;
    roe: number;
    roa: number;
    debt_to_equity: number;
    current_ratio: number;
    quick_ratio: number;
    gross_margin: number;
    operating_margin: number;
    market_cap: number;
    beta: number;
    source: string;
  } | null;
}

interface IndexData {
  [index: string]: {
    price: number;
    change: number;
    volume: number;
    timestamp: Date;
  };
}

interface TreasuryData {
  yieldCurve: any;
  rates: {
    [duration: string]: number;
  };
  timestamp: Date;
}

interface AnalystCoverage {
  [symbol: string]: {
    consensus_rating: string;
    price_target: number;
    num_analysts: number;
    buy_ratings?: number;
    hold_ratings?: number;
    sell_ratings?: number;
    source: string;
  } | null;
}