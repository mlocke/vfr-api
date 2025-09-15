'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { SectorOption } from '../SectorDropdown'
import SectorDropdown from '../SectorDropdown'
import { SelectionOptions, SelectionMode } from '../../services/stock-selection/types'
import { AlgorithmType } from '../../services/algorithms/types'
import useStockSelection from '../../hooks/useStockSelection'
import AlgorithmSelector from './AlgorithmSelector'
import SelectionResults from './SelectionResults'

/**
 * Component props
 */
interface StockSelectionPanelProps {
  className?: string
  onSelectionChange?: (results: any) => void
  defaultMode?: SelectionMode
  showAdvancedOptions?: boolean
}

/**
 * Input mode type for flexible input handling
 */
type InputMode = 'single' | 'multiple' | 'sector'

/**
 * Component state interface
 */
interface PanelState {
  inputMode: InputMode
  singleStock: string
  multipleStocks: string[]
  selectedSector: SectorOption | undefined
  currentInput: string
  showAdvanced: boolean
  algorithmOptions: SelectionOptions
}

/**
 * Main Stock Selection Panel component with flexible input handling
 */
export default function StockSelectionPanel({
  className = '',
  onSelectionChange,
  defaultMode = SelectionMode.SINGLE_STOCK,
  showAdvancedOptions = false
}: StockSelectionPanelProps) {

  // Initialize hook
  const stockSelection = useStockSelection({
    enableRealTime: true,
    defaultAlgorithm: AlgorithmType.COMPOSITE
  })

  // Component state
  const [state, setState] = useState<PanelState>({
    inputMode: defaultMode === SelectionMode.SECTOR_ANALYSIS ? 'sector' :
               defaultMode === SelectionMode.MULTIPLE_STOCKS ? 'multiple' : 'single',
    singleStock: '',
    multipleStocks: [],
    selectedSector: undefined,
    currentInput: '',
    showAdvanced: showAdvancedOptions,
    algorithmOptions: {
      algorithmId: AlgorithmType.COMPOSITE,
      useRealTimeData: true,
      includeSentiment: false,
      includeNews: false,
      riskTolerance: 'moderate'
    }
  })

  // Refs for input management
  const inputRef = useRef<HTMLInputElement>(null)
  const multiSelectRef = useRef<HTMLDivElement>(null)

  /**
   * Handle input mode change
   */
  const handleModeChange = useCallback((mode: InputMode) => {
    setState(prev => ({
      ...prev,
      inputMode: mode,
      currentInput: '',
      singleStock: '',
      multipleStocks: [],
      selectedSector: undefined
    }))

    // Focus input after mode change
    setTimeout(() => {
      if (inputRef.current && mode !== 'sector') {
        inputRef.current.focus()
      }
    }, 100)
  }, [])

  /**
   * Handle single stock input
   */
  const handleSingleStockChange = useCallback((value: string) => {
    const cleanValue = value.toUpperCase().replace(/[^A-Z]/g, '')
    setState(prev => ({
      ...prev,
      singleStock: cleanValue,
      currentInput: cleanValue
    }))
  }, [])

  /**
   * Handle multiple stocks input (comma-separated)
   */
  const handleMultipleStocksInput = useCallback((value: string) => {
    setState(prev => ({ ...prev, currentInput: value }))

    // Parse comma-separated symbols
    const symbols = value
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0 && /^[A-Z]+$/.test(s))

    setState(prev => ({ ...prev, multipleStocks: symbols }))
  }, [])

  /**
   * Add stock to multiple stocks list
   */
  const addStockToMultiple = useCallback((symbol: string) => {
    const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z]/g, '')
    if (cleanSymbol && !state.multipleStocks.includes(cleanSymbol)) {
      setState(prev => ({
        ...prev,
        multipleStocks: [...prev.multipleStocks, cleanSymbol],
        currentInput: ''
      }))
    }
  }, [state.multipleStocks])

  /**
   * Remove stock from multiple stocks list
   */
  const removeStockFromMultiple = useCallback((symbol: string) => {
    setState(prev => ({
      ...prev,
      multipleStocks: prev.multipleStocks.filter(s => s !== symbol)
    }))
  }, [])

  /**
   * Handle sector selection
   */
  const handleSectorChange = useCallback((sector: SectorOption) => {
    setState(prev => ({ ...prev, selectedSector: sector }))
  }, [])

  /**
   * Handle algorithm options change
   */
  const handleAlgorithmOptionsChange = useCallback((options: Partial<SelectionOptions>) => {
    setState(prev => ({
      ...prev,
      algorithmOptions: { ...prev.algorithmOptions, ...options }
    }))
  }, [])

  /**
   * Execute analysis based on current input mode
   */
  const executeAnalysis = useCallback(async () => {
    try {
      let result

      switch (state.inputMode) {
        case 'single':
          if (!state.singleStock) {
            throw new Error('Please enter a stock symbol')
          }
          result = await stockSelection.analyzeStock(state.singleStock, state.algorithmOptions)
          break

        case 'multiple':
          if (state.multipleStocks.length === 0) {
            throw new Error('Please enter at least one stock symbol')
          }
          result = await stockSelection.analyzeStocks(state.multipleStocks, state.algorithmOptions)
          break

        case 'sector':
          if (!state.selectedSector) {
            throw new Error('Please select a sector')
          }
          result = await stockSelection.analyzeSector(state.selectedSector, state.algorithmOptions)
          break

        default:
          throw new Error('Invalid input mode')
      }

      // Notify parent component
      if (onSelectionChange) {
        onSelectionChange(result)
      }

    } catch (error) {
      console.error('Analysis failed:', error)
    }
  }, [state, stockSelection, onSelectionChange])

  /**
   * Handle Enter key press for quick analysis
   */
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !stockSelection.isLoading) {
      event.preventDefault()

      if (state.inputMode === 'multiple' && state.currentInput.trim()) {
        // Add current input to multiple stocks
        addStockToMultiple(state.currentInput.trim())
      } else {
        // Execute analysis
        executeAnalysis()
      }
    }
  }, [state.inputMode, state.currentInput, stockSelection.isLoading, addStockToMultiple, executeAnalysis])

  /**
   * Check if analysis can be executed
   */
  const canAnalyze = useCallback(() => {
    switch (state.inputMode) {
      case 'single':
        return state.singleStock.length > 0
      case 'multiple':
        return state.multipleStocks.length > 0
      case 'sector':
        return state.selectedSector !== undefined
      default:
        return false
    }
  }, [state])

  /**
   * Auto-focus input on mount
   */
  useEffect(() => {
    if (inputRef.current && state.inputMode !== 'sector') {
      inputRef.current.focus()
    }
  }, [state.inputMode])

  return (
    <div className={`stock-selection-panel ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Stock Selection Analysis</h2>
        <p className="text-gray-400">
          Analyze individual stocks, sectors, or portfolios using advanced algorithms
        </p>
      </div>

      {/* Input Mode Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">Analysis Mode</label>
        <div className="flex space-x-2">
          {[
            { mode: 'single' as InputMode, label: 'Single Stock', icon: '📈' },
            { mode: 'multiple' as InputMode, label: 'Multiple Stocks', icon: '📊' },
            { mode: 'sector' as InputMode, label: 'Sector Analysis', icon: '🏢' }
          ].map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`
                flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-200
                ${state.inputMode === mode
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
              `}
            >
              <span className="mr-2">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Section */}
      <div className="mb-6">
        {/* Single Stock Input */}
        {state.inputMode === 'single' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stock Symbol
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter stock symbol (e.g., AAPL)"
              value={state.currentInput}
              onChange={(e) => handleSingleStockChange(e.target.value)}
              onKeyPress={handleKeyPress}
              className="
                w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg
                text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                focus:border-transparent transition-all duration-200
              "
              maxLength={10}
            />
            {state.singleStock && (
              <p className="mt-2 text-sm text-gray-400">
                Ready to analyze: <span className="text-blue-400 font-medium">{state.singleStock}</span>
              </p>
            )}
          </div>
        )}

        {/* Multiple Stocks Input */}
        {state.inputMode === 'multiple' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stock Symbols
            </label>

            {/* Selected stocks display */}
            {state.multipleStocks.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2" ref={multiSelectRef}>
                {state.multipleStocks.map((symbol) => (
                  <span
                    key={symbol}
                    className="
                      inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm
                      rounded-full transition-all duration-200 hover:bg-blue-700
                    "
                  >
                    {symbol}
                    <button
                      onClick={() => removeStockFromMultiple(symbol)}
                      className="ml-2 text-blue-200 hover:text-white focus:outline-none"
                      aria-label={`Remove ${symbol}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              placeholder="Enter stock symbols (e.g., AAPL, MSFT, GOOGL) or comma-separated"
              value={state.currentInput}
              onChange={(e) => handleMultipleStocksInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="
                w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg
                text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                focus:border-transparent transition-all duration-200
              "
            />
            <p className="mt-2 text-sm text-gray-400">
              {state.multipleStocks.length > 0
                ? `Selected ${state.multipleStocks.length} stock(s). Press Enter to add more or click Analyze.`
                : 'Enter stock symbols separated by commas, or add them one by one.'
              }
            </p>
          </div>
        )}

        {/* Sector Selection */}
        {state.inputMode === 'sector' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Sector or Index
            </label>
            <SectorDropdown
              onSectorChange={handleSectorChange}
              currentSector={state.selectedSector}
              loading={false}
              disabled={stockSelection.isLoading}
            />
          </div>
        )}
      </div>

      {/* Algorithm Selector */}
      <div className="mb-6">
        <button
          onClick={() => setState(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
          className="
            flex items-center text-sm font-medium text-gray-300 hover:text-white
            transition-colors duration-200 mb-3
          "
        >
          <span className={`mr-2 transition-transform duration-200 ${state.showAdvanced ? 'rotate-90' : ''}`}>
            ▶
          </span>
          Advanced Options
        </button>

        {state.showAdvanced && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <AlgorithmSelector
              options={state.algorithmOptions}
              onChange={handleAlgorithmOptionsChange}
              disabled={stockSelection.isLoading}
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={executeAnalysis}
          disabled={!canAnalyze() || stockSelection.isLoading}
          className={`
            flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200
            ${canAnalyze() && !stockSelection.isLoading
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {stockSelection.isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Analyzing...
            </>
          ) : (
            <>
              <span className="mr-2">🔍</span>
              Analyze
            </>
          )}
        </button>

        {stockSelection.isLoading && (
          <button
            onClick={stockSelection.cancelAnalysis}
            className="
              px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg
              font-medium transition-all duration-200
            "
          >
            Cancel
          </button>
        )}

        {stockSelection.result && (
          <button
            onClick={stockSelection.clearResults}
            className="
              px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg
              font-medium transition-all duration-200
            "
          >
            Clear
          </button>
        )}
      </div>

      {/* Status Indicators */}
      {stockSelection.error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-300">
            <span className="font-medium">Error:</span> {stockSelection.error}
          </p>
          {stockSelection.retryAnalysis && (
            <button
              onClick={stockSelection.retryAnalysis}
              className="mt-2 text-sm text-red-200 hover:text-white underline"
            >
              Retry Analysis
            </button>
          )}
        </div>
      )}

      {stockSelection.isConnected && (
        <div className="mb-6 flex items-center text-sm text-green-400">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
          Real-time updates enabled
        </div>
      )}

      {/* Results Display */}
      <SelectionResults
        result={stockSelection.result}
        isLoading={stockSelection.isLoading}
        error={stockSelection.error}
        executionTime={stockSelection.executionTime}
        lastUpdate={stockSelection.lastUpdate}
      />
    </div>
  )
}