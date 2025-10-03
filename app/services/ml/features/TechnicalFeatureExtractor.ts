/**
 * TechnicalFeatureExtractor
 *
 * Extracts advanced technical features for ML models including:
 * - Momentum features (1d, 5d, 20d price momentum)
 * - Volatility features (realized volatility, z-scores)
 * - Mean reversion features (price z-score, volume z-score)
 *
 * This service complements TechnicalFeatureIntegrator by providing additional
 * derived features that are specifically useful for ML model prediction.
 *
 * Performance Target: <100ms per symbol
 */

import type { OHLCData } from "../../technical-analysis/types";

/**
 * Advanced momentum features
 */
export interface MomentumFeatures {
	// Price momentum
	momentum1d: number; // 1-day price change (%)
	momentum5d: number; // 5-day price change (%)
	momentum20d: number; // 20-day price change (%)

	// Velocity (rate of change of momentum)
	momentumVelocity1d: number;
	momentumVelocity5d: number;

	// Acceleration (rate of change of velocity)
	momentumAcceleration: number;
}

/**
 * Advanced volatility features
 */
export interface VolatilityFeatures {
	// Realized volatility
	realizedVol5d: number; // 5-day realized volatility (annualized)
	realizedVol20d: number; // 20-day realized volatility (annualized)
	realizedVol60d: number; // 60-day realized volatility (annualized)

	// Z-scores
	priceVolZScore: number; // Price volatility z-score (vs 60-day average)
	volumeVolZScore: number; // Volume volatility z-score (vs 60-day average)

	// Volatility regime
	volRegime: number; // 0 = low, 0.5 = medium, 1 = high
}

/**
 * Mean reversion features
 */
export interface MeanReversionFeatures {
	// Price z-scores (distance from mean in std devs)
	priceZScore5d: number; // vs 5-day SMA
	priceZScore20d: number; // vs 20-day SMA
	priceZScore60d: number; // vs 60-day SMA

	// Volume z-scores
	volumeZScore5d: number; // vs 5-day average
	volumeZScore20d: number; // vs 20-day average

	// Reversion signals
	overextended: number; // 0 = no, 0.5 = moderate, 1 = extreme (|z| > 2)
	reversionProbability: number; // Probability of mean reversion (0-1)
}

/**
 * Complete set of advanced technical features
 */
export interface AdvancedTechnicalFeatures {
	symbol: string;
	timestamp: number;
	momentum: MomentumFeatures;
	volatility: VolatilityFeatures;
	meanReversion: MeanReversionFeatures;
}

/**
 * TechnicalFeatureExtractor - Advanced feature extraction for ML
 */
export class TechnicalFeatureExtractor {
	/**
	 * Extract all advanced technical features
	 */
	static extractFeatures(symbol: string, ohlcData: OHLCData[]): AdvancedTechnicalFeatures {
		const startTime = Date.now();

		const momentum = this.extractMomentumFeatures(ohlcData);
		const volatility = this.extractVolatilityFeatures(ohlcData);
		const meanReversion = this.extractMeanReversionFeatures(ohlcData);

		const calculationTime = Date.now() - startTime;

		if (calculationTime > 100) {
			console.warn(
				`Advanced feature extraction for ${symbol} took ${calculationTime}ms (target: <100ms)`
			);
		}

		return {
			symbol,
			timestamp: Date.now(),
			momentum,
			volatility,
			meanReversion,
		};
	}

	/**
	 * Extract momentum features
	 */
	static extractMomentumFeatures(ohlcData: OHLCData[]): MomentumFeatures {
		if (ohlcData.length < 21) {
			return this.getDefaultMomentumFeatures();
		}

		const currentPrice = ohlcData[ohlcData.length - 1].close;

		// Price momentum (percentage changes)
		const price1d = ohlcData[ohlcData.length - 2]?.close || currentPrice;
		const momentum1d = price1d > 0 ? (currentPrice - price1d) / price1d : 0;

		const price5d = ohlcData[ohlcData.length - 6]?.close || currentPrice;
		const momentum5d = price5d > 0 ? (currentPrice - price5d) / price5d : 0;

		const price20d = ohlcData[ohlcData.length - 21]?.close || currentPrice;
		const momentum20d = price20d > 0 ? (currentPrice - price20d) / price20d : 0;

		// Momentum velocity (change in momentum)
		const price2d = ohlcData[ohlcData.length - 3]?.close || currentPrice;
		const prevMomentum1d = price2d > 0 ? (price1d - price2d) / price2d : 0;
		const momentumVelocity1d = momentum1d - prevMomentum1d;

		const price10d = ohlcData[ohlcData.length - 11]?.close || currentPrice;
		const prevMomentum5d = price10d > 0 ? (price5d - price10d) / price10d : 0;
		const momentumVelocity5d = momentum5d - prevMomentum5d;

		// Momentum acceleration (change in velocity)
		const momentumAcceleration = momentumVelocity1d - momentumVelocity5d / 5;

		return {
			momentum1d,
			momentum5d,
			momentum20d,
			momentumVelocity1d,
			momentumVelocity5d,
			momentumAcceleration,
		};
	}

