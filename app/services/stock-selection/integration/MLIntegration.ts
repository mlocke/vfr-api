/**
 * ML Integration Module
 * Handles all ML service integrations for stock selection
 * Extracted from StockSelectionService to reduce file size and improve maintainability
 */

import { MLPredictionService } from "../../ml/prediction/MLPredictionService";
import { EarlySignalService } from "../../ml/early-signal/EarlySignalService";
import { EarlySignalPrediction } from "../../ml/early-signal/types";
import { PricePredictionService, PricePrediction } from "../../ml/price-prediction/PricePredictionService";
import { SentimentFusionService } from "../../ml/sentiment-fusion/SentimentFusionService";
import { PricePrediction as SentimentFusionPrediction } from "../../ml/sentiment-fusion/types";
import { SelectionOptions } from "../types";
import { ProgressTracker } from "../../progress/ProgressTracker";

/**
 * ML predictions result interface
 */
export interface MLPredictions {
	earlySignal?: EarlySignalPrediction;
	pricePrediction?: PricePrediction;
	sentimentFusion?: SentimentFusionPrediction;
	smartMoneyFlow?: any;
	volatilityPrediction?: any; // Volatility prediction for risk management
}

/**
 * MLIntegration class
 * Centralizes all ML service calls and predictions
 */
export class MLIntegration {
	private mlPredictionService?: MLPredictionService;

	constructor(mlPredictionService?: MLPredictionService) {
		this.mlPredictionService = mlPredictionService;
	}

	/**
	 * Get all ML predictions for a symbol based on request options
	 */
	async getMLPredictions(
		symbol: string,
		sector: string,
		options?: SelectionOptions,
		progressTracker?: ProgressTracker
	): Promise<MLPredictions> {
		const predictions: MLPredictions = {};

		// Skip legacy individual ML services if using ensemble predictions (include_ml=true)
		// The MLEnhancedStockSelectionService will handle all ML via predictEnsemble()
		const useEnsemblePredictions = options?.include_ml === true;

		// Early Signal Detection (ESD) - ML analyst rating predictions
		if (options?.includeEarlySignal && !useEnsemblePredictions) {
			predictions.earlySignal = await this.getEarlySignalPrediction(symbol, sector);
		}

		// Price Prediction - ML price movement predictions
		if (options?.includePricePrediction && !useEnsemblePredictions) {
			predictions.pricePrediction = await this.getPricePrediction(symbol, sector);
		}

		// Sentiment-Fusion - ML 3-day price direction predictions
		if (options?.includeSentimentFusion && !useEnsemblePredictions) {
			predictions.sentimentFusion = await this.getSentimentFusion(symbol);
		}

		// Smart Money Flow - Institutional/insider activity analysis
		// NOTE: Smart Money Flow runs independently - it's NOT part of the ensemble
		// It should run whenever the toggle is enabled, regardless of include_ml
		if (options?.includeSmartMoneyFlow) {
			predictions.smartMoneyFlow = await this.getSmartMoneyFlow(symbol, progressTracker);
		}

		// Volatility Prediction - Risk management and volatility forecasting
		// NOTE: Volatility Prediction runs independently like Smart Money Flow
		// It should run whenever the toggle is enabled, regardless of include_ml
		if (options?.includeVolatilityPrediction) {
			predictions.volatilityPrediction = await this.getVolatilityPrediction(symbol, progressTracker);
		}

		return predictions;
	}

	/**
	 * Get Early Signal Detection prediction
	 * ML analyst rating predictions
	 */
	async getEarlySignalPrediction(
		symbol: string,
		sector: string
	): Promise<EarlySignalPrediction | undefined> {
		try {
			console.log(`🚀 Starting ESD prediction for ${symbol}...`);
			const esdService = new EarlySignalService();
			const prediction = await esdService.predictAnalystChange(symbol, sector);
			console.log(`📊 ESD raw prediction for ${symbol}:`, prediction);

			if (prediction) {
				console.log(
					`🎯 Early Signal Detection completed for ${symbol}: ${prediction.upgrade_likely ? "UPGRADE" : "DOWNGRADE"} likely (${(prediction.confidence * 100).toFixed(1)}% confidence)`
				);
				return prediction;
			} else {
				console.warn(`⚠️ ESD returned null/undefined for ${symbol}`);
				return undefined;
			}
		} catch (error) {
			console.error(`❌ Early Signal Detection failed for ${symbol}:`, error);
			return undefined;
		}
	}

