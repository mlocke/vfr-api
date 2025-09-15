'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import StockSelectionPanel from '../components/stock-selection/StockSelectionPanel'
import SelectionResults from '../components/stock-selection/SelectionResults'
import { SelectionResponse } from '../services/stock-selection/types'
import { AlgorithmType } from '../services/algorithms/types'
import useStockSelection from '../hooks/useStockSelection'

export default function StockIntelligencePage() {
  const [selectionResult, setSelectionResult] = useState<SelectionResponse | null>(null)

  // Initialize the stock selection hook with enhanced configuration
  const stockSelection = useStockSelection({
    enableRealTime: true,
    defaultAlgorithm: AlgorithmType.COMPOSITE,
    autoReconnect: true,
    updateInterval: 3000 // 3 second updates for real-time feel
  })

  // Extract the isLoading state from the hook (renamed for semantic clarity)
  const { isLoading: isAnalyzing } = stockSelection

  const handleSelectionChange = useCallback((result: SelectionResponse) => {
    setSelectionResult(result)
  }, [])

  const handleAnalysisStart = useCallback(() => {
    // Analysis start is handled by the hook's loading state
  }, [])

  const handleAnalysisComplete = useCallback(() => {
    // Analysis completion is handled by the hook's state updates
  }, [])

  return (
    <>
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

      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
        {/* Header Section */}
        <header className="relative z-10 pt-8 pb-6">
          <div className="container mx-auto px-6">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                className="flex items-center text-green-400 hover:text-green-300 transition-colors duration-200"
              >
                <span className="mr-2">←</span>
                <span className="font-medium">Back to Home</span>
              </Link>

              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-400">
                  Powered by MCP Intelligence
                </div>
              </div>
            </div>

            {/* Page Title */}
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-4">
                Stock Intelligence Platform
              </h1>
              <p className="text-xl md:text-2xl text-green-400 font-mono tracking-wider mb-2">
                Select. Analyze. Decide.
              </p>
              <p className="text-gray-300 max-w-3xl mx-auto text-lg">
                Harness advanced algorithms and real-time market data to make informed investment decisions.
                Powered by our proprietary MCP-native infrastructure for institutional-grade analysis.
              </p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 container mx-auto px-6 pb-12">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Selection & Configuration Panel */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-gray-800/50 backdrop-blur-sm border border-green-500/20 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-green-400 mb-6 flex items-center">
                  <span className="mr-3">🎯</span>
                  Analysis Configuration
                </h2>

                <StockSelectionPanel
                  onSelectionChange={handleSelectionChange}
                  onAnalysisStart={handleAnalysisStart}
                  onAnalysisComplete={handleAnalysisComplete}
                  showAdvancedOptions={true}
                />
              </div>

              {/* Analysis Status Panel */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-blue-500/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center">
                  <span className="mr-3">📊</span>
                  Analysis Status
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Current Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      isAnalyzing
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : selectionResult
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {isAnalyzing ? 'Analyzing...' : selectionResult ? 'Complete' : 'Ready'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Data Sources:</span>
                    <span className="text-green-400 text-sm">
                      MCP • Real-time
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Performance:</span>
                    <span className="text-green-400 text-sm">
                      &lt;100ms response
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Display Panel */}
            <div className="xl:col-span-2">
              <div className="bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 min-h-[600px]">
                <h2 className="text-2xl font-bold text-purple-400 mb-6 flex items-center">
                  <span className="mr-3">🚀</span>
                  Intelligence Results
                </h2>

                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center h-96 space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-green-500/30 border-t-green-400 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-blue-400 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
                    </div>
                    <div className="text-center">
                      <p className="text-xl text-green-400 font-mono mb-2">Analyzing Market Data...</p>
                      <p className="text-gray-400">Processing algorithms and real-time intelligence</p>
                    </div>
                  </div>
                ) : selectionResult ? (
                  <SelectionResults
                    result={selectionResult}
                    showAdvancedMetrics={true}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 space-y-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                      <span className="text-4xl">🧠</span>
                    </div>
                    <div className="text-center">
                      <p className="text-xl text-purple-400 font-mono mb-2">Ready for Analysis</p>
                      <p className="text-gray-400 max-w-md">
                        Configure your analysis parameters and select stocks to receive
                        real-time intelligence and investment recommendations.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800/30 backdrop-blur-sm border border-green-500/20 rounded-lg p-6 text-center">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Real-time Analysis</h3>
              <p className="text-gray-300 text-sm">
                Sub-100ms response times with live market data streaming and instant recommendations.
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-blue-500/20 rounded-lg p-6 text-center">
              <div className="text-3xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-blue-400 mb-2">AI-Powered Algorithms</h3>
              <p className="text-gray-300 text-sm">
                Advanced factor-based scoring with 8+ algorithms for comprehensive market intelligence.
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 text-center">
              <div className="text-3xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-purple-400 mb-2">MCP-Native Infrastructure</h3>
              <p className="text-gray-300 text-sm">
                Powered by Model Context Protocol for seamless data integration and superior performance.
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 text-center text-gray-500 text-sm max-w-4xl mx-auto">
            <p>
              This analysis is provided for educational and informational purposes only and should not be considered as investment advice.
              All investment decisions should be made in consultation with qualified financial advisors.
              Past performance does not guarantee future results.
            </p>
          </div>
        </main>
      </div>
    </>
  )
}