	/**
	 * Extract volatility features
	 */
	static extractVolatilityFeatures(ohlcData: OHLCData[]): VolatilityFeatures {
		if (ohlcData.length < 61) {
			return this.getDefaultVolatilityFeatures();
		}

		// Calculate realized volatilities
		const realizedVol5d = this.calculateRealizedVolatility(ohlcData, 5);
		const realizedVol20d = this.calculateRealizedVolatility(ohlcData, 20);
		const realizedVol60d = this.calculateRealizedVolatility(ohlcData, 60);

		// Price volatility z-score
		const volValues = [];
		for (let i = 0; i < 60; i++) {
			const startIdx = Math.max(0, ohlcData.length - 60 + i - 20);
			const endIdx = ohlcData.length - 60 + i;
			if (endIdx > startIdx) {
				const vol = this.calculateRealizedVolatility(
					ohlcData.slice(startIdx, endIdx),
					Math.min(20, endIdx - startIdx)
				);
				volValues.push(vol);
			}
		}

		const volMean = volValues.reduce((a, b) => a + b, 0) / volValues.length;
		const volStd = Math.sqrt(
			volValues.reduce((sum, v) => sum + Math.pow(v - volMean, 2), 0) / volValues.length
		);
		const priceVolZScore = volStd > 0 ? (realizedVol20d - volMean) / volStd : 0;

		// Volume volatility z-score
		const volumeStds = [];
		for (let i = 0; i < 60; i++) {
			const startIdx = Math.max(0, ohlcData.length - 60 + i - 20);
			const endIdx = ohlcData.length - 60 + i;
			if (endIdx > startIdx) {
				const volumeSlice = ohlcData.slice(startIdx, endIdx).map(d => d.volume);
				const volMean = volumeSlice.reduce((a, b) => a + b, 0) / volumeSlice.length;
				const volStd = Math.sqrt(
					volumeSlice.reduce((sum, v) => sum + Math.pow(v - volMean, 2), 0) /
						volumeSlice.length
				);
				volumeStds.push(volStd);
			}
		}

		const recentVolumes = ohlcData.slice(-20).map(d => d.volume);
		const recentVolMean = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
		const recentVolStd = Math.sqrt(
			recentVolumes.reduce((sum, v) => sum + Math.pow(v - recentVolMean, 2), 0) /
				recentVolumes.length
		);

		const volStdMean = volumeStds.reduce((a, b) => a + b, 0) / volumeStds.length;
		const volStdStd = Math.sqrt(
			volumeStds.reduce((sum, v) => sum + Math.pow(v - volStdMean, 2), 0) / volumeStds.length
		);
		const volumeVolZScore = volStdStd > 0 ? (recentVolStd - volStdMean) / volStdStd : 0;

		// Volatility regime classification
		let volRegime = 0.5; // medium
		if (priceVolZScore > 1.0) {
			volRegime = 1.0; // high
		} else if (priceVolZScore < -1.0) {
			volRegime = 0.0; // low
		} else {
			// Linear interpolation between low and high
			volRegime = 0.5 + priceVolZScore * 0.25;
		}

		return {
			realizedVol5d,
			realizedVol20d,
			realizedVol60d,
			priceVolZScore,
			volumeVolZScore,
			volRegime,
		};
	}

	/**
	 * Extract mean reversion features
	 */
	static extractMeanReversionFeatures(ohlcData: OHLCData[]): MeanReversionFeatures {
		if (ohlcData.length < 61) {
			return this.getDefaultMeanReversionFeatures();
		}

		const currentPrice = ohlcData[ohlcData.length - 1].close;
		const currentVolume = ohlcData[ohlcData.length - 1].volume;

		// Price z-scores
		const { zScore: priceZScore5d } = this.calculateZScore(ohlcData, 5, "price");
		const { zScore: priceZScore20d } = this.calculateZScore(ohlcData, 20, "price");
		const { zScore: priceZScore60d } = this.calculateZScore(ohlcData, 60, "price");

		// Volume z-scores
		const { zScore: volumeZScore5d } = this.calculateZScore(ohlcData, 5, "volume");
		const { zScore: volumeZScore20d } = this.calculateZScore(ohlcData, 20, "volume");

		// Overextended signal (absolute z-score > 2)
		const maxZScore = Math.max(
			Math.abs(priceZScore5d),
			Math.abs(priceZScore20d),
			Math.abs(priceZScore60d)
		);

		let overextended = 0;
		if (maxZScore > 2.5) {
			overextended = 1.0; // extreme
		} else if (maxZScore > 1.5) {
			overextended = 0.5; // moderate
		}

		// Mean reversion probability (higher when more overextended)
		// Uses sigmoid-like function
		const reversionProbability = this.calculateReversionProbability(
			priceZScore20d,
			volumeZScore20d
		);

		return {
			priceZScore5d,
			priceZScore20d,
			priceZScore60d,
			volumeZScore5d,
			volumeZScore20d,
			overextended,
			reversionProbability,
		};
	}

