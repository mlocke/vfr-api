/**
 * Early Signal Detection API Endpoint
 * POST /api/ml/early-signal - Predict analyst upgrade probability
 * Uses trained LightGBM model (v1.0.0) with persistent Python process
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import readline from 'readline'

// Persistent Python process
let pythonProcess: ChildProcess | null = null
let processReady = false
let requestQueue: Array<{
  request: string
  resolve: (value: any) => void
  reject: (reason: any) => void
}> = []

// Request validation schema
const EarlySignalRequestSchema = z.object({
  symbol: z.string().min(1).max(10),
  features: z.array(z.number()).length(19).optional(),
  date: z.string().optional()
})

/**
 * Extract features for a symbol (placeholder - integrate with FeatureEngineeringService)
 */
async function extractFeatures(symbol: string): Promise<number[]> {
  // TODO: Integrate with FeatureEngineeringService to extract real features
  // For now, return zeros (sentiment features are zero anyway)
  // Features: price_change_5d, price_change_10d, price_change_20d, volume_ratio, volume_trend,
  //           sentiment_news_delta, sentiment_reddit_accel, sentiment_options_shift,
  //           social_stocktwits_24h_change, social_stocktwits_hourly_momentum, social_stocktwits_7d_trend,
  //           social_twitter_24h_change, social_twitter_hourly_momentum, social_twitter_7d_trend,
  //           earnings_surprise, revenue_growth_accel, analyst_coverage_change, rsi_momentum, macd_histogram_trend

  return [
    0, 0, 0,     // price changes (placeholder)
    1, 0,        // volume features (placeholder)
    0, 0, 0,     // sentiment (not implemented)
    0, 0, 0,     // social stocktwits (not implemented)
    0, 0, 0,     // social twitter (not implemented)
    0, 0, 15,    // fundamental features (placeholder)
    0, 0         // technical features (placeholder)
  ]
}

/**
 * Initialize persistent Python process
 */
function initPythonProcess(): void {
  if (pythonProcess) return

  const scriptPath = path.join(process.cwd(), 'scripts/ml/predict-early-signal.py')

  pythonProcess = spawn('python3', [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  // Set up readline for stdout
  const rl = readline.createInterface({
    input: pythonProcess.stdout!,
    crlfDelay: Infinity
  })

  rl.on('line', (line) => {
    const response = JSON.parse(line)

    // Resolve the next pending request
    const pending = requestQueue.shift()
    if (pending) {
      pending.resolve(response)
    }
  })

  // Monitor stderr for READY signal
  const stderrRl = readline.createInterface({
    input: pythonProcess.stderr!,
    crlfDelay: Infinity
  })

  stderrRl.on('line', (line) => {
    if (line === 'READY') {
      processReady = true
      console.log('🚀 Python prediction server ready')
    } else if (line.startsWith('ERROR')) {
      console.error('Python server error:', line)
    }
  })

  pythonProcess.on('error', (error) => {
    console.error('Python process error:', error)
    pythonProcess = null
    processReady = false

    // Reject all pending requests
    requestQueue.forEach(req => req.reject(new Error('Python process crashed')))
    requestQueue = []
  })

  pythonProcess.on('exit', (code) => {
    console.log(`Python process exited with code ${code}`)
    pythonProcess = null
    processReady = false
  })
}

/**
 * Send prediction request to persistent Python process
 */
async function getPrediction(features: number[]): Promise<any> {
  // Initialize process if needed
  if (!pythonProcess) {
    initPythonProcess()
  }

  // Wait for process to be ready (with timeout)
  const startWait = Date.now()
  while (!processReady && Date.now() - startWait < 5000) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  if (!processReady) {
    throw new Error('Python process not ready')
  }

  // Send request and wait for response
  return new Promise((resolve, reject) => {
    const request = JSON.stringify({ features })

    requestQueue.push({ request, resolve, reject })

    pythonProcess!.stdin!.write(request + '\n')

    // Timeout after 2 seconds
    setTimeout(() => {
      const index = requestQueue.findIndex(r => r.resolve === resolve)
      if (index !== -1) {
        requestQueue.splice(index, 1)
        reject(new Error('Prediction timeout'))
      }
    }, 2000)
  })
}

/**
 * POST endpoint - Early signal prediction
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // Parse and validate request
    const body = await request.json()
    const { symbol, features } = EarlySignalRequestSchema.parse(body)

    const sanitizedSymbol = symbol.trim().toUpperCase()

    console.log(`🔮 Early Signal Detection for ${sanitizedSymbol}`)

    // Extract or use provided features
    const featureVector = features || await extractFeatures(sanitizedSymbol)

    // Get prediction from Python model
    const predictionResult = await getPrediction(featureVector)

    if (!predictionResult.success) {
      return NextResponse.json({
        success: false,
        error: predictionResult.error || 'Prediction failed'
      }, { status: 500 })
    }

    const processingTime = Date.now() - startTime

    const { prediction, probability, confidence, confidenceLevel } = predictionResult.data

    console.log(`✅ Prediction completed in ${processingTime}ms:`, {
      symbol: sanitizedSymbol,
      prediction,
      probability,
      confidence
    })

    return NextResponse.json({
      success: true,
      data: {
        symbol: sanitizedSymbol,
        prediction: prediction === 1 ? 'upgrade' : 'no_upgrade',
        probability,
        confidence,
        confidenceLevel,
        interpretation: prediction === 1
          ? `High likelihood of analyst upgrade within 30 days (${(probability * 100).toFixed(1)}%)`
          : `Low likelihood of analyst upgrade within 30 days (${(probability * 100).toFixed(1)}%)`,
        processingTimeMs: processingTime,
        modelVersion: '1.0.0',
        algorithm: 'LightGBM Gradient Boosting'
      }
    })

  } catch (error) {
    console.error('Early signal prediction error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        details: error.issues.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Early signal prediction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET endpoint - Health check
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Check if model files exist
    const fs = require('fs')
    const modelExists = fs.existsSync('models/early-signal/v1.0.0/model.txt')
    const normalizerExists = fs.existsSync('models/early-signal/v1.0.0/normalizer.json')

    return NextResponse.json({
      success: true,
      data: {
        service: 'early-signal-detection',
        status: modelExists && normalizerExists ? 'healthy' : 'degraded',
        modelVersion: '1.0.0',
        algorithm: 'LightGBM Gradient Boosting',
        accuracy: {
          validation: 0.943,
          test: 0.976
        },
        modelLoaded: modelExists && normalizerExists,
        timestamp: Date.now()
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}
