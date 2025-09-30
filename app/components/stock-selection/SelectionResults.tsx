'use client'

import React, { useState, useMemo } from 'react'
import {
  SelectionResponse,
  EnhancedStockResult,
  SectorAnalysisResult,
  MultiStockAnalysisResult,
  SelectionMode
} from '../../services/stock-selection/types'
import ExtendedHoursIndicator from '../market/ExtendedHoursIndicator'
import PreMarketAfterHoursDisplay from '../market/PreMarketAfterHoursDisplay'
import { formatMarketCap } from '../stock-analysis/utils/formatters'

/**
 * Component props
 */
interface SelectionResultsProps {
  result: SelectionResponse | null
  isLoading: boolean
  error: string | null
  executionTime: number
  lastUpdate: number
  className?: string
}

/**
 * Stock card component for displaying individual stock results
 */
interface StockCardProps {
  stock: EnhancedStockResult
  index: number
  showDetails?: boolean
  onToggleDetails?: () => void
}

function StockCard({ stock, index, showDetails = false, onToggleDetails }: StockCardProps) {
  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-green-400 bg-green-900'
      case 'SELL': return 'text-red-400 bg-red-900'
      case 'HOLD': return 'text-yellow-400 bg-yellow-900'
      default: return 'text-gray-400 bg-gray-700'
    }
  }

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-all duration-200">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-3">#{index + 1}</span>
            <h3 className="text-lg font-bold text-white">{stock.symbol}</h3>
            <span className={`ml-3 px-2 py-1 rounded text-xs font-medium ${getActionColor(stock.action)}`}>
              {stock.action}
            </span>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white">
              {(stock.score.overallScore * 100).toFixed(0)}
            </div>
            <div className="text-xs text-gray-400">Score</div>
          </div>
        </div>

        {/* Market Data */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div className="text-lg font-medium text-white">
              ${stock.score.marketData.price.toFixed(2)}
            </div>
            <div className="text-sm text-gray-400">Current Price</div>
          </div>
          <div>
            <div className={`text-lg font-medium ${
              (stock.context.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPercentage(stock.context.priceChange24h || 0)}
            </div>
            <div className="text-sm text-gray-400">24h Change</div>
          </div>
        </div>

        {/* Extended Hours Data */}
        {(stock.context.preMarketPrice || stock.context.afterHoursPrice) && (
          <div className="mb-3">
            <PreMarketAfterHoursDisplay
              symbol={stock.symbol}
              regularPrice={stock.score.marketData.price}
              extendedHoursData={{
                preMarketPrice: stock.context.preMarketPrice,
                preMarketChange: stock.context.preMarketChange,
                preMarketChangePercent: stock.context.preMarketChangePercent,
                afterHoursPrice: stock.context.afterHoursPrice,
                afterHoursChange: stock.context.afterHoursChange,
                afterHoursChangePercent: stock.context.afterHoursChangePercent,
                marketStatus: stock.context.marketStatus
              }}
            />
          </div>
        )}

        {/* Key Metrics */}
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-gray-400">Sector:</span>
            <span className="text-white ml-1">{stock.context.sector}</span>
          </div>
          <div>
            <span className="text-gray-400">Market Cap:</span>
            <span className="text-white ml-1">{formatMarketCap(stock.context.marketCap)}</span>
          </div>
        </div>

        {/* Confidence & Weight */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-2">Confidence:</span>
            <div className="flex items-center">
              <div className="w-16 h-2 bg-gray-700 rounded-full mr-2">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${stock.confidence * 100}%` }}
                ></div>
              </div>
              <span className="text-sm text-white">{(stock.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-400">Weight:</span>
            <span className="text-white ml-1">{(stock.weight * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Toggle Details Button */}
        {onToggleDetails && (
          <button
            onClick={onToggleDetails}
            className="mt-3 w-full py-2 text-sm text-gray-400 hover:text-white transition-colors duration-200"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        )}
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className="border-t border-gray-700 p-4 bg-gray-900">
          {/* Primary Factors */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Primary Factors</h4>
            <div className="flex flex-wrap gap-2">
              {stock.reasoning.primaryFactors.map((factor, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-blue-900 text-blue-300 text-xs rounded"
                >
                  {factor}
                </span>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {stock.reasoning.warnings && stock.reasoning.warnings.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Warnings</h4>
              <ul className="space-y-1">
                {stock.reasoning.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-red-400 flex items-start">
                    <span className="mr-2">⚠️</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Opportunities */}
          {stock.reasoning.opportunities && stock.reasoning.opportunities.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Opportunities</h4>
              <ul className="space-y-1">
                {stock.reasoning.opportunities.map((opportunity, idx) => (
                  <li key={idx} className="text-sm text-green-400 flex items-start">
                    <span className="mr-2">✨</span>
                    {opportunity}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Quality */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Data Quality</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Overall:</span>
                <span className="text-white ml-2">
                  {(stock.dataQuality.overall.overall * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                <span className="text-gray-400">Freshness:</span>
                <span className="text-white ml-2">
                  {(stock.dataQuality.overall.metrics.freshness * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Sector overview component
 */
function SectorOverview({ sectorAnalysis }: { sectorAnalysis: SectorAnalysisResult }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
      <div className="flex items-center mb-4">
        <span className="text-2xl mr-3">
          {sectorAnalysis.sector.category === 'index' ? '📊' :
           sectorAnalysis.sector.category === 'etf' ? '💹' : '🏢'}
        </span>
        <div>
          <h3 className="text-xl font-bold text-white">{sectorAnalysis.sector.label}</h3>
          <p className="text-gray-400">{sectorAnalysis.sector.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{sectorAnalysis.overview.totalStocks}</div>
          <div className="text-sm text-gray-400">Total Stocks</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">
            {(sectorAnalysis.overview.avgScore * 100).toFixed(0)}
          </div>
          <div className="text-sm text-gray-400">Avg Score</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{sectorAnalysis.overview.topPerformers}</div>
          <div className="text-sm text-gray-400">Top Performers</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">{sectorAnalysis.overview.underperformers}</div>
          <div className="text-sm text-gray-400">Underperformers</div>
        </div>
      </div>

      {/* Sector Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Momentum', value: sectorAnalysis.sectorMetrics.momentum, color: 'blue' },
          { label: 'Valuation', value: sectorAnalysis.sectorMetrics.valuation, color: 'green' },
          { label: 'Growth', value: sectorAnalysis.sectorMetrics.growth, color: 'purple' },
          { label: 'Stability', value: sectorAnalysis.sectorMetrics.stability, color: 'orange' }
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <div className={`text-lg font-bold text-${color}-400`}>
              {(value * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-400">{label}</div>
            <div className="w-full h-2 bg-gray-700 rounded-full mt-1">
              <div
                className={`h-full bg-${color}-500 rounded-full`}
                style={{ width: `${value * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Portfolio metrics component for multi-stock analysis
 */
function PortfolioMetrics({ multiStockAnalysis }: { multiStockAnalysis: MultiStockAnalysisResult }) {
  const { portfolioMetrics } = multiStockAnalysis

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
      <h3 className="text-xl font-bold text-white mb-4">Portfolio Metrics</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Metrics */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Overall Performance</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Overall Score:</span>
              <span className="text-white font-medium">
                {(portfolioMetrics.overallScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Risk Score:</span>
              <span className="text-white font-medium">
                {portfolioMetrics.riskScore.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Diversification:</span>
              <span className="text-white font-medium">
                {(portfolioMetrics.diversificationScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Sector Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Sector Allocation</h4>
          <div className="space-y-2">
            {Object.entries(portfolioMetrics.sectorBreakdown).map(([sector, weight]) => (
              <div key={sector} className="flex justify-between">
                <span className="text-gray-400 text-sm">{sector}:</span>
                <span className="text-white font-medium">
                  {(weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Market Cap Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Market Cap Distribution</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Large Cap:</span>
              <span className="text-white font-medium">
                {(portfolioMetrics.marketCapBreakdown.large * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mid Cap:</span>
              <span className="text-white font-medium">
                {(portfolioMetrics.marketCapBreakdown.mid * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Small Cap:</span>
              <span className="text-white font-medium">
                {(portfolioMetrics.marketCapBreakdown.small * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Warnings */}
      {multiStockAnalysis.recommendations.riskWarnings &&
       multiStockAnalysis.recommendations.riskWarnings.length > 0 && (
        <div className="mt-4 p-3 bg-red-900 border border-red-700 rounded-lg">
          <h4 className="text-sm font-medium text-red-300 mb-2">Risk Warnings</h4>
          <ul className="space-y-1">
            {multiStockAnalysis.recommendations.riskWarnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-red-400">⚠️ {warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Main SelectionResults component
 */
export default function SelectionResults({
  result,
  isLoading,
  error,
  executionTime,
  lastUpdate,
  className = ''
}: SelectionResultsProps) {
  const [expandedStock, setExpandedStock] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Memoized data extraction
  const resultsData = useMemo(() => {
    if (!result || !result.success) return null

    return {
      mode: result.metadata.analysisMode,
      topSelections: result.topSelections || [],
      sectorAnalysis: result.sectorAnalysis,
      multiStockAnalysis: result.multiStockAnalysis,
      executionTime: result.executionTime,
      cacheHitRate: result.metadata.cacheHitRate,
      dataQuality: result.metadata.qualityScore
    }
  }, [result])

  // Loading state
  if (isLoading) {
    return (
      <div className={`selection-results ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-400">Analyzing your selection...</p>
          </div>
        </div>
      </div>
    )
  }

  // No results state
  if (!result || !resultsData) {
    return (
      <div className={`selection-results ${className}`}>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-medium text-gray-400 mb-2">Ready for Analysis</h3>
          <p className="text-gray-500">Select your analysis mode and enter symbols to get started</p>
        </div>
      </div>
    )
  }

  const { mode, topSelections, sectorAnalysis, multiStockAnalysis } = resultsData

  return (
    <div className={`selection-results ${className}`}>
      {/* Market Status Indicator */}
      <div className="mb-4">
        <ExtendedHoursIndicator
          marketStatus={topSelections[0]?.context?.marketStatus}
        />
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">Analysis Results</h3>
          <p className="text-sm text-gray-400">
            Completed in {executionTime}ms •
            Cache hit rate: {(result.metadata.cacheHitRate * 100).toFixed(0)}% •
            {lastUpdate > 0 && ` Last updated: ${new Date(lastUpdate).toLocaleTimeString()}`}
          </p>
        </div>

        {topSelections.length > 1 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded text-sm ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded text-sm ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              List
            </button>
          </div>
        )}
      </div>

      {/* Mode-specific Overview */}
      {mode === SelectionMode.SECTOR_ANALYSIS && sectorAnalysis && (
        <SectorOverview sectorAnalysis={sectorAnalysis} />
      )}

      {mode === SelectionMode.MULTIPLE_STOCKS && multiStockAnalysis && (
        <PortfolioMetrics multiStockAnalysis={multiStockAnalysis} />
      )}

      {/* Top Selections */}
      {topSelections.length > 0 && (
        <div>
          <h4 className="text-lg font-medium text-white mb-4">
            {mode === SelectionMode.SINGLE_STOCK ? 'Analysis Result' :
             mode === SelectionMode.SECTOR_ANALYSIS ? 'Top Sector Picks' :
             'Portfolio Analysis'}
          </h4>

          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-4'
          }>
            {topSelections.map((stock, index) => (
              <StockCard
                key={`${stock.symbol}-${index}`}
                stock={stock}
                index={index}
                showDetails={expandedStock === index}
                onToggleDetails={() => setExpandedStock(
                  expandedStock === index ? null : index
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Data Quality Footer */}
      <div className="mt-8 pt-6 border-t border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Algorithm:</span>
            <span className="text-white ml-2">{result.metadata.algorithmUsed}</span>
          </div>
          <div>
            <span className="text-gray-400">Data Sources:</span>
            <span className="text-white ml-2">{result.metadata.dataSourcesUsed.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Quality Score:</span>
            <span className="text-white ml-2">
              {(result.metadata.qualityScore.overall * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-gray-400">Execution:</span>
            <span className="text-white ml-2">{executionTime}ms</span>
          </div>
        </div>
      </div>
    </div>
  )
}