	/**
	 * Calculate realized volatility (annualized)
	 */
	private static calculateRealizedVolatility(ohlcData: OHLCData[], periods: number): number {
		if (ohlcData.length < periods + 1) {
			return 0.25; // Default volatility
		}

		// Calculate log returns
		const returns: number[] = [];
		const startIdx = Math.max(0, ohlcData.length - periods - 1);

		for (let i = startIdx + 1; i < ohlcData.length; i++) {
			const prevClose = ohlcData[i - 1]?.close;
			const currClose = ohlcData[i]?.close;
			if (prevClose && currClose && prevClose > 0) {
				returns.push(Math.log(currClose / prevClose));
			}
		}

		if (returns.length === 0) {
			return 0.25;
		}

		// Calculate standard deviation of returns
		const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
		const variance =
			returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
		const stdDev = Math.sqrt(variance);

		// Annualize (252 trading days)
		return stdDev * Math.sqrt(252);
	}

	/**
	 * Calculate z-score for price or volume
	 */
	private static calculateZScore(
		ohlcData: OHLCData[],
		periods: number,
		type: "price" | "volume"
	): { zScore: number; mean: number; stdDev: number } {
		if (ohlcData.length < periods + 1) {
			return { zScore: 0, mean: 0, stdDev: 0 };
		}

		const values =
			type === "price"
				? ohlcData.slice(-periods - 1, -1).map(d => d.close)
				: ohlcData.slice(-periods - 1, -1).map(d => d.volume);

		const currentValue =
			type === "price"
				? ohlcData[ohlcData.length - 1].close
				: ohlcData[ohlcData.length - 1].volume;

		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
		const stdDev = Math.sqrt(variance);

		const zScore = stdDev > 0 ? (currentValue - mean) / stdDev : 0;

		return { zScore, mean, stdDev };
	}

	/**
	 * Calculate mean reversion probability
	 * Higher when price is far from mean and volume confirms
	 */
	private static calculateReversionProbability(
		priceZScore: number,
		volumeZScore: number
	): number {
		// Base probability from price z-score (sigmoid function)
		const baseProbability = 1 / (1 + Math.exp(-Math.abs(priceZScore)));

		// Volume confirmation boost (higher volume = higher confidence)
		const volumeBoost = volumeZScore > 0.5 ? 0.1 : 0;

		// Extreme overextension boost
		const extremeBoost = Math.abs(priceZScore) > 2.5 ? 0.15 : 0;

		const totalProbability = Math.min(baseProbability + volumeBoost + extremeBoost, 1.0);

		return totalProbability;
	}

	/**
	 * Convert advanced features to flat feature map for ML models
	 */
	static flattenFeatures(features: AdvancedTechnicalFeatures): Record<string, number> {
		return {
			// Momentum
			adv_momentum_1d: features.momentum.momentum1d,
			adv_momentum_5d: features.momentum.momentum5d,
			adv_momentum_20d: features.momentum.momentum20d,
			adv_momentum_velocity_1d: features.momentum.momentumVelocity1d,
			adv_momentum_velocity_5d: features.momentum.momentumVelocity5d,
			adv_momentum_acceleration: features.momentum.momentumAcceleration,

			// Volatility
			adv_vol_5d: features.volatility.realizedVol5d,
			adv_vol_20d: features.volatility.realizedVol20d,
			adv_vol_60d: features.volatility.realizedVol60d,
			adv_price_vol_zscore: features.volatility.priceVolZScore,
			adv_volume_vol_zscore: features.volatility.volumeVolZScore,
			adv_vol_regime: features.volatility.volRegime,

			// Mean Reversion
			adv_price_zscore_5d: features.meanReversion.priceZScore5d,
			adv_price_zscore_20d: features.meanReversion.priceZScore20d,
			adv_price_zscore_60d: features.meanReversion.priceZScore60d,
			adv_volume_zscore_5d: features.meanReversion.volumeZScore5d,
			adv_volume_zscore_20d: features.meanReversion.volumeZScore20d,
			adv_overextended: features.meanReversion.overextended,
			adv_reversion_probability: features.meanReversion.reversionProbability,
		};
	}

	/**
	 * Default momentum features
	 */
	private static getDefaultMomentumFeatures(): MomentumFeatures {
		return {
			momentum1d: 0,
			momentum5d: 0,
			momentum20d: 0,
			momentumVelocity1d: 0,
			momentumVelocity5d: 0,
			momentumAcceleration: 0,
		};
	}

	/**
	 * Default volatility features
	 */
	private static getDefaultVolatilityFeatures(): VolatilityFeatures {
		return {
			realizedVol5d: 0.25,
			realizedVol20d: 0.25,
			realizedVol60d: 0.25,
			priceVolZScore: 0,
			volumeVolZScore: 0,
			volRegime: 0.5,
		};
	}

	/**
	 * Default mean reversion features
	 */
	private static getDefaultMeanReversionFeatures(): MeanReversionFeatures {
		return {
			priceZScore5d: 0,
			priceZScore20d: 0,
			priceZScore60d: 0,
			volumeZScore5d: 0,
			volumeZScore20d: 0,
			overextended: 0,
			reversionProbability: 0.5,
		};
	}
}
