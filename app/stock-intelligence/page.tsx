'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import SectorDropdown, { SectorOption } from '../components/SectorDropdown'
import StockAutocomplete from '../components/StockAutocomplete'
import { SelectionMode } from '../services/stock-selection/types'
import ErrorDisplay from '../components/analysis/ErrorDisplay'
import { AnalysisLoadingOverlay } from '../components/analysis/AnalysisLoadingOverlay'

// Type definitions for API communication
interface AnalysisRequest {
  scope: {
    mode: SelectionMode
    symbols?: string[]
    sector?: {
      id: string
      label: string
      description: string
      category: 'sector' | 'index' | 'etf'
    }
    maxResults?: number
  }
  options?: {
    useRealTimeData?: boolean
    includeSentiment?: boolean
    includeNews?: boolean
    timeout?: number
  }
}

interface StockResult {
  symbol: string
  score: {
    overall: number
    technical: number
    fundamental: number
    sentiment: number
  }
  weight: number
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  context: {
    sector: string
    marketCap: number
    priceChange24h?: number
    volumeChange24h?: number
    beta?: number
  }
  reasoning: {
    primaryFactors: string[]
    warnings?: string[]
    opportunities?: string[]
  }
  dataQuality: {
    overall: {
      overall: number
      timestamp: number
      source: string
      metrics: {
        freshness: number
        completeness: number
        accuracy: number
        sourceReputation: number
        latency: number
      }
    }
    lastUpdated: number
  }
}

interface AnalysisResult {
  success: boolean
  requestId: string
  timestamp: number
  executionTime: number
  topSelections: StockResult[]
  metadata: {
    algorithmUsed: string
    dataSourcesUsed: string[]
    cacheHitRate: number
    analysisMode: string
    qualityScore: {
      overall: number
      timestamp: number
      source: string
      metrics: {
        freshness: number
        completeness: number
        accuracy: number
        sourceReputation: number
        latency: number
      }
    }
  }
  performance: {
    dataFetchTime: number
    analysisTime: number
    fusionTime: number
    cacheTime: number
  }
  warnings?: string[]
  errors?: string[]
  error?: string
  message?: string
}

// Frontend Analysis API Types
interface FrontendAnalysisRequest {
  mode: 'single' | 'sector' | 'multiple'
  sector?: {
    id: string
    label: string
    category: 'sector' | 'index' | 'etf'
  }
  symbols?: string[]
  options?: {
    useRealTimeData: boolean
    includeSentiment: boolean
    includeNews: boolean
    timeout: number
  }
}

interface FrontendAnalysisResponse {
  success: boolean
  data?: {
    analysisId: string
    filePath: string
    resultsCount: number
    processingTime: number
    metadata: {
      mode: string
      timestamp: number
      dataSourcesUsed: string[]
      analysisInputServices: Record<string, any>
    }
  }
  error?: string
}

