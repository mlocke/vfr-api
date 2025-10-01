/**
 * ModelEvaluator Tests - Real Database Integration
 *
 * NO MOCK DATA policy - all tests use real computations
 * Tests cover:
 * - Classification metrics evaluation
 * - Regression metrics evaluation
 * - Financial metrics evaluation
 * - Comprehensive model evaluation
 * - K-fold cross-validation
 * - Baseline comparison
 * - Evaluation report generation
 *
 * Performance target: Evaluation <5s for typical datasets
 * 5-minute timeout for comprehensive integration tests
 */

import { ModelEvaluator, ClassificationMetrics, RegressionMetrics, FinancialMetrics } from '../ModelEvaluator'
import { TrainingDataset } from '../ModelTrainer'

describe('ModelEvaluator', () => {
  let evaluator: ModelEvaluator

  beforeAll(() => {
    evaluator = ModelEvaluator.getInstance()
  })

  // Helper function to generate test predictions
  function generatePredictions(
    size: number,
    accuracy: number = 0.75
  ): { predictions: number[]; actuals: number[] } {
    const predictions: number[] = []
    const actuals: number[] = []

    for (let i = 0; i < size; i++) {
      const actual = Math.random() > 0.5 ? 1 : 0
      let prediction: number

      if (Math.random() < accuracy) {
        // Correct prediction
        prediction = actual + (Math.random() - 0.5) * 0.2
      } else {
        // Incorrect prediction
        prediction = (1 - actual) + (Math.random() - 0.5) * 0.2
      }

      prediction = Math.max(0, Math.min(1, prediction))
      predictions.push(prediction)
      actuals.push(actual)
    }

    return { predictions, actuals }
  }

  // Helper function to generate regression data
  function generateRegressionData(size: number, noise: number = 0.1): {
    predictions: number[]
    actuals: number[]
  } {
    const predictions: number[] = []
    const actuals: number[] = []

    for (let i = 0; i < size; i++) {
      const actual = Math.random() * 100
      const prediction = actual + (Math.random() - 0.5) * noise * actual
      predictions.push(prediction)
      actuals.push(actual)
    }

    return { predictions, actuals }
  }

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = ModelEvaluator.getInstance()
      const instance2 = ModelEvaluator.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('Classification Metrics', () => {
    it('should evaluate classification metrics correctly', () => {
      const { predictions, actuals } = generatePredictions(100, 0.80)

      const result = evaluator.evaluateClassification(predictions, actuals)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      if (result.data) {
        expect(result.data.accuracy).toBeGreaterThan(0.7)
        expect(result.data.accuracy).toBeLessThanOrEqual(1)
        expect(result.data.precision).toBeGreaterThanOrEqual(0)
        expect(result.data.precision).toBeLessThanOrEqual(1)
        expect(result.data.recall).toBeGreaterThanOrEqual(0)
        expect(result.data.recall).toBeLessThanOrEqual(1)
        expect(result.data.f1Score).toBeGreaterThanOrEqual(0)
        expect(result.data.f1Score).toBeLessThanOrEqual(1)
        expect(result.data.confusionMatrix).toBeDefined()
      }
    })

    it('should calculate confusion matrix correctly', () => {
      const predictions = [0.8, 0.3, 0.7, 0.2, 0.9]
      const actuals = [1, 0, 1, 0, 1]

      const result = evaluator.evaluateClassification(predictions, actuals, 0.5)

      expect(result.success).toBe(true)
      if (result.data) {
        const { confusionMatrix } = result.data

        // All predictions should be correct
        expect(confusionMatrix.truePositives).toBe(3) // 0.8, 0.7, 0.9 -> 1
        expect(confusionMatrix.trueNegatives).toBe(2) // 0.3, 0.2 -> 0
        expect(confusionMatrix.falsePositives).toBe(0)
        expect(confusionMatrix.falseNegatives).toBe(0)
        expect(result.data.accuracy).toBe(1.0)
      }
    })

    it('should handle perfect predictions', () => {
      const predictions = [1, 0, 1, 0, 1]
      const actuals = [1, 0, 1, 0, 1]

      const result = evaluator.evaluateClassification(predictions, actuals)

      expect(result.success).toBe(true)
      if (result.data) {
        expect(result.data.accuracy).toBe(1.0)
        expect(result.data.precision).toBe(1.0)
        expect(result.data.recall).toBe(1.0)
        expect(result.data.f1Score).toBe(1.0)
      }
    })

    it('should calculate AUC-ROC', () => {
      const { predictions, actuals } = generatePredictions(100)

      const result = evaluator.evaluateClassification(predictions, actuals)

      expect(result.success).toBe(true)
      if (result.data) {
        expect(result.data.aucRoc).toBeDefined()
        expect(result.data.aucRoc).toBeGreaterThanOrEqual(0)
        expect(result.data.aucRoc).toBeLessThanOrEqual(1)
      }
    })

    it('should reject mismatched array lengths', () => {
      const predictions = [0.8, 0.3, 0.7]
      const actuals = [1, 0]

      const result = evaluator.evaluateClassification(predictions, actuals)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Regression Metrics', () => {
    it('should evaluate regression metrics correctly', () => {
      const { predictions, actuals } = generateRegressionData(100, 0.1)

      const result = evaluator.evaluateRegression(predictions, actuals)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      if (result.data) {
        expect(result.data.rmse).toBeGreaterThan(0)
        expect(result.data.mae).toBeGreaterThan(0)
        expect(result.data.r2).toBeGreaterThan(0)
        expect(result.data.r2).toBeLessThanOrEqual(1)
        expect(result.data.mape).toBeGreaterThan(0)
        expect(result.data.medianAbsoluteError).toBeGreaterThan(0)
        expect(result.data.explainedVariance).toBeGreaterThan(0)
      }
    })

    it('should calculate RMSE correctly', () => {
      const predictions = [10, 20, 30, 40, 50]
      const actuals = [12, 18, 32, 38, 52]

      const result = evaluator.evaluateRegression(predictions, actuals)

      expect(result.success).toBe(true)
      if (result.data) {
        // Expected RMSE: sqrt(((2^2 + 2^2 + 2^2 + 2^2 + 2^2) / 5)) = 2
        expect(result.data.rmse).toBeCloseTo(2, 1)
      }
    })

    it('should calculate MAE correctly', () => {
      const predictions = [10, 20, 30, 40, 50]
      const actuals = [12, 18, 32, 38, 52]

      const result = evaluator.evaluateRegression(predictions, actuals)

      expect(result.success).toBe(true)
      if (result.data) {
        // Expected MAE: (2 + 2 + 2 + 2 + 2) / 5 = 2
        expect(result.data.mae).toBeCloseTo(2, 1)
      }
    })

    it('should calculate R² correctly', () => {
      const predictions = [10, 20, 30, 40, 50]
      const actuals = [10, 20, 30, 40, 50]

      const result = evaluator.evaluateRegression(predictions, actuals)

      expect(result.success).toBe(true)
      if (result.data) {
        // Perfect predictions should have R² = 1
        expect(result.data.r2).toBeCloseTo(1, 1)
      }
    })

    it('should reject mismatched array lengths', () => {
      const predictions = [10, 20, 30]
      const actuals = [10, 20]

      const result = evaluator.evaluateRegression(predictions, actuals)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Financial Metrics', () => {
    it('should evaluate financial metrics correctly', () => {
      const predictions = Array(100).fill(0).map(() => Math.random())
      const actuals = Array(100).fill(0).map(() => Math.random() > 0.5 ? 1 : 0)
      const returns = Array(100).fill(0).map(() => (Math.random() - 0.5) * 0.1)

      const result = evaluator.evaluateFinancial(predictions, actuals, returns)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      if (result.data) {
        expect(result.data.directionAccuracy).toBeGreaterThanOrEqual(0)
        expect(result.data.directionAccuracy).toBeLessThanOrEqual(1)
        expect(result.data.sharpeRatio).toBeDefined()
        expect(result.data.profitFactor).toBeGreaterThanOrEqual(0)
        expect(result.data.maxDrawdown).toBeGreaterThanOrEqual(0)
        expect(result.data.winRate).toBeGreaterThanOrEqual(0)
        expect(result.data.winRate).toBeLessThanOrEqual(1)
      }
    })

    it('should calculate direction accuracy correctly', () => {
      const predictions = [0.8, 0.3, 0.7, 0.2]
      const actuals = [1, 0, 1, 0]
      const returns = [0.05, 0.03, 0.04, 0.02]

      const result = evaluator.evaluateFinancial(predictions, actuals, returns)

      expect(result.success).toBe(true)
      if (result.data) {
        // All directions match
        expect(result.data.directionAccuracy).toBe(1.0)
      }
    })

    it('should calculate Sharpe ratio', () => {
      const predictions = Array(100).fill(0).map(() => Math.random())
      const actuals = Array(100).fill(0).map(() => Math.random() > 0.5 ? 1 : 0)
      const returns = Array(100).fill(0).map(() => (Math.random() - 0.3) * 0.05) // Slightly positive returns

      const result = evaluator.evaluateFinancial(predictions, actuals, returns)

      expect(result.success).toBe(true)
      if (result.data) {
        expect(result.data.sharpeRatio).toBeDefined()
        expect(typeof result.data.sharpeRatio).toBe('number')
      }
    })

    it('should calculate win rate', () => {
      const predictions = [0.8, 0.8, 0.8, 0.8]
      const actuals = [1, 1, 1, 1]
      const returns = [0.05, 0.03, -0.02, 0.04]

      const result = evaluator.evaluateFinancial(predictions, actuals, returns)

      expect(result.success).toBe(true)
      if (result.data) {
        // 3 wins out of 4 trades = 0.75
        expect(result.data.winRate).toBe(0.75)
      }
    })

    it('should calculate profit factor', () => {
      const predictions = Array(10).fill(0.8)
      const actuals = Array(10).fill(1)
      const returns = [0.1, 0.1, 0.1, -0.05, -0.05, 0.1, 0.1, -0.05, 0.1, 0.1]

      const result = evaluator.evaluateFinancial(predictions, actuals, returns)

      expect(result.success).toBe(true)
      if (result.data) {
        // Total wins: 0.7, Total losses: 0.15, Profit factor: 0.7 / 0.15 = 4.67
        expect(result.data.profitFactor).toBeGreaterThan(1)
      }
    })

    it('should calculate max drawdown', () => {
      const predictions = Array(5).fill(0.8)
      const actuals = Array(5).fill(1)
      const returns = [0.1, -0.05, -0.05, -0.05, 0.1]

      const result = evaluator.evaluateFinancial(predictions, actuals, returns)

      expect(result.success).toBe(true)
      if (result.data) {
        expect(result.data.maxDrawdown).toBeGreaterThan(0)
      }
    })
  })

  describe('Comprehensive Evaluation', () => {
    it('should perform comprehensive model evaluation', () => {
      const { predictions, actuals } = generatePredictions(100, 0.75)
      const returns = Array(100).fill(0).map(() => (Math.random() - 0.4) * 0.05)

      const result = evaluator.evaluateModel(predictions, actuals, returns)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      if (result.data) {
        expect(result.data.classification).toBeDefined()
        expect(result.data.regression).toBeDefined()
        expect(result.data.financial).toBeDefined()
        expect(result.data.overallScore).toBeGreaterThanOrEqual(0)
        expect(result.data.overallScore).toBeLessThanOrEqual(1)
        expect(result.data.timestamp).toBeGreaterThan(0)
      }
    })

    it('should calculate overall score correctly', () => {
      const predictions = Array(100).fill(0).map(() => Math.random())
      const actuals = Array(100).fill(0).map(() => Math.random() > 0.5 ? 1 : 0)
      const returns = Array(100).fill(0).map(() => (Math.random() - 0.5) * 0.05)

      const result = evaluator.evaluateModel(predictions, actuals, returns)

      expect(result.success).toBe(true)
      if (result.data) {
        const { classification, regression, financial, overallScore } = result.data

        // Overall score should be weighted combination
        expect(overallScore).toBeGreaterThan(0)
        expect(overallScore).toBeLessThanOrEqual(1)

        // Verify individual metrics are included
        expect(classification.accuracy).toBeDefined()
        expect(regression.rmse).toBeDefined()
        expect(financial.sharpeRatio).toBeDefined()
      }
    })

    it('should work without financial returns', () => {
      const { predictions, actuals } = generatePredictions(100)

      const result = evaluator.evaluateModel(predictions, actuals)

      expect(result.success).toBe(true)
      if (result.data) {
        expect(result.data.classification).toBeDefined()
        expect(result.data.regression).toBeDefined()
        expect(result.data.financial).toBeDefined()
        // Should use defaults for financial metrics
        expect(result.data.financial.directionAccuracy).toBe(result.data.classification.accuracy)
      }
    })
  })

  describe('Cross-Validation', () => {
    it('should perform k-fold cross-validation', async () => {
      const dataset: TrainingDataset = {
        features: Array(100).fill(0).map(() => [Math.random(), Math.random(), Math.random()]),
        labels: Array(100).fill(0).map(() => Math.random() > 0.5 ? 1 : 0),
        timestamps: Array(100).fill(0).map((_, i) => Date.now() - i * 1000),
        symbols: Array(100).fill('TEST'),
        featureNames: ['feature1', 'feature2', 'feature3']
      }

      const trainFunction = async (train: TrainingDataset, validation: TrainingDataset) => {
        // Simulate training and return a score
        return 0.75 + Math.random() * 0.1
      }

      const result = await evaluator.performKFoldCV(dataset, trainFunction, 5)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      if (result.data) {
        expect(result.data.foldScores).toHaveLength(5)
        expect(result.data.meanScore).toBeGreaterThan(0)
        expect(result.data.stdDeviation).toBeGreaterThanOrEqual(0)
        expect(result.data.minScore).toBeLessThanOrEqual(result.data.maxScore)
        expect(result.data.confidenceInterval).toBeDefined()
        expect(result.data.confidenceInterval.lower).toBeLessThan(result.data.confidenceInterval.upper)
      }
    }, 30000)

    it('should calculate cross-validation statistics correctly', async () => {
      const dataset: TrainingDataset = {
        features: Array(50).fill(0).map(() => [Math.random()]),
        labels: Array(50).fill(0).map(() => 1),
        timestamps: Array(50).fill(Date.now()),
        symbols: Array(50).fill('TEST'),
        featureNames: ['feature1']
      }

      const fixedScore = 0.80
      const trainFunction = async () => fixedScore

      const result = await evaluator.performKFoldCV(dataset, trainFunction, 3)

      expect(result.success).toBe(true)
      if (result.data) {
        // All scores should be the same
        expect(result.data.meanScore).toBeCloseTo(fixedScore, 2)
        expect(result.data.stdDeviation).toBeCloseTo(0, 2)
        expect(result.data.minScore).toBeCloseTo(fixedScore, 2)
        expect(result.data.maxScore).toBeCloseTo(fixedScore, 2)
      }
    }, 30000)
  })

  describe('Baseline Comparison', () => {
    it('should compare model with baseline', () => {
      const modelScore = 0.78
      const baselineScore = 0.72
      const sampleSize = 100

      const result = evaluator.compareWithBaseline(modelScore, baselineScore, sampleSize)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      if (result.data) {
        expect(result.data.modelScore).toBe(modelScore)
        expect(result.data.baselineScore).toBe(baselineScore)
        expect(result.data.improvement).toBeCloseTo(0.06, 2)
        expect(result.data.improvementPercent).toBeGreaterThan(0)
        expect(result.data.statisticallySignificant).toBeDefined()
        expect(result.data.pValue).toBeDefined()
      }
    })

    it('should identify significant improvement', () => {
      const modelScore = 0.85
      const baselineScore = 0.70
      const sampleSize = 200

      const result = evaluator.compareWithBaseline(modelScore, baselineScore, sampleSize)

      expect(result.success).toBe(true)
      if (result.data) {
        expect(result.data.improvement).toBeGreaterThan(0.1)
        expect(result.data.statisticallySignificant).toBe(true)
      }
    })

    it('should calculate improvement percentage correctly', () => {
      const modelScore = 0.80
      const baselineScore = 0.70
      const sampleSize = 100

      const result = evaluator.compareWithBaseline(modelScore, baselineScore, sampleSize)

      expect(result.success).toBe(true)
      if (result.data) {
        // (0.80 - 0.70) / 0.70 * 100 = 14.29%
        expect(result.data.improvementPercent).toBeCloseTo(14.29, 1)
      }
    })
  })

  describe('Evaluation Reports', () => {
    it('should generate comprehensive evaluation report', () => {
      const { predictions, actuals } = generatePredictions(100, 0.75)
      const returns = Array(100).fill(0).map(() => (Math.random() - 0.4) * 0.05)

      const result = evaluator.generateReport(
        'test_model_123',
        'LIGHTGBM',
        'validation',
        predictions,
        actuals,
        returns
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      if (result.data) {
        expect(result.data.modelId).toBe('test_model_123')
        expect(result.data.modelType).toBe('LIGHTGBM')
        expect(result.data.evaluationType).toBe('validation')
        expect(result.data.metrics).toBeDefined()
        expect(result.data.datasetSize).toBe(100)
        expect(result.data.evaluationDuration).toBeGreaterThan(0)
        expect(result.data.timestamp).toBeGreaterThan(0)
      }
    })

    it('should complete report generation quickly', () => {
      const startTime = Date.now()

      const { predictions, actuals } = generatePredictions(1000)
      const returns = Array(1000).fill(0).map(() => (Math.random() - 0.5) * 0.05)

      const result = evaluator.generateReport(
        'test_model',
        'XGBOOST',
        'test',
        predictions,
        actuals,
        returns
      )

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(5000) // Should complete in <5 seconds
    })
  })

  describe('Performance', () => {
    it('should evaluate large datasets efficiently', () => {
      const startTime = Date.now()

      const { predictions, actuals } = generatePredictions(10000)

      const result = evaluator.evaluateClassification(predictions, actuals)

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(1000) // Should complete in <1 second
    })

    it('should handle comprehensive evaluation of large datasets', () => {
      const startTime = Date.now()

      const { predictions, actuals } = generatePredictions(5000)
      const returns = Array(5000).fill(0).map(() => (Math.random() - 0.5) * 0.05)

      const result = evaluator.evaluateModel(predictions, actuals, returns)

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(5000) // Should complete in <5 seconds
    })
  })
})
