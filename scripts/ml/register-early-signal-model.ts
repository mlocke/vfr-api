/**
 * Register Early Signal Detection Model v1.0.0
 *
 * Registers the trained LightGBM model in the ModelRegistry database
 * with all metadata, feature importance, and performance metrics.
 */

import { ModelRegistry, ModelType, ModelObjective, ModelStatus, TierRequirement } from '../../app/services/ml/models/ModelRegistry'
import * as fs from 'fs'
import * as path from 'path'

async function registerEarlySignalModel() {
  console.log('=== Early Signal Detection Model Registration ===\n')

  try {
    // Load metadata from trained model
    const metadataPath = path.join(process.cwd(), 'models/early-signal/v1.0.0/metadata.json')
    const metadataContent = fs.readFileSync(metadataPath, 'utf-8')
    const metadata = JSON.parse(metadataContent)

    console.log('✓ Loaded model metadata from:', metadataPath)
    console.log(`  - Algorithm: ${metadata.algorithm}`)
    console.log(`  - Trained: ${metadata.trainedAt}`)
    console.log(`  - Features: ${metadata.featureNames.length}`)
    console.log()

    // Initialize ModelRegistry
    const registry = ModelRegistry.getInstance()
    await registry.initialize()
    console.log('✓ ModelRegistry initialized\n')

    // Prepare registration input
    const registrationInput = {
      modelName: 'early-signal-detection',
      modelVersion: '1.0.0',
      modelType: ModelType.LIGHTGBM,
      objective: ModelObjective.DIRECTION_CLASSIFICATION,
      targetVariable: 'analyst_upgrade',
      predictionHorizon: '30d',
      validationScore: 0.9425, // 94.25%
      testScore: 0.976, // 97.6%
      tierRequirement: TierRequirement.PREMIUM,
      status: ModelStatus.VALIDATED,
      artifactPath: 'models/early-signal/v1.0.0',
      hyperparameters: {
        algorithm: metadata.algorithm,
        numLeaves: 31,
        learningRate: 0.05,
        maxBoostingRounds: 200,
        bestIteration: 59,
        featureCount: metadata.featureNames.length
      },
      featureImportance: metadata.featureImportance,
      trainingMetrics: {
        validation: metadata.validationMetrics,
        test: {
          accuracy: 0.976,
          auc: 0.998,
          precision: 0.904,
          recall: 1.0,
          f1: 0.949,
          truePositives: 47,
          trueNegatives: 36,
          falsePositives: 2,
          falseNegatives: 0
        },
        trainingExamples: 879,
        validationExamples: 87,
        testExamples: 85,
        totalExamples: 1051,
        trainedAt: metadata.trainedAt
      }
    }

    console.log('Registering model with the following details:')
    console.log('  - Model Name:', registrationInput.modelName)
    console.log('  - Version:', registrationInput.modelVersion)
    console.log('  - Type:', registrationInput.modelType)
    console.log('  - Objective:', registrationInput.objective)
    console.log('  - Target Variable:', registrationInput.targetVariable)
    console.log('  - Prediction Horizon:', registrationInput.predictionHorizon)
    console.log('  - Validation Score:', (registrationInput.validationScore * 100).toFixed(2) + '%')
    console.log('  - Test Score:', (registrationInput.testScore * 100).toFixed(2) + '%')
    console.log('  - Status:', registrationInput.status)
    console.log('  - Tier:', registrationInput.tierRequirement)
    console.log()

    // Register the model
    const result = await registry.registerModel(registrationInput)

    if (result.success) {
      console.log('✅ Model registered successfully!\n')
      console.log('Model Details:')
      console.log('  - Model ID:', result.data?.modelId)
      console.log('  - Model Name:', result.data?.modelName)
      console.log('  - Version:', result.data?.modelVersion)
      console.log('  - Status:', result.data?.status)
      console.log('  - Created At:', result.data?.createdAt)
      console.log('  - Latency:', result.metadata?.latency + 'ms')
      console.log()
      console.log('Top 5 Feature Importance:')
      if (result.data?.featureImportance) {
        const sortedFeatures = Object.entries(result.data.featureImportance)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
        sortedFeatures.forEach(([feature, importance], idx) => {
          console.log(`  ${idx + 1}. ${feature}: ${(importance * 100).toFixed(1)}%`)
        })
      }
    } else {
      console.error('❌ Model registration failed!')
      console.error('Error:', result.error?.message)
      if (result.error?.message?.includes('already exists')) {
        console.log('\nNote: Model is already registered. Use updateModel() to modify it.')
      }
      process.exit(1)
    }

  } catch (error: any) {
    console.error('❌ Registration failed with error:', error.message)
    console.error(error)
    process.exit(1)
  }

  console.log('\n=== Registration Complete ===')
  process.exit(0)
}

// Run registration
registerEarlySignalModel()