	/**
	 * Get Price Prediction
	 * ML price movement predictions
	 */
	async getPricePrediction(
		symbol: string,
		sector: string
	): Promise<PricePrediction | undefined> {
		try {
			console.log(`🚀 Starting Price Prediction for ${symbol}...`);
			const priceService = new PricePredictionService();
			const prediction = await priceService.predictPriceMovement(symbol, sector);
			console.log(`📊 Price Prediction raw result for ${symbol}:`, prediction);

			if (prediction) {
				console.log(
					`🎯 Price Prediction completed for ${symbol}: ${prediction.prediction} (${(prediction.confidence * 100).toFixed(1)}% confidence)`
				);
				return prediction;
			} else {
				console.warn(`⚠️ Price Prediction returned null/undefined for ${symbol}`);
				return undefined;
			}
		} catch (error) {
			console.error(`❌ Price Prediction failed for ${symbol}:`, error);
			return undefined;
		}
	}

	/**
	 * Get Sentiment-Fusion prediction
	 * ML 3-day price direction predictions
	 */
	async getSentimentFusion(symbol: string): Promise<SentimentFusionPrediction | undefined> {
		try {
			console.log(`🚀 Starting Sentiment-Fusion for ${symbol}...`);
			const sfService = new SentimentFusionService();
			const prediction = await sfService.predict(symbol);
			console.log(`📊 Sentiment-Fusion raw result for ${symbol}:`, prediction);

			if (prediction) {
				console.log(
					`🎯 Sentiment-Fusion completed for ${symbol}: ${prediction.direction} (${(prediction.confidence * 100).toFixed(1)}% confidence)`
				);
				return prediction;
			} else {
				console.warn(`⚠️ Sentiment-Fusion returned null/undefined for ${symbol}`);
				return undefined;
			}
		} catch (error) {
			console.error(`❌ Sentiment-Fusion failed for ${symbol}:`, error);
			return undefined;
		}
	}

	/**
	 * Get Smart Money Flow prediction
	 * Institutional/insider activity analysis
	 */
	async getSmartMoneyFlow(symbol: string, progressTracker?: ProgressTracker): Promise<any | undefined> {
		progressTracker?.startStage("smart_money_flow", `Analyzing institutional activity for ${symbol}...`);
		try {
			console.log(`🚀 Starting Smart Money Flow for ${symbol}...`);
			const { SmartMoneyFlowService } = await import("../../ml/smart-money-flow/SmartMoneyFlowService");
			const smfService = new SmartMoneyFlowService();
			const prediction = await smfService.predict(symbol);
			console.log(`📊 Smart Money Flow raw result for ${symbol}:`, prediction);

			if (prediction) {
				console.log(
					`🎯 Smart Money Flow completed for ${symbol}: ${prediction.action} (${(prediction.confidence * 100).toFixed(1)}% confidence)`
				);
				progressTracker?.completeStage("smart_money_flow", `Smart Money Flow analysis completed for ${symbol}`);
				return prediction;
			} else {
				console.warn(`⚠️ Smart Money Flow returned null/undefined for ${symbol}`);
				progressTracker?.completeStage("smart_money_flow", "Smart Money Flow completed - data unavailable");
				return undefined;
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`❌ Smart Money Flow failed for ${symbol}:`, errorMsg);

			// Check if it's a data availability issue
			if (errorMsg.includes('No institutional holdings')) {
				progressTracker?.completeStage("smart_money_flow", "Smart Money Flow unavailable (no data)");
			} else {
				progressTracker?.completeStage("smart_money_flow", "Smart Money Flow completed - analysis failed");
			}
			return undefined;
		}
	}

