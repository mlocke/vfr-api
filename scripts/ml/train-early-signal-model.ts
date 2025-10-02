/**
 * Early Signal Detection - Model Training Script
 *
 * Uses Logistic Regression (LightGBM fallback due to CMake dependency issues)
 * Still ML-powered, production-ready, and easier to interpret
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'

interface TrainingRow {
  symbol: string
  date: string
  features: number[]
  label: number
}

interface ModelMetadata {
  version: string
  algorithm: string
  trainedAt: string
  trainingDataSize: number
  validationDataSize: number
  featureNames: string[]
  featureImportance: Record<string, number>
  normalizationParams: {
    mean: number[]
    std: number[]
  }
}

const FEATURE_NAMES = [
  'price_change_5d',
  'price_change_10d',
  'price_change_20d',
  'volume_ratio',
  'volume_trend',
  'sentiment_news_delta',
  'sentiment_reddit_accel',
  'sentiment_options_shift',
  'earnings_surprise',
  'revenue_growth_accel',
  'analyst_coverage_change',
  'rsi_momentum',
  'macd_histogram_trend'
]

/**
 * Load CSV training data
 */
function loadCSV(filepath: string): TrainingRow[] {
  const content = fs.readFileSync(filepath, 'utf-8')
  const lines = content.trim().split('\n')
  const header = lines[0].split(',')

  const data: TrainingRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')

    const row: TrainingRow = {
      symbol: values[0],
      date: values[1],
      features: values.slice(2, 15).map(Number),
      label: Number(values[15])
    }

    data.push(row)
  }

  return data
}

/**
 * Normalize features (z-score normalization)
 */
function normalizeFeatures(data: TrainingRow[]): { normalized: TrainingRow[]; mean: number[]; std: number[] } {
  const numFeatures = data[0].features.length
  const mean = new Array(numFeatures).fill(0)
  const std = new Array(numFeatures).fill(0)

  // Calculate mean
  for (const row of data) {
    for (let i = 0; i < numFeatures; i++) {
      mean[i] += row.features[i]
    }
  }
  mean.forEach((_, i) => { mean[i] /= data.length })

  // Calculate std
  for (const row of data) {
    for (let i = 0; i < numFeatures; i++) {
      std[i] += Math.pow(row.features[i] - mean[i], 2)
    }
  }
  std.forEach((_, i) => {
    std[i] = Math.sqrt(std[i] / data.length)
    // Prevent division by zero
    if (std[i] === 0) std[i] = 1
  })

  // Normalize
  const normalized = data.map(row => ({
    ...row,
    features: row.features.map((val, i) => (val - mean[i]) / std[i])
  }))

  return { normalized, mean, std }
}

/**
 * Simple logistic regression implementation
 */
class SimpleLogisticRegression {
  weights: number[]
  bias: number

  constructor(numFeatures: number) {
    this.weights = new Array(numFeatures).fill(0)
    this.bias = 0
  }

  sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z))
  }

  predict(features: number[]): number {
    const z = features.reduce((sum, feat, i) => sum + feat * this.weights[i], this.bias)
    return this.sigmoid(z) >= 0.5 ? 1 : 0
  }

  predictProba(features: number[]): number {
    const z = features.reduce((sum, feat, i) => sum + feat * this.weights[i], this.bias)
    return this.sigmoid(z)
  }

  train(X: number[][], y: number[], learningRate: number = 0.01, iterations: number = 1000) {
    const m = X.length

    for (let iter = 0; iter < iterations; iter++) {
      // Forward pass
      const predictions = X.map(features => this.predictProba(features))

      // Compute gradients
      const dWeights = new Array(this.weights.length).fill(0)
      let dBias = 0

      for (let i = 0; i < m; i++) {
        const error = predictions[i] - y[i]
        dBias += error
        for (let j = 0; j < this.weights.length; j++) {
          dWeights[j] += error * X[i][j]
        }
      }

      // Update weights
      for (let j = 0; j < this.weights.length; j++) {
        this.weights[j] -= (learningRate / m) * dWeights[j]
      }
      this.bias -= (learningRate / m) * dBias

      // Log progress every 100 iterations
      if ((iter + 1) % 100 === 0) {
        const loss = this.computeLoss(X, y)
        console.log(`  Iteration ${iter + 1}/${iterations}, Loss: ${loss.toFixed(4)}`)
      }
    }
  }

  computeLoss(X: number[][], y: number[]): number {
    const m = X.length
    let loss = 0

    for (let i = 0; i < m; i++) {
      const pred = this.predictProba(X[i])
      loss += -y[i] * Math.log(pred + 1e-15) - (1 - y[i]) * Math.log(1 - pred + 1e-15)
    }

    return loss / m
  }
}

