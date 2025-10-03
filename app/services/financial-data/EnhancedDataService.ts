/**
 * Enhanced Data Service - Replaces FinancialDataService with centralized source management
 * Provides complete control over data source selection for all data types
 */

import { DataSourceManager, DataType, DataSourceProvider } from "./DataSourceManager";
import { OptionsDataService } from "./OptionsDataService";
import {
	StockData,
	CompanyInfo,
	FinancialDataProvider,
	OptionsContract,
	OptionsChain,
	PutCallRatio,
	OptionsAnalysis,
} from "./types";

export class EnhancedDataService implements FinancialDataProvider {
	name = "Enhanced Data Service";
	private dataSourceManager: DataSourceManager;
	private optionsService: OptionsDataService;

	constructor() {
		this.dataSourceManager = new DataSourceManager();
		this.optionsService = new OptionsDataService();
	}

	/**
	 * Get stock price using configured preferences
	 */
	async getStockPrice(symbol: string): Promise<StockData | null> {
		return await this.dataSourceManager.getStockPrice(symbol);
	}

	/**
	 * Get company information using configured preferences
	 */
	async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
		return await this.dataSourceManager.getCompanyInfo(symbol);
	}

	/**
	 * Get market data using configured preferences
	 */
	async getMarketData(symbol: string): Promise<import("./types").MarketData | null> {
		// For now, return null as DataSourceManager doesn't implement this yet
		// This method will be implemented when DataSourceManager is extended with market data support
		console.warn("getMarketData not yet implemented in DataSourceManager");
		return null;
	}

	/**
	 * Get options chain using configured preferences
	 */
	async getOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
		return await this.optionsService.getOptionsChain(symbol, expiration);
	}

	/**
	 * Get put/call ratio using configured preferences
	 */
	async getPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
		return await this.optionsService.getPutCallRatio(symbol);
	}

	/**
	 * Get options analysis using configured preferences
	 */
	async getOptionsAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
		return await this.optionsService.getOptionsAnalysis(symbol);
	}

	/**
	 * Set data source preference for specific data type
	 */
	setDataSourcePreference(
		dataType: DataType,
		primary: DataSourceProvider,
		fallbacks?: DataSourceProvider[]
	): void {
		this.dataSourceManager.setDataSourcePreference(dataType, primary, fallbacks);
	}

	/**
	 * Switch stock price provider
	 */
	setStockPriceProvider(provider: DataSourceProvider, fallbacks?: DataSourceProvider[]): void {
		this.setDataSourcePreference("stock_price", provider, fallbacks);
	}

	/**
	 * Switch company info provider
	 */
	setCompanyInfoProvider(provider: DataSourceProvider, fallbacks?: DataSourceProvider[]): void {
		this.setDataSourcePreference("company_info", provider, fallbacks);
	}

	/**
	 * Get options provider info (EODHD only)
	 */
	getOptionsProviderInfo() {
		return this.optionsService.getProviderInfo();
	}

	/**
	 * Switch fundamentals data provider
	 */
	setFundamentalsProvider(provider: DataSourceProvider, fallbacks?: DataSourceProvider[]): void {
		this.setDataSourcePreference("fundamentals", provider, fallbacks);
	}

	/**
	 * Switch economic data provider
	 */
	setEconomicDataProvider(provider: DataSourceProvider, fallbacks?: DataSourceProvider[]): void {
		this.setDataSourcePreference("economic_data", provider, fallbacks);
	}

	/**
	 * Enable/disable specific providers
	 */
	setProviderEnabled(provider: DataSourceProvider, enabled: boolean): void {
		this.dataSourceManager.setProviderEnabled(provider, enabled);
	}

	/**
	 * Get current data source preferences
	 */
	getDataSourcePreferences() {
		return this.dataSourceManager.getDataSourcePreferences();
	}

	/**
	 * Get provider configurations
	 */
	getProviderConfigs() {
		return this.dataSourceManager.getProviderConfigs();
	}

	/**
	 * Get comprehensive service status
	 */
	async getServiceStatus() {
		return await this.dataSourceManager.getServiceStatus();
	}

	/**
	 * Reset all preferences to defaults
	 */
	resetToDefaults(): void {
		this.dataSourceManager.resetToDefaults();
	}

	/**
	 * Health check for the service
	 */
	async healthCheck(): Promise<boolean> {
		try {
			// Quick health check - try to get a stock price
			const result = await this.getStockPrice("AAPL");
			return result !== null;
		} catch (error) {
			console.error("EnhancedDataService health check failed:", error);
			return false;
		}
	}

	/**
	 * Batch configuration for common scenarios
	 */

	/**
	 * Configure for free-tier usage (prioritize FMP with EODHD fallback)
	 */
	configureForFreeTier(): void {
		this.setStockPriceProvider("fmp", ["eodhd"]);
		this.setCompanyInfoProvider("fmp", ["eodhd"]);
		this.setFundamentalsProvider("fmp", ["eodhd"]);

		console.log("🆓 Configured for FMP primary, EODHD fallback");
	}

	/**
	 * Configure for premium usage (FMP primary, EODHD fallback)
	 */
	configureForPremium(): void {
		this.setStockPriceProvider("fmp", ["eodhd"]);
		this.setCompanyInfoProvider("fmp", ["eodhd"]);
		this.setFundamentalsProvider("fmp", ["eodhd"]);

		// Enable all providers
		Object.keys(this.getProviderConfigs()).forEach(provider => {
			this.setProviderEnabled(provider as DataSourceProvider, true);
		});

		console.log("💎 Configured for FMP primary, EODHD fallback");
	}

	/**
	 * Configure for development (FMP primary, EODHD fallback)
	 */
	configureForDevelopment(): void {
		this.setStockPriceProvider("fmp", ["eodhd"]);
		this.setCompanyInfoProvider("fmp", ["eodhd"]);
		this.setFundamentalsProvider("fmp", ["eodhd"]);

		console.log("🔧 Configured for FMP primary, EODHD fallback (development)");
	}

	/**
	 * Get switching recommendations based on current usage
	 */
	async getSwitchingRecommendations(): Promise<{
		costOptimization: string[];
		qualityImprovement: string[];
		reliabilityImprovement: string[];
	}> {
		const status = await this.getServiceStatus();
		const configs = this.getProviderConfigs();

		const costOptimization: string[] = [];
		const qualityImprovement: string[] = [];
		const reliabilityImprovement: string[] = [];

		// Analyze current configuration
		const preferences = this.getDataSourcePreferences();

		// Check for cost optimization opportunities
		Object.entries(preferences).forEach(([dataType, pref]) => {
			const currentProvider = configs[pref.primary];
			if (currentProvider?.costTier === "paid" || currentProvider?.costTier === "premium") {
				const freeAlternatives = pref.fallbacks.filter(
					f => configs[f]?.costTier === "free" && configs[f]?.enabled
				);
				if (freeAlternatives.length > 0) {
					costOptimization.push(
						`💰 Switch ${dataType} from ${pref.primary} to ${freeAlternatives[0]} for cost savings`
					);
				}
			}
		});

		// Check for quality improvement opportunities
		Object.entries(preferences).forEach(([dataType, pref]) => {
			const currentProvider = configs[pref.primary];
			const betterProviders = Object.entries(configs).filter(
				([provider, config]) =>
					config.dataQuality > (currentProvider?.dataQuality || 0) &&
					config.supportedDataTypes.includes(dataType as DataType) &&
					config.enabled
			);
			if (betterProviders.length > 0) {
				qualityImprovement.push(
					`📈 Switch ${dataType} from ${pref.primary} to ${betterProviders[0][0]} for better data quality`
				);
			}
		});

		// Check for reliability improvements
		Object.entries(status.providerStatus).forEach(([provider, status]) => {
			if (!status.available && configs[provider as DataSourceProvider]?.enabled) {
				reliabilityImprovement.push(
					`⚠️ Provider ${provider} is currently unavailable - consider switching primary data sources`
				);
			}
		});

		return {
			costOptimization,
			qualityImprovement,
			reliabilityImprovement,
		};
	}
}
