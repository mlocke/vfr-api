/**
 * Simple focused test to debug PricePredictionFeatureExtractor
 */

import { PricePredictionFeatureExtractor } from '../PricePredictionFeatureExtractor';
import { RedisCache } from '../../../cache/RedisCache';

// Mock services
jest.mock('../../../financial-data/FinancialDataService');
jest.mock('../../../financial-data/FinancialModelingPrepAPI');
jest.mock('../../../financial-data/OptionsDataService');
jest.mock('../../../financial-data/InstitutionalDataService');
jest.mock('../../../financial-data/SentimentAnalysisService');
jest.mock('../../../financial-data/MacroeconomicAnalysisService');
jest.mock('../../../technical-analysis/TechnicalIndicatorService');
jest.mock('../../../financial-data/VWAPService');
jest.mock('../../../cache/RedisCache');

describe('PricePredictionFeatureExtractor - Simple Test', () => {
	let extractor: PricePredictionFeatureExtractor;
	let mockCache: jest.Mocked<RedisCache>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockCache = {
			get: jest.fn().mockResolvedValue(null),
			set: jest.fn().mockResolvedValue(true),
			delete: jest.fn().mockResolvedValue(true),
			getInstance: jest.fn()
		} as any;

		(RedisCache.getInstance as jest.Mock).mockReturnValue(mockCache);

		extractor = new PricePredictionFeatureExtractor();

		// Create enough historical data (minimum 20 days required)
		const mockHistoricalData = Array.from({ length: 60 }, (_, i) => ({
			date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
			timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
			open: 150 + Math.random() * 10,
			high: 155 + Math.random() * 10,
			low: 145 + Math.random() * 10,
			close: 150 + Math.random() * 10,
			volume: 50000000 + Math.random() * 10000000
		}));

		// Mock the financial data service directly
		(extractor as any).financialDataService = {
			getHistoricalOHLC: jest.fn().mockResolvedValue(mockHistoricalData),
			getDailyOHLC: jest.fn().mockResolvedValue(mockHistoricalData[0])
		};

		// Mock all external service dependencies
		(extractor as any).fmpAPI = {
			getCompanyInfo: jest.fn().mockResolvedValue({ sector: 'Technology' }),
			getAnalystRatings: jest.fn().mockResolvedValue([])
		};

		(extractor as any).optionsService = {
			getOptionsChain: jest.fn().mockResolvedValue(null)
		};

		(extractor as any).institutionalService = {
			getInstitutionalIntelligence: jest.fn().mockResolvedValue(null),
			getInsiderTransactions: jest.fn().mockResolvedValue([])
		};

		(extractor as any).sentimentService = {
			getSentimentIndicators: jest.fn().mockResolvedValue({ news: {}, reddit: {} })
		};

		(extractor as any).macroService = {
			getMacroeconomicContext: jest.fn().mockResolvedValue({})
		};

		(extractor as any).technicalService = {
			calculateAllIndicators: jest.fn().mockResolvedValue({
				rsi: { value: 50 },
				macd: { value: 0, signal: 0, histogram: 0 },
				bollingerBands: { upper: 155, middle: 150, lower: 145 },
				stochastic: { k: 50, d: 50 },
				adx: { value: 25 },
				atr: { value: 2.5 },
				ema: { value: 150 },
				sma: { value: 150 },
				williamsR: { value: -50 }
			})
		};

		(extractor as any).vwapService = {
			calculateVWAP: jest.fn().mockResolvedValue(150)
		};
	});

	it('should extract all 43 features successfully', async () => {
		const symbol = 'AAPL';
		const date = new Date('2024-01-15');

		const features = await extractor.extractFeatures(symbol, date);

		// Verify structure
		expect(features).toHaveProperty('symbol', symbol);
		expect(features).toHaveProperty('timestamp');

		// Verify all 43 features exist
		expect(Object.keys(features).length).toBeGreaterThanOrEqual(43);

		// Verify all volume features
		expect(features).toHaveProperty('volume_ratio_5d');
		expect(features).toHaveProperty('volume_spike');
		expect(features).toHaveProperty('volume_trend_10d');
		expect(features).toHaveProperty('relative_volume');
		expect(features).toHaveProperty('volume_acceleration');
		expect(features).toHaveProperty('dark_pool_ratio');

		// Verify all technical features
		expect(features).toHaveProperty('rsi_14');
		expect(features).toHaveProperty('macd_signal');
		expect(features).toHaveProperty('macd_histogram');
		expect(features).toHaveProperty('bollinger_position');
		expect(features).toHaveProperty('stochastic_k');
		expect(features).toHaveProperty('adx_14');
		expect(features).toHaveProperty('atr_14');

		// Verify all options features
		expect(features).toHaveProperty('put_call_ratio');
		expect(features).toHaveProperty('unusual_options_activity');
		expect(features).toHaveProperty('options_iv_rank');
		expect(features).toHaveProperty('gamma_exposure');
		expect(features).toHaveProperty('max_pain_distance');

		// Verify all institutional features
		expect(features).toHaveProperty('institutional_net_flow');
		expect(features).toHaveProperty('block_trade_volume');
		expect(features).toHaveProperty('insider_buying_ratio');
		expect(features).toHaveProperty('ownership_change_30d');

		// Verify all sentiment features
		expect(features).toHaveProperty('news_sentiment_delta');
		expect(features).toHaveProperty('social_momentum');
		expect(features).toHaveProperty('analyst_target_distance');

		// Verify all macro features
		expect(features).toHaveProperty('sector_momentum_5d');
		expect(features).toHaveProperty('spy_momentum_5d');
		expect(features).toHaveProperty('vix_level');
		expect(features).toHaveProperty('correlation_to_spy_20d');
	}, 10000);

	it('should throw error on insufficient historical data', async () => {
		// Override the mock to return insufficient data
		(extractor as any).financialDataService.getHistoricalOHLC = jest.fn().mockResolvedValue([]);

		await expect(extractor.extractFeatures('INVALID', new Date()))
			.rejects.toThrow('Insufficient historical data');
	}, 10000);
});