/**
 * Calculate feature importance from logistic regression coefficients
 */
function calculateFeatureImportance(model: SimpleLogisticRegression): Record<string, number> {
  const weights = model.weights
  const totalAbsWeight = weights.reduce((sum, w) => sum + Math.abs(w), 0)

  const importance: Record<string, number> = {}
  weights.forEach((weight, i) => {
    const normalizedImportance = Math.abs(weight) / totalAbsWeight
    importance[FEATURE_NAMES[i]] = normalizedImportance
  })

  return importance
}

/**
 * Main training function
 */
async function trainModel() {
  console.log('🔮 ML Early Signal - Model Training')
  console.log('Task 2.1: Train Logistic Regression Model (LightGBM fallback)')
  console.log('='.repeat(80))

  // Load data
  console.log('\nLoading training data...')
  const trainData = loadCSV('data/training/train.csv')
  const valData = loadCSV('data/training/val.csv')

  console.log(`✓ Loaded ${trainData.length} training examples`)
  console.log(`✓ Loaded ${valData.length} validation examples`)

  // Normalize features
  console.log('\nNormalizing features...')
  const { normalized: normalizedTrain, mean, std } = normalizeFeatures(trainData)
  const normalizedVal = valData.map(row => ({
    ...row,
    features: row.features.map((val, i) => (val - mean[i]) / std[i])
  }))

  console.log('✓ Features normalized (z-score)')

  // Prepare training matrices
  const X_train = normalizedTrain.map(row => row.features)
  const y_train = normalizedTrain.map(row => row.label)

  const X_val = normalizedVal.map(row => row.features)
  const y_val = normalizedVal.map(row => row.label)

  // Train model
  console.log('\nTraining logistic regression model...')
  console.log('  Algorithm: Logistic Regression')
  console.log('  Optimizer: Gradient Descent')
  console.log('  Learning rate: 0.01')
  console.log('  Max iterations: 1000')

  const model = new SimpleLogisticRegression(FEATURE_NAMES.length)
  model.train(X_train, y_train, 0.01, 1000)
  console.log('✓ Model training complete')

  // Validate on validation set
  console.log('\nValidating on validation set...')
  const predictions = X_val.map(features => model.predict(features))
  const accuracy = predictions.filter((pred, i) => pred === y_val[i]).length / y_val.length
  console.log(`  Validation Accuracy: ${(accuracy * 100).toFixed(1)}%`)

  // Calculate feature importance
  console.log('\nCalculating feature importance...')
  const featureImportance = calculateFeatureImportance(model)
  const sortedFeatures = Object.entries(featureImportance)
    .sort(([, a], [, b]) => b - a)

  console.log('\nTop 5 Features:')
  sortedFeatures.slice(0, 5).forEach(([name, importance], idx) => {
    console.log(`  ${idx + 1}. ${name}: ${(importance * 100).toFixed(1)}%`)
  })

  // Save model
  console.log('\nSaving model...')
  const modelDir = 'models/early-signal/v1.0.0'
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true })
  }

  // Save model weights
  const modelData = {
    weights: model.weights,
    bias: model.bias
  }
  fs.writeFileSync(
    path.join(modelDir, 'model.json'),
    JSON.stringify(modelData, null, 2)
  )

  // Save normalizer
  const normalizer = { mean, std }
  fs.writeFileSync(
    path.join(modelDir, 'normalizer.json'),
    JSON.stringify(normalizer, null, 2)
  )

  // Save metadata
  const metadata: ModelMetadata = {
    version: '1.0.0',
    algorithm: 'Logistic Regression',
    trainedAt: new Date().toISOString(),
    trainingDataSize: trainData.length,
    validationDataSize: valData.length,
    featureNames: FEATURE_NAMES,
    featureImportance,
    normalizationParams: normalizer
  }

  fs.writeFileSync(
    path.join(modelDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  )

  console.log(`✓ Model saved to ${modelDir}/`)
  console.log('  - model.json (weights and bias)')
  console.log('  - normalizer.json (normalization parameters)')
  console.log('  - metadata.json (model info and feature importance)')

  console.log('\n' + '='.repeat(80))
  console.log('✅ Model Training Complete')
  console.log('='.repeat(80))
  console.log('\n💡 Next step: Evaluate model on test set')
  console.log('   npx tsx scripts/ml/evaluate-early-signal-model.ts')
  console.log('='.repeat(80))
}

// Run training
trainModel().catch(console.error)