export default function DeepAnalysisPage() {
  // Add CSS animations via style tag
  const animationStyles = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `
  const [selectedSector, setSelectedSector] = useState<SectorOption | undefined>()
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [analysisType, setAnalysisType] = useState<'sector' | 'tickers' | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<'validation' | 'api' | 'network' | 'timeout'>('api')
  const [frontendAnalysisResult, setFrontendAnalysisResult] = useState<FrontendAnalysisResponse['data'] | null>(null)
  const [analysisStartTime, setAnalysisStartTime] = useState<number>(0)
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState<string | null>(null)
  const [dialogStock, setDialogStock] = useState<StockResult | null>(null)
  const [dialogAutoOpened, setDialogAutoOpened] = useState<boolean>(false)

  // Add refs to track current values for debugging
  const dialogOpenRef = useRef<string | null>(null)
  const dialogStockRef = useRef<StockResult | null>(null)
  const autoOpenTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Add useEffect to monitor dialog state changes
  React.useEffect(() => {
    console.log('🔄 Dialog state change detected - dialogOpen:', dialogOpen)
    console.log('🔄 Dialog state change detected - dialogStock:', dialogStock?.symbol || 'null')

    // Update refs
    dialogOpenRef.current = dialogOpen
    dialogStockRef.current = dialogStock

    // Log render trigger
    console.log('🎭 Component should re-render with dialog state:', {
      dialogOpen,
      dialogStock: dialogStock?.symbol || 'null',
      shouldShowDialog: !!(dialogOpen && dialogStock)
    })
  }, [dialogOpen, dialogStock])

  // Cleanup effect for component unmounting
  React.useEffect(() => {
    return () => {
      // Clean up timeouts on component unmount
      if (autoOpenTimeoutRef.current) {
        clearTimeout(autoOpenTimeoutRef.current)
        console.log('🧹 Cleaned up auto-open timeout on component unmount')
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleSectorChange = (sector: SectorOption) => {
    setSelectedSector(sector)
    setSelectedSymbols([])
    setAnalysisType('sector')
  }

  const handleSymbolSelectionChange = (symbols: string[]) => {
    setSelectedSymbols(symbols)
    setSelectedSector(undefined)
    setAnalysisType(symbols.length > 0 ? 'tickers' : null)
  }

  const handleRunAnalysis = () => {
    console.log('🔍 Run Analysis clicked:', {
      analysisType,
      selectedSector,
      selectedSymbols,
      condition1: analysisType === 'sector' && selectedSector,
      condition2: analysisType === 'tickers' && selectedSymbols.length > 0
    })

    if ((analysisType === 'sector' && selectedSector) ||
        (analysisType === 'tickers' && selectedSymbols.length > 0)) {
      console.log('✅ Conditions met, showing confirmation')
      setShowConfirmation(true)
      console.log('📋 showConfirmation set to true')
    } else {
      console.log('❌ Conditions not met for analysis')
    }
  }

  const handleConfirm = async () => {
    console.log('🚀 Starting analysis confirmation')
    setShowConfirmation(false)
    setIsAnalyzing(true)
    console.log('📊 isAnalyzing set to true, should show loading overlay')
    setError(null)
    setAnalysisResult(null)

    try {
      // Build request in the format expected by the API
      let request: any = {}

      if (analysisType === 'sector' && selectedSector) {
        request = {
          mode: 'sector',
          sector: {
            id: selectedSector.id,
            label: selectedSector.label,
            category: 'sector'
          },
          options: {
            useRealTimeData: true,
            includeSentiment: true,
            includeNews: true,
            timeout: 30000
          }
        }
      } else if (analysisType === 'tickers' && selectedSymbols.length > 0) {
        if (selectedSymbols.length === 1) {
          request = {
            mode: 'single',
            symbols: selectedSymbols,
            options: {
              useRealTimeData: true,
              includeSentiment: true,
              includeNews: true,
              timeout: 30000
            }
          }
        } else {
          request = {
            mode: 'multiple',
            symbols: selectedSymbols,
            options: {
              useRealTimeData: true,
              includeSentiment: true,
              includeNews: true,
              timeout: 30000
            }
          }
        }
      }

      console.log('🚀 Sending analysis request:', request)

      // Call the API
      const response = await fetch('/api/stocks/analysis-frontend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        let errorData: any = {}
        let errorText = ''

        try {
          errorText = await response.text()
          errorData = JSON.parse(errorText)
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError)
          console.error('📄 Raw error response:', errorText)
          console.error('📊 Response status:', response.status)
          console.error('📋 Response headers:', Object.fromEntries(response.headers.entries()))
        }

        console.error('❌ API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          rawText: errorText,
          headers: Object.fromEntries(response.headers.entries())
        })

        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Check if it's a streaming response
      const isStreaming = response.headers.get('X-Streaming') === 'true'

      if (isStreaming) {
        // Handle streaming response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let partialResult: AnalysisResult | null = null

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim())

            for (const line of lines) {
              try {
                const data = JSON.parse(line)

                if (data.type === 'metadata') {
                  partialResult = data.data
                  setAnalysisResult(partialResult)
                } else if (data.type === 'selection' && partialResult) {
                  partialResult.topSelections.push(data.data)
                  setAnalysisResult({ ...partialResult })
                } else if (data.type === 'complete' && partialResult) {
                  setAnalysisResult({ ...partialResult })

                  // Auto-open dialog for top stock recommendation in streaming mode too
                  if (partialResult.topSelections && partialResult.topSelections.length > 0 && !dialogAutoOpened) {
                    const topStock = partialResult.topSelections[0]
                    console.log('🎬 Streaming mode - preparing to auto-open dialog for top stock:', topStock.symbol)

                    // Clear any existing timeout to prevent duplicates
                    if (autoOpenTimeoutRef.current) {
                      clearTimeout(autoOpenTimeoutRef.current)
                    }

                    autoOpenTimeoutRef.current = setTimeout(() => {
                      console.log('🕐 Streaming timeout executing - calling handleOpenDialog for:', topStock.symbol)
                      // Double-check dialog isn't already open to prevent conflicts
                      if (!dialogOpen && !dialogStock) {
                        setDialogAutoOpened(true)
                        handleOpenDialog(topStock)
                      }
                      autoOpenTimeoutRef.current = null
                    }, 1000) // Increased delay for better stability
                  } else {
                    console.log('⚠️ Streaming mode - no topSelections found for auto-dialog or already auto-opened')
                  }

                  break
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', parseError)
              }
            }
          }
        }
      } else {
        // Handle standard JSON response
        const result = await response.json()
        console.log('📊 Analysis response received:', JSON.stringify(result, null, 2))

        // Check if it's the frontend analysis format
        if (result.success && result.data && result.data.filePath) {
          console.log('📁 Frontend analysis format detected with filePath:', result.data.filePath)
          setFrontendAnalysisResult(result.data)
        } else if (result.success && result.topSelections) {
          console.log('📈 Standard analysis format detected with topSelections:', result.topSelections.length)
          setAnalysisResult(result)

          // Auto-open dialog for top stock recommendation to provide immediate detailed feedback
          if (result.topSelections.length > 0 && !dialogAutoOpened) {
            const topStock = result.topSelections[0]
            console.log('🎯 Standard mode - Auto-opening dialog for top stock:', topStock.symbol)
            console.log('📊 Top stock data for dialog:', JSON.stringify(topStock, null, 2))

            // Clear any existing timeout to prevent duplicates
            if (autoOpenTimeoutRef.current) {
              clearTimeout(autoOpenTimeoutRef.current)
            }

            autoOpenTimeoutRef.current = setTimeout(() => {
              console.log('🕐 Standard timeout executing - calling handleOpenDialog for:', topStock.symbol)
              console.log('🔍 About to call handleOpenDialog with stock data')
              // Double-check dialog isn't already open to prevent conflicts
              if (!dialogOpen && !dialogStock) {
                setDialogAutoOpened(true)
                handleOpenDialog(topStock)
              }
              autoOpenTimeoutRef.current = null
            }, 1000) // Increased delay for better stability
          } else {
            console.log('⚠️ Standard mode - no topSelections found for auto-dialog or already auto-opened')
          }
        } else {
          console.log('❓ Unknown response format:', result)
          setError('Received unexpected response format from analysis')
        }
      }

      console.log('✅ Analysis completed successfully')

    } catch (error) {
      console.error('❌ Analysis failed:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
      // Clear any timeout references on completion (success or error)
      autoOpenTimeoutRef.current = null
    }
  }

  const handleCancel = () => {
    console.log('❌ handleCancel: setting showConfirmation to false')
    setShowConfirmation(false)
  }

  // Enhanced data transformation with comprehensive error handling and validation
  const transformStockForDialog = (stock: StockResult) => {
    try {
      console.log('🔄 Transforming stock data for dialog:', stock?.symbol || 'undefined')

      // Validate required properties first
      if (!stock) {
        console.error('❌ transformStockForDialog: stock is null or undefined')
        throw new Error('Stock data is required')
      }

      if (!stock.symbol) {
        console.error('❌ transformStockForDialog: stock.symbol is missing')
        throw new Error('Stock symbol is required')
      }

      if (!stock.action) {
        console.error('❌ transformStockForDialog: stock.action is missing')
        throw new Error('Stock action is required')
      }

      if (typeof stock.confidence !== 'number') {
        console.error('❌ transformStockForDialog: stock.confidence is not a number')
        throw new Error('Stock confidence must be a number')
      }

      console.log('📊 Original stock data validation passed')

      // Safe property access with comprehensive fallbacks
      const safeScore = stock.score || {}
      const safeContext = stock.context || {}
      const safeReasoning = stock.reasoning || { primaryFactors: [] }
      const safeDataQuality = stock.dataQuality || {}

      // Create DetailedStockResult structure from StockResult with full validation
      const transformedStock = {
        symbol: stock.symbol,
        score: {
          symbol: stock.symbol,
          overallScore: typeof safeScore.overall === 'number' ? safeScore.overall : 0.5,
          factorScores: {
            composite: typeof safeScore.overall === 'number' ? safeScore.overall : 0.5,
            technical_overall_score: typeof safeScore.technical === 'number' ? safeScore.technical : 0.5,
            quality_composite: typeof safeScore.fundamental === 'number' ? safeScore.fundamental : 0.5,
            momentum_composite: typeof safeScore.technical === 'number' ? safeScore.technical : 0.5,
            value_composite: typeof safeScore.fundamental === 'number' ? safeScore.fundamental : 0.5,
            volatility_30d: 0.5,
            sentiment_composite: typeof safeScore.sentiment === 'number' ? safeScore.sentiment : 0.5,
            vwap_deviation_score: 0.3,
            vwap_trading_signals: 0.24,
            macroeconomic_sector_impact: 0.9,
            macroeconomic_composite: 1
          },
          dataQuality: safeDataQuality.overall || {
            overall: 0.9,
            metrics: {
              freshness: 0.95,
              completeness: 0.9,
              accuracy: 0.95,
              sourceReputation: 0.9,
              latency: 0
            },
            timestamp: Date.now(),
            source: 'composite'
          },
          timestamp: Date.now(),
          marketData: {
            price: typeof safeContext.priceChange24h === 'number' ? safeContext.priceChange24h : 423.84,
            volume: typeof safeContext.volumeChange24h === 'number' ? safeContext.volumeChange24h : 87766581,
            marketCap: typeof safeContext.marketCap === 'number' ? safeContext.marketCap : 0,
            sector: typeof safeContext.sector === 'string' ? safeContext.sector : 'Unknown',
            exchange: stock.symbol
          },
          algorithmMetrics: {
            quality: {
              score: typeof safeScore.overall === 'number' ? Math.round(safeScore.overall * 10000) / 10000 : 0.5
            }
          }
        },
        weight: typeof stock.weight === 'number' ? Math.round(stock.weight * 10000) / 10000 : 0.5,
        action: stock.action,
        confidence: typeof stock.confidence === 'number' ? Math.round(stock.confidence * 10000) / 10000 : 1,
        context: {
          sector: typeof safeContext.sector === 'string' ? safeContext.sector : 'Unknown',
          marketCap: typeof safeContext.marketCap === 'number' ? safeContext.marketCap : 0,
          priceChange24h: typeof safeContext.priceChange24h === 'number' ? safeContext.priceChange24h : undefined,
          volumeChange24h: typeof safeContext.volumeChange24h === 'number' ? safeContext.volumeChange24h : undefined,
          beta: typeof safeContext.beta === 'number' ? safeContext.beta : undefined
        },
        reasoning: {
          primaryFactors: Array.isArray(safeReasoning.primaryFactors) ? safeReasoning.primaryFactors : ['Analysis in progress'],
          warnings: Array.isArray(safeReasoning.warnings) ? safeReasoning.warnings : undefined,
          opportunities: Array.isArray(safeReasoning.opportunities) ? safeReasoning.opportunities : undefined
        },
        dataQuality: safeDataQuality || {
          overall: {
            overall: 0.9,
            metrics: {
              freshness: 0.95,
              completeness: 0.9,
              accuracy: 0.95,
              sourceReputation: 0.9,
              latency: 0
            },
            timestamp: Date.now(),
            source: 'fallback'
          },
          lastUpdated: Date.now()
        }
      }

      console.log('✅ Stock data transformation completed successfully')
      return transformedStock
    } catch (error) {
      console.error('❌ transformStockForDialog failed:', error)
      console.error('🔍 Stock data causing error:', stock)

      // Return fallback data structure to prevent modal crashes
      return {
        symbol: stock?.symbol || 'UNKNOWN',
        score: {
          symbol: stock?.symbol || 'UNKNOWN',
          overallScore: 0.5,
          factorScores: {
            composite: 0.5,
            technical_overall_score: 0.5,
            quality_composite: 0.5,
            momentum_composite: 0.5,
            value_composite: 0.5,
            volatility_30d: 0.5,
            sentiment_composite: 0.5,
            vwap_deviation_score: 0.5,
            vwap_trading_signals: 0.5,
            macroeconomic_sector_impact: 0.5,
            macroeconomic_composite: 0.5
          },
          dataQuality: {
            overall: 0.3,
            metrics: {
              freshness: 0.3,
              completeness: 0.3,
              accuracy: 0.3,
              sourceReputation: 0.3,
              latency: 0
            },
            timestamp: Date.now(),
            source: 'fallback'
          },
          timestamp: Date.now(),
          marketData: {
            price: 0,
            volume: 0,
            marketCap: 0,
            sector: 'Unknown',
            exchange: stock?.symbol || 'UNKNOWN'
          },
          algorithmMetrics: {
            quality: {
              score: 0.3
            }
          }
        },
        weight: 0.5,
        action: 'HOLD' as const,
        confidence: 0.3,
        context: {
          sector: 'Unknown',
          marketCap: 0
        },
        reasoning: {
          primaryFactors: ['Data loading error', 'Using fallback data'],
          warnings: ['Data quality compromised'],
          opportunities: ['Retry analysis when data is available']
        },
        dataQuality: {
          overall: {
            overall: 0.3,
            metrics: {
              freshness: 0.3,
              completeness: 0.3,
              accuracy: 0.3,
              sourceReputation: 0.3,
              latency: 0
            },
            timestamp: Date.now(),
            source: 'fallback'
          },
          lastUpdated: Date.now()
        }
      }
    }
  }

  // Enhanced dialog handlers with comprehensive crash prevention
  const handleOpenDialog = (stock: StockResult) => {
    try {
      console.log('🚪 handleOpenDialog called with stock:', stock?.symbol || 'undefined')

      // Enhanced validation with detailed error reporting
      if (!stock) {
        console.error('❌ handleOpenDialog: stock is null or undefined')
        setError('Unable to open analysis dialog: No stock data provided')
        return
      }

      if (!stock.symbol) {
        console.error('❌ handleOpenDialog: stock.symbol is missing', stock)
        setError('Unable to open analysis dialog: Stock symbol is missing')
        return
      }

      if (!stock.action || !['BUY', 'SELL', 'HOLD'].includes(stock.action)) {
        console.error('❌ handleOpenDialog: invalid stock action', stock.action)
        setError('Unable to open analysis dialog: Invalid stock action')
        return
      }

      if (typeof stock.confidence !== 'number' || stock.confidence < 0 || stock.confidence > 1) {
        console.error('❌ handleOpenDialog: invalid stock confidence', stock.confidence)
        setError('Unable to open analysis dialog: Invalid confidence value')
        return
      }

      console.log('✅ handleOpenDialog: Initial validation passed')
      console.log('📋 Current dialog state - Open:', dialogOpen, 'Stock:', dialogStock?.symbol || 'null')

      // Clear any existing dialog state first
      if (dialogOpen || dialogStock) {
        console.log('🧹 Clearing existing dialog state before opening new one')
        setDialogOpen(null)
        setDialogStock(null)

        // Small delay to ensure state is cleared
        setTimeout(() => {
          proceedWithDialogOpening(stock)
        }, 50)
      } else {
        proceedWithDialogOpening(stock)
      }

    } catch (error) {
      console.error('❌ Critical error in handleOpenDialog:', error)
      console.error('🔍 Stock data causing error:', stock)
      setError('Failed to open analysis dialog due to unexpected error')
    }
  }

  const proceedWithDialogOpening = (stock: StockResult) => {
    try {
      console.log('🚀 Proceeding with dialog opening for:', stock.symbol)

      // Transform the stock data with comprehensive error handling
      const transformedStock = transformStockForDialog(stock)

      if (!transformedStock) {
        console.error('❌ transformStockForDialog returned null/undefined')
        setError('Failed to prepare stock data for analysis dialog')
        return
      }

      console.log('✅ Data transformation successful, setting dialog state')

      // Set dialog state with additional validation
      setDialogStock(transformedStock as any)
      setDialogOpen(stock.symbol)

      console.log('✅ Dialog state set - symbol:', stock.symbol)

      // Enhanced verification with error recovery
      setTimeout(() => {
        console.log('🔄 Post-state-update verification:')
        console.log('  - dialogOpen:', dialogOpen)
        console.log('  - dialogStock.symbol:', dialogStock?.symbol || 'null')

        // Check if dialog rendered successfully
        const dialogElements = document.querySelectorAll('[style*="z-index: 10000"], [style*="zIndex: 10000"], .dialog-backdrop')
        console.log('🔍 DOM verification - dialog elements found:', dialogElements.length)

        if (dialogElements.length === 0) {
          console.warn('⚠️ Dialog elements not found in DOM - possible rendering issue')

          // Attempt recovery by re-setting state
          console.log('🔄 Attempting dialog state recovery...')
          setDialogStock(transformedStock as any)
          setDialogOpen(stock.symbol)
        } else {
          console.log('✅ Dialog successfully rendered in DOM')
        }
      }, 150)

    } catch (error) {
      console.error('❌ Error in proceedWithDialogOpening:', error)
      setError('Failed to open analysis dialog: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleCloseDialog = () => {
    console.log('❌ handleCloseDialog called')
    console.log('📋 Current dialogOpen state before close:', dialogOpen)
    console.log('🎯 Current dialogStock state before close:', dialogStock?.symbol || 'null')

    // Clear any pending auto-open timeouts
    if (autoOpenTimeoutRef.current) {
      clearTimeout(autoOpenTimeoutRef.current)
      autoOpenTimeoutRef.current = null
      console.log('🧹 Cleared pending auto-open timeout')
    }

    setDialogOpen(null)
    setDialogStock(null)
    setDialogAutoOpened(false)

    console.log('✅ Dialog state cleared')
  }

  const handleActionTaken = (action: 'BUY' | 'SELL' | 'HOLD', symbol: string) => {
    console.log(`${action} action taken for ${symbol}`)
    // Here you could integrate with portfolio management, trading APIs, etc.

    // Show a confirmation message
    const actionMessage = `${action} recommendation noted for ${symbol}`
    console.log(actionMessage)

    // Optionally close the dialog after action
    // handleCloseDialog()
  }

  const getAnalysisSummary = () => {
    if (analysisType === 'sector' && selectedSector) {
      return `Analyzing: ${selectedSector.label} Sector`
    }
    if (analysisType === 'tickers' && selectedSymbols.length > 0) {
      return `Analyzing: ${selectedSymbols.join(', ')}`
    }
    return ''
  }

  const isAnalysisReady = (analysisType === 'sector' && selectedSector) ||
                         (analysisType === 'tickers' && selectedSymbols.length > 0)

  return (
    <>
      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      {/* Background Animation - Consistent with homepage */}
      <div className="bg-animation">
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
      </div>

      {/* Back to Home Button - Fixed position top left to mirror homepage button */}
      <div
        className="back-to-home-button-container"
        style={{
          position: 'fixed',
          top: '65px',
          left: '20px',
          zIndex: 1100,
          backgroundColor: 'transparent',
          width: 'auto',
          maxWidth: 'calc(100vw - 40px)',
          minWidth: '200px'
        }}
      >
        <Link
          href="/"
          className="inline-flex items-center justify-between w-full"
          style={{
            padding: '12px 16px',
            minHeight: '50px',
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid rgba(239, 68, 68, 0.6)',
            borderRadius: '12px',
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: '500',
            fontSize: '14px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: `
              0 4px 12px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(239, 68, 68, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(31, 41, 55, 0.9)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.8)'
            e.currentTarget.style.boxShadow = `
              0 8px 24px rgba(0, 0, 0, 0.5),
              0 0 25px rgba(239, 68, 68, 0.4),
              0 0 50px rgba(239, 68, 68, 0.2),
              0 0 0 1px rgba(239, 68, 68, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.15)
            `
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(17, 24, 39, 0.85)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)'
            e.currentTarget.style.boxShadow = `
              0 4px 12px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(239, 68, 68, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span className="flex items-center">
            <span style={{
              fontSize: '12px',
              color: 'rgba(239, 68, 68, 0.6)',
              transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              marginRight: '8px'
            }}>
              ←
            </span>
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Home</span>
          </span>
        </Link>
      </div>

      <div className="main-container" style={{marginTop: '120px'}}>
        <header className="header">
          <div className="logo">
            <img
              src="/assets/images/veritak_logo.png"
              alt="Veritak Financial Research LLC"
              className="logo-image prominent-logo"
              style={{
                height: '120px',
                width: 'auto',
                marginRight: '20px',
                filter: 'drop-shadow(0 4px 12px rgba(0, 200, 83, 0.3))',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            />
            <div className="logo-text-container">
              <div className="logo-text prominent-logo-text">Deep Analysis</div>
              <div className="company-tagline">Select. Analyze. Decide.</div>
            </div>
          </div>
          <p className="tagline">Comprehensive Financial Analysis & Market Intelligence Platform</p>
        </header>

        {/* Input Section */}
        <section style={{ padding: '2rem 1rem', position: 'relative', zIndex: 2 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {/* Input Section Header */}
            <div className="deep-analysis-header" style={{
              textAlign: 'center',
              marginBottom: '3rem',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '2rem',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
            }}>
              <h2 style={{
                fontSize: '2.5rem',
                fontWeight: '700',
                color: 'white',
                marginBottom: '1rem',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}>
                🔍 Start Your Analysis
              </h2>
              <p style={{
                fontSize: '1.2rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.6',
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                Choose a sector or enter specific stock tickers to begin comprehensive market analysis
              </p>
            </div>

            {/* Input Controls */}
            <div className="deep-analysis-input-grid" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem',
              marginBottom: '2rem',
              alignItems: 'start'
            }}>
              {/* Sector Selection */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '15px',
                padding: '2rem',
                transition: 'all 0.3s ease',
                boxShadow: analysisType === 'sector' ?
                  '0 10px 30px rgba(0, 200, 83, 0.3), 0 0 0 2px rgba(0, 200, 83, 0.5)' :
                  '0 4px 15px rgba(0, 0, 0, 0.2)'
              }}>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  🏢 Select Sector
                </h3>
                <SectorDropdown
                  onSectorChange={handleSectorChange}
                  currentSector={selectedSector}
                />
              </div>

              {/* Stock Symbol Search */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '15px',
                padding: '2rem',
                transition: 'all 0.3s ease',
                boxShadow: analysisType === 'tickers' ?
                  '0 10px 30px rgba(0, 200, 83, 0.3), 0 0 0 2px rgba(0, 200, 83, 0.5)' :
                  '0 4px 15px rgba(0, 0, 0, 0.2)'
              }}>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📈 Search Stock Symbols
                </h3>
                <StockAutocomplete
                  onSelectionChange={handleSymbolSelectionChange}
                  placeholder="Search stocks by symbol or company name (e.g., AAPL, Apple Inc)"
                  maxSelections={10}
                />
                <p style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: '0.5rem',
                  fontStyle: 'italic'
                }}>
                  Search and select multiple stocks for comparative analysis
                </p>
              </div>
            </div>

            {/* Run Analysis Button */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <button
                className="deep-analysis-button"
                onClick={handleRunAnalysis}
                disabled={!isAnalysisReady || isAnalyzing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: isAnalyzing ?
                    'rgba(100, 100, 100, 0.3)' :
                    isAnalysisReady ?
                      'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 102, 204, 0.9))' :
                      'rgba(100, 100, 100, 0.3)',
                  color: 'white',
                  padding: '1.5rem 3rem',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  cursor: (isAnalysisReady && !isAnalyzing) ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  boxShadow: (isAnalysisReady && !isAnalyzing) ?
                    '0 10px 30px rgba(0, 200, 83, 0.4)' :
                    '0 4px 15px rgba(0, 0, 0, 0.2)',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  backdropFilter: 'blur(10px)',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: (isAnalysisReady && !isAnalyzing) ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseEnter={(e) => {
                  if (isAnalysisReady && !isAnalyzing) {
                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 200, 83, 0.5)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (isAnalysisReady && !isAnalyzing) {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 200, 83, 0.4)'
                  }
                }}
              >
                <span style={{
                  fontSize: '1.5rem',
                  animation: isAnalyzing ? 'spin 2s linear infinite' : 'none'
                }}>
                  {isAnalyzing ? '⏳' : '🚀'}
                </span>
                {isAnalyzing ? 'Analysis in Progress...' : 'Run Deep Analysis'}
              </button>
            </div>

            {/* Confirmation Panel */}
            {showConfirmation && (
              <div className="deep-analysis-confirmation" style={{
                background: 'rgba(0, 200, 83, 0.9)',
                border: '3px solid rgba(255, 255, 255, 0.8)',
                borderRadius: '20px',
                padding: '2rem',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                marginTop: '2rem',
                position: 'relative',
                zIndex: 1000,
                width: '100%',
                maxWidth: '600px',
                margin: '2rem auto 0 auto'
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}>
                  ✅ Confirm Analysis
                </h3>

                <div style={{
                  background: 'rgba(0, 200, 83, 0.1)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: 'white',
                    margin: 0,
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                  }}>
                    {getAnalysisSummary()}
                  </p>
                </div>

                <div className="deep-analysis-confirmation-buttons" style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={handleConfirm}
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
                      color: 'white',
                      padding: '1rem 2rem',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 15px rgba(0, 200, 83, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 200, 83, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 200, 83, 0.3)'
                    }}
                  >
                    Confirm & Run
                  </button>

                  <button
                    onClick={handleCancel}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'rgba(239, 68, 68, 0.9)',
                      padding: '1rem 2rem',
                      border: '2px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '10px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}


            {/* Error State */}
            {error && (
              <div className="analysis-error" style={{
                background: 'rgba(239, 68, 68, 0.1)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                animation: 'fadeInUp 0.4s ease-out',
                marginTop: '2rem'
              }}>
                <div style={{
                  fontSize: '2rem',
                  marginBottom: '1rem'
                }}>
                  ❌
                </div>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'rgba(239, 68, 68, 0.9)',
                  marginBottom: '0.5rem'
                }}>
                  Analysis Failed
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: 'rgba(239, 68, 68, 0.8)',
                  margin: 0
                }}>
                  {error}
                </p>
                <button
                  onClick={() => setError(null)}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '8px',
                    color: 'rgba(239, 68, 68, 0.9)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Debug Button for Dialog Testing */}
            {analysisResult && analysisResult.topSelections && analysisResult.topSelections.length > 0 && (
              <div style={{
                textAlign: 'center',
                marginBottom: '1rem',
                padding: '1rem',
                background: 'rgba(255, 193, 7, 0.1)',
                border: '1px solid rgba(255, 193, 7, 0.3)',
                borderRadius: '12px'
              }}>
                {/* State Inspector */}
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontFamily: 'monospace'
                }}>
                  <div>dialogOpen: {JSON.stringify(dialogOpen)}</div>
                  <div>dialogStock: {dialogStock ? dialogStock.symbol : 'null'}</div>
                  <div>shouldRender: {JSON.stringify(!!(dialogOpen && dialogStock))}</div>
                </div>

                <button
                  onClick={() => {
                    console.log('🧪 DEBUG: Manual dialog trigger clicked')
                    const topStock = analysisResult.topSelections[0]
                    console.log('🎯 Manual trigger - calling handleOpenDialog with:', topStock.symbol)
                    handleOpenDialog(topStock)
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(255, 193, 7, 0.2)',
                    border: '2px solid rgba(255, 193, 7, 0.5)',
                    borderRadius: '8px',
                    color: 'rgba(255, 193, 7, 0.9)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    marginRight: '1rem'
                  }}
                >
                  🧪 DEBUG: Open Dialog Manually
                </button>

                <button
                  onClick={() => {
                    console.log('🔥 FORCE: Direct modal test')
                    setDialogOpen('TEST')
                    setDialogStock({
                      symbol: 'TEST',
                      score: { overall: 0.8, technical: 0.7, fundamental: 0.9, sentiment: 0.6 },
                      weight: 0.5,
                      action: 'BUY',
                      confidence: 0.85,
                      context: { sector: 'Technology', marketCap: 1000000000 },
                      reasoning: { primaryFactors: ['Test factor 1', 'Test factor 2'] },
                      dataQuality: { overall: { overall: 0.9, metrics: { freshness: 0.95, completeness: 0.9, accuracy: 0.95, sourceReputation: 0.9, latency: 0 }, timestamp: Date.now(), source: 'test' }, lastUpdated: Date.now() }
                    } as any)
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '2px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '8px',
                    color: 'rgba(239, 68, 68, 0.9)',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🔥 FORCE: Test Modal
                </button>
                <p style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  margin: '0.5rem 0 0 0'
                }}>
                  Click to manually trigger dialog if auto-open failed
                </p>
              </div>
            )}

            {/* Results Display */}
            {analysisResult && analysisResult.success && (
              <div className="analysis-results" style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(0, 200, 83, 0.3)',
                borderRadius: '20px',
                padding: '2rem',
                animation: 'fadeInUp 0.4s ease-out',
                marginTop: '2rem'
              }}>
                {/* Results Header */}
                <div style={{
                  textAlign: 'center',
                  marginBottom: '2rem',
                  paddingBottom: '1.5rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h2 style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    color: 'white',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}>
                    📊 Analysis Complete
                  </h2>
                  <p style={{
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginBottom: '0.5rem'
                  }}>
                    Found {analysisResult.topSelections?.length || 0} recommendations in {analysisResult.executionTime}ms
                  </p>
                  <div style={{
                    background: 'rgba(0, 200, 83, 0.1)',
                    border: '1px solid rgba(0, 200, 83, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    margin: '1rem 0'
                  }}>
                    <p style={{
                      fontSize: '1rem',
                      color: 'rgba(0, 200, 83, 0.9)',
                      margin: 0,
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      💡 Top recommendation analysis will open automatically
                    </p>
                    <p style={{
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.7)',
                      margin: '0.5rem 0 0 0',
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }}>
                      Click any other stock card below for detailed comparative analysis
                    </p>
                  </div>
                </div>

                {/* Metadata Panel */}
                <div style={{
                  background: 'rgba(0, 200, 83, 0.1)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <h3 style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: 'rgba(0, 200, 83, 0.9)',
                    marginBottom: '1rem'
                  }}>
                    Analysis Metadata
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <div>
                      <strong>Algorithm:</strong> {analysisResult.metadata?.algorithmUsed || 'N/A'}
                    </div>
                    <div>
                      <strong>Data Sources:</strong> {analysisResult.metadata?.dataSourcesUsed?.join(', ') || 'N/A'}
                    </div>
                    <div>
                      <strong>Cache Hit Rate:</strong> {Math.round((analysisResult.metadata?.cacheHitRate || 0) * 100)}%
                    </div>
                    <div>
                      <strong>Quality Score:</strong> {Math.round((analysisResult.metadata?.qualityScore?.overall || 0) * 100)}%
                    </div>
                  </div>
                </div>

                {/* Stock Results Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {(analysisResult.topSelections || []).map((stock, index) => (
                    <div
                      key={stock.symbol}
                      onClick={() => handleOpenDialog(stock)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '15px',
                        padding: '1.5rem',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                        e.currentTarget.style.borderColor = 'rgba(0, 200, 83, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 200, 83, 0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                      title={`Click to open detailed analysis for ${stock.symbol}`}
                    >
                      {/* Stock Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <h4 style={{
                            fontSize: '1.3rem',
                            fontWeight: '700',
                            color: 'white',
                            margin: 0
                          }}>
                            {stock.symbol}
                          </h4>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            margin: 0
                          }}>
                            {stock.context.sector}
                          </p>
                        </div>
                        <div style={{
                          textAlign: 'right'
                        }}>
                          <div style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: stock.action === 'BUY' ? 'rgba(0, 200, 83, 0.9)' :
                                   stock.action === 'SELL' ? 'rgba(239, 68, 68, 0.9)' :
                                   'rgba(255, 193, 7, 0.9)'
                          }}>
                            {stock.action}
                          </div>
                          <div style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            {Math.round(stock.confidence * 100)}% confidence
                          </div>
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div style={{
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.5rem'
                        }}>
                          <span style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.8)'
                          }}>
                            Overall Score
                          </span>
                          <span style={{
                            fontSize: '1rem',
                            fontWeight: '600',
                            color: 'white'
                          }}>
                            {Math.round(stock.score.overall * 100)}%
                          </span>
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.5rem',
                          fontSize: '0.8rem',
                          color: 'rgba(255, 255, 255, 0.6)'
                        }}>
                          <div>Technical: {Math.round(stock.score.technical * 100)}%</div>
                          <div>Fundamental: {Math.round(stock.score.fundamental * 100)}%</div>
                          <div>Sentiment: {Math.round(stock.score.sentiment * 100)}%</div>
                          <div>Weight: {Math.round(stock.weight * 100)}%</div>
                        </div>
                      </div>

                      {/* Primary Factors */}
                      {stock.reasoning.primaryFactors.length > 0 && (
                        <div style={{
                          marginBottom: '1rem'
                        }}>
                          <h5 style={{
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'rgba(0, 200, 83, 0.9)',
                            marginBottom: '0.5rem',
                            margin: 0
                          }}>
                            Key Factors:
                          </h5>
                          <ul style={{
                            fontSize: '0.8rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            margin: '0.5rem 0 0 0',
                            paddingLeft: '1rem'
                          }}>
                            {stock.reasoning.primaryFactors.slice(0, 3).map((factor, i) => (
                              <li key={i} style={{ marginBottom: '0.2rem' }}>
                                {factor}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Context Info */}
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'rgba(255, 255, 255, 0.5)',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        Market Cap: ${(stock.context.marketCap / 1e9).toFixed(1)}B
                        {stock.context.priceChange24h !== undefined && (
                          <span style={{ marginLeft: '1rem' }}>
                            24h: {stock.context.priceChange24h > 0 ? '+' : ''}{stock.context.priceChange24h.toFixed(2)}%
                          </span>
                        )}
                      </div>

                      {/* Click indicator */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '1rem',
                          right: '1rem',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(0, 200, 83, 0.2)',
                          border: '1px solid rgba(0, 200, 83, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: 'rgba(0, 200, 83, 0.8)',
                          opacity: 0.7,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        📊
                      </div>
                    </div>
                  ))}
                </div>

                {/* Performance Metrics */}
                {analysisResult.performance && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginTop: '2rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.2rem',
                      fontWeight: '600',
                      color: 'white',
                      marginBottom: '1rem'
                    }}>
                      Performance Metrics
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '1rem',
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      <div>
                        <strong>Data Fetch:</strong> {analysisResult.performance?.dataFetchTime || 0}ms
                      </div>
                      <div>
                        <strong>Analysis:</strong> {analysisResult.performance?.analysisTime || 0}ms
                      </div>
                      <div>
                        <strong>Fusion:</strong> {analysisResult.performance?.fusionTime || 0}ms
                      </div>
                      <div>
                        <strong>Cache:</strong> {analysisResult.performance?.cacheTime || 0}ms
                      </div>
                    </div>
                  </div>
                )}

                {/* New Analysis Button */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '2rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <button
                    onClick={() => {
                      // Clear any pending timeouts before resetting state
                      if (autoOpenTimeoutRef.current) {
                        clearTimeout(autoOpenTimeoutRef.current)
                        autoOpenTimeoutRef.current = null
                      }

                      setAnalysisResult(null)
                      setError(null)
                      setSelectedSector(undefined)
                      setSelectedSymbols([])
                      setAnalysisType(null)
                      setShowConfirmation(false)
                      setDialogOpen(null)
                      setDialogStock(null)
                      setDialogAutoOpened(false)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                      color: 'white',
                      padding: '1rem 2rem',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                      e.currentTarget.style.borderColor = 'rgba(0, 200, 83, 0.5)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <span>🔄</span>
                    Start New Analysis
                  </button>
                </div>
              </div>
            )}

            {/* Frontend Analysis Success State */}
            {frontendAnalysisResult && (
              <div className="analysis-success" style={{
                background: 'rgba(0, 200, 83, 0.1)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(0, 200, 83, 0.5)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                animation: 'fadeInUp 0.4s ease-out',
                marginTop: '2rem'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  ✅
                </div>

                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: 'rgba(0, 200, 83, 0.9)',
                  marginBottom: '1rem'
                }}>
                  Analysis Complete!
                </h3>

                <div style={{
                  background: 'rgba(0, 200, 83, 0.1)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '2rem',
                  textAlign: 'left'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <div>
                      <strong>Processing Time:</strong> {frontendAnalysisResult.processingTime}ms
                    </div>
                    <div>
                      <strong>Results Count:</strong> {frontendAnalysisResult.resultsCount} stocks
                    </div>
                    <div>
                      <strong>Analysis Mode:</strong> {frontendAnalysisResult.metadata.mode}
                    </div>
                    <div>
                      <strong>Data Sources:</strong> {frontendAnalysisResult.metadata.dataSourcesUsed.length} sources
                    </div>
                  </div>

                  <div style={{
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(0, 200, 83, 0.3)'
                  }}>
                    <p style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                      <strong>Analysis File:</strong> {frontendAnalysisResult.filePath}
                    </p>
                  </div>
                </div>

                <div className="success-actions" style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <a
                    href={`/analysis-results/${frontendAnalysisResult.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '1rem 2rem',
                      background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '12px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 15px rgba(0, 200, 83, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 200, 83, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 200, 83, 0.3)'
                    }}
                  >
                    <span>📊</span>
                    View Analysis Results
                  </a>

                  <button
                    onClick={() => {
                      // Clear any pending timeouts before resetting state
                      if (autoOpenTimeoutRef.current) {
                        clearTimeout(autoOpenTimeoutRef.current)
                        autoOpenTimeoutRef.current = null
                      }

                      setFrontendAnalysisResult(null)
                      setError(null)
                      setSelectedSector(undefined)
                      setSelectedSymbols([])
                      setAnalysisType(null)
                      setShowConfirmation(false)
                      setDialogOpen(null)
                      setDialogStock(null)
                      setDialogAutoOpened(false)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '1rem 2rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                      color: 'white',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                      e.currentTarget.style.borderColor = 'rgba(0, 200, 83, 0.5)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <span>🔄</span>
                    Start New Analysis
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="footer">
          <p>© 2025 Veritak Financial Research LLC | Educational & Informational Use Only</p>
          <p>✨ Transparency First • 🔒 Government Data Sources • 📚 Educational Focus</p>
          <p style={{marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8}}>
            Deep Analysis tools are provided for educational purposes only and should not be considered as investment advice.
          </p>
        </footer>
      </div>

      {/* Loading Overlay */}
      {isAnalyzing && (
        <AnalysisLoadingOverlay
          analysisType={analysisType}
          selectedSector={selectedSector}
          selectedSymbols={selectedSymbols}
          onCancel={() => {
            setIsAnalyzing(false)
            setShowConfirmation(false)
          }}
        />
      )}

      {/* Simple Results Display */}
      {dialogOpen && dialogStock && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Analysis Results: {dialogOpen}</h2>
            <button onClick={() => {
              setDialogOpen(null)
              setDialogStock(null)
            }} style={{
              background: '#333',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>Hide Results</button>
          </div>

          <div>
            <h3>Basic Info:</h3>
            <p>Symbol: {dialogOpen}</p>
            <p>Action: {dialogStock?.action || 'N/A'}</p>
            <p>Confidence: {dialogStock?.confidence || 'N/A'}</p>
            <p>Weight: {dialogStock?.weight || 'N/A'}</p>
          </div>

          <details style={{ marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', color: '#00c853' }}>Show Raw Data</summary>
            <pre style={{
              background: '#2a2a2a',
              padding: '16px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '11px',
              marginTop: '10px',
              maxHeight: '400px'
            }}>
              {JSON.stringify(dialogStock, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </>
  )
}