	/**
	 * Get Volatility Prediction
	 * 21-day forward realized volatility prediction for risk management
	 */
	async getVolatilityPrediction(symbol: string, progressTracker?: ProgressTracker): Promise<any | undefined> {
		progressTracker?.startStage("volatility_prediction", `Predicting volatility for ${symbol}...`);
		try {
			console.log(`🚀 Starting Volatility Prediction for ${symbol}...`);
			const { VolatilityPredictionService } = await import("../../ml/volatility-prediction/VolatilityPredictionService");
			const volatilityService = VolatilityPredictionService.getInstance();

			// Note: VolatilityPredictionService requires features, but we'll handle that gracefully
			// For now, it will return null if features aren't available
			const prediction = await volatilityService.predict(symbol).catch(err => {
				// If feature extraction not implemented, gracefully handle
				if (err.message.includes('Feature extraction not yet implemented')) {
					console.warn(`⚠️ Volatility features not available for ${symbol}`);
					return null;
				}
				throw err;
			});

			console.log(`📊 Volatility Prediction raw result for ${symbol}:`, prediction);

			if (prediction) {
				console.log(
					`🎯 Volatility Prediction completed for ${symbol}: ${prediction.predicted_volatility.toFixed(1)}% (${prediction.confidence_level} confidence, ${prediction.risk_category} risk)`
				);
				progressTracker?.completeStage("volatility_prediction", `Volatility Prediction completed for ${symbol}`);
				return prediction;
			} else {
				console.warn(`⚠️ Volatility Prediction returned null for ${symbol}`);
				progressTracker?.completeStage("volatility_prediction", "Volatility Prediction completed - features unavailable");
				return undefined;
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`❌ Volatility Prediction failed for ${symbol}:`, errorMsg);

			// Check if it's a feature availability issue
			if (errorMsg.includes('features')) {
				progressTracker?.completeStage("volatility_prediction", "Volatility Prediction unavailable (no features)");
			} else {
				progressTracker?.completeStage("volatility_prediction", "Volatility Prediction completed - analysis failed");
			}
			return undefined;
		}
	}

	/**
	 * Add ML prediction insights to primary factors array
	 */
	addMLInsightsToPrimaryFactors(
		primaryFactors: string[],
		predictions: MLPredictions
	): void {
		// Add price prediction insights
		if (predictions.pricePrediction) {
			primaryFactors.push(
				`ML predicts ${predictions.pricePrediction.prediction} movement (${(predictions.pricePrediction.confidence * 100).toFixed(0)}% confidence)`
			);
			// Add top reasoning if available
			if (predictions.pricePrediction.reasoning && predictions.pricePrediction.reasoning.length > 0) {
				predictions.pricePrediction.reasoning.slice(0, 2).forEach(reason => {
					primaryFactors.push(reason);
				});
			}
		}

		// Add sentiment-fusion insights
		if (predictions.sentimentFusion) {
			primaryFactors.push(
				`Sentiment-Fusion predicts ${predictions.sentimentFusion.direction} (${(predictions.sentimentFusion.confidence * 100).toFixed(0)}% confidence)`
			);
			// Add top reasoning if available
			if (predictions.sentimentFusion.reasoning && predictions.sentimentFusion.reasoning.length > 0) {
				predictions.sentimentFusion.reasoning.slice(0, 2).forEach(reason => {
					primaryFactors.push(reason);
				});
			}
		}

		// Add smart money flow insights
		if (predictions.smartMoneyFlow) {
			primaryFactors.push(
				`Smart Money ${predictions.smartMoneyFlow.action} signal (${(predictions.smartMoneyFlow.confidence * 100).toFixed(0)}% confidence)`
			);
			// Add reasoning if available
			if (predictions.smartMoneyFlow.reasoning) {
				primaryFactors.push(predictions.smartMoneyFlow.reasoning);
			}
		}
	}
}
