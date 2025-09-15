/**
 * Comprehensive test suite for StockSelectionPanel React component
 * Tests user interactions, mode switching, form validation, and integration with useStockSelection hook
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import StockSelectionPanel from '../StockSelectionPanel'
import type { SelectionMode, SelectionResponse } from '../../../services/stock-selection/types'
import type { SectorOption } from '../../SectorDropdown'
import { AlgorithmType } from '../../../services/algorithms/types'

// Mock the useStockSelection hook
const mockUseStockSelection = {
  isLoading: false,
  error: null,
  result: null,
  requestId: null,
  executionTime: 0,
  isConnected: false,
  lastUpdate: 0,
  analyzeStock: jest.fn(),
  analyzeSector: jest.fn(),
  analyzeStocks: jest.fn(),
  cancelAnalysis: jest.fn(),
  retryAnalysis: jest.fn(),
  clearResults: jest.fn(),
  subscribeToUpdates: jest.fn(),
  unsubscribeFromUpdates: jest.fn(),
  getSingleStockResult: jest.fn(),
  getSectorAnalysisResult: jest.fn(),
  getMultiStockResult: jest.fn(),
  getTopSelections: jest.fn()
}

jest.mock('../../../hooks/useStockSelection', () => ({
  __esModule: true,
  default: jest.fn(() => mockUseStockSelection)
}))

// Mock child components
jest.mock('../../SectorDropdown', () => {
  return function MockSectorDropdown({ onSectorChange, currentSector, loading, disabled }: any) {
    return (
      <div data-testid="sector-dropdown">
        <select
          data-testid="sector-select"
          onChange={(e) => {
            const sector: SectorOption = { value: e.target.value, label: e.target.value }
            onSectorChange(sector)
          }}
          disabled={disabled || loading}
          value={currentSector?.value || ''}
        >
          <option value="">Select a sector</option>
          <option value="technology">Technology</option>
          <option value="healthcare">Healthcare</option>
          <option value="finance">Finance</option>
        </select>
      </div>
    )
  }
})

jest.mock('./AlgorithmSelector', () => {
  return function MockAlgorithmSelector({ options, onChange, disabled }: any) {
    return (
      <div data-testid="algorithm-selector">
        <select
          data-testid="algorithm-select"
          onChange={(e) => onChange({ algorithmId: e.target.value })}
          disabled={disabled}
          value={options?.algorithmId || ''}
        >
          <option value={AlgorithmType.COMPOSITE}>Composite</option>
          <option value={AlgorithmType.TECHNICAL}>Technical</option>
          <option value={AlgorithmType.FUNDAMENTAL}>Fundamental</option>
        </select>
        <input
          data-testid="risk-tolerance-input"
          type="text"
          value={options?.riskTolerance || ''}
          onChange={(e) => onChange({ riskTolerance: e.target.value })}
          placeholder="Risk tolerance"
        />
        <label>
          <input
            data-testid="real-time-checkbox"
            type="checkbox"
            checked={options?.useRealTimeData || false}
            onChange={(e) => onChange({ useRealTimeData: e.target.checked })}
          />
          Use Real Time Data
        </label>
      </div>
    )
  }
})

jest.mock('./SelectionResults', () => {
  return function MockSelectionResults({ result, isLoading, error, executionTime, lastUpdate }: any) {
    return (
      <div data-testid="selection-results">
        {isLoading && <div data-testid="loading-indicator">Loading...</div>}
        {error && <div data-testid="error-display">{error}</div>}
        {result && (
          <div data-testid="results-display">
            <div data-testid="execution-time">{executionTime}ms</div>
            <div data-testid="last-update">{lastUpdate}</div>
            <div data-testid="result-data">{JSON.stringify(result)}</div>
          </div>
        )}
      </div>
    )
  }
})

describe('StockSelectionPanel Component', () => {
  let mockOnSelectionChange: jest.Mock
  let user: ReturnType<typeof userEvent.setup>

  // Test data
  const mockSuccessResponse: SelectionResponse = {
    success: true,
    requestId: 'test-request-id',
    timestamp: Date.now(),
    executionTime: 1500,
    topSelections: [
      {
        symbol: 'AAPL',
        score: {
          overall: 8.5,
          technical: 7.8,
          fundamental: 9.2,
          sentiment: 8.1,
          marketData: {
            price: 150.25,
            volume: 50000000,
            marketCap: 2500000000000,
            avgVolume: 45000000
          }
        },
        weight: 0.25,
        action: 'BUY',
        confidence: 0.85,
        context: {
          sector: 'Technology',
          marketCap: 2500000000000,
          priceChange24h: 2.5,
          volumeChange24h: 10.2,
          beta: 1.2
        },
        reasoning: {
          primaryFactors: ['Strong technical momentum'],
          warnings: ['High valuation'],
          opportunities: ['Product launch potential']
        },
        dataQuality: {
          overall: { score: 9.5, timestamp: Date.now(), source: 'multiple' },
          sourceBreakdown: {
            'polygon': { score: 9.8, timestamp: Date.now(), source: 'polygon' }
          },
          lastUpdated: Date.now()
        }
      }
    ],
    metadata: {
      algorithmUsed: 'composite',
      dataSourcesUsed: ['polygon', 'finnhub'],
      cacheHitRate: 0.75,
      analysisMode: SelectionMode.SINGLE_STOCK,
      qualityScore: { score: 9.2, timestamp: Date.now(), source: 'multiple' }
    },
    performance: {
      dataFetchTime: 500,
      analysisTime: 800,
      fusionTime: 150,
      cacheTime: 50
    }
  }

  beforeEach(() => {
    user = userEvent.setup()
    mockOnSelectionChange = jest.fn()

    // Reset all mocks
    jest.clearAllMocks()
    Object.keys(mockUseStockSelection).forEach(key => {
      if (typeof mockUseStockSelection[key as keyof typeof mockUseStockSelection] === 'function') {
        (mockUseStockSelection[key as keyof typeof mockUseStockSelection] as jest.Mock).mockClear()
      }
    })

    // Reset hook state
    mockUseStockSelection.isLoading = false
    mockUseStockSelection.error = null
    mockUseStockSelection.result = null
    mockUseStockSelection.isConnected = false
    mockUseStockSelection.executionTime = 0
    mockUseStockSelection.lastUpdate = 0

    // Mock console to reduce test noise
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render with default props', () => {
      render(<StockSelectionPanel />)

      expect(screen.getByText('Stock Selection Analysis')).toBeInTheDocument()
      expect(screen.getByText('Analyze individual stocks, sectors, or portfolios using advanced algorithms')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /single stock/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /multiple stocks/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sector analysis/i })).toBeInTheDocument()
    })

    it('should render with custom className', () => {
      const { container } = render(<StockSelectionPanel className="custom-panel" />)

      expect(container.firstChild).toHaveClass('stock-selection-panel', 'custom-panel')
    })

    it('should initialize with correct default mode', () => {
      render(<StockSelectionPanel defaultMode={SelectionMode.MULTIPLE_STOCKS} />)

      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      expect(multipleButton).toHaveClass('bg-blue-600')
    })

    it('should show advanced options when showAdvancedOptions is true', () => {
      render(<StockSelectionPanel showAdvancedOptions={true} />)

      expect(screen.getByTestId('algorithm-selector')).toBeInTheDocument()
    })
  })

  describe('Mode Switching', () => {
    it('should switch to single stock mode', async () => {
      render(<StockSelectionPanel defaultMode={SelectionMode.MULTIPLE_STOCKS} />)

      const singleButton = screen.getByRole('button', { name: /single stock/i })
      await user.click(singleButton)

      expect(singleButton).toHaveClass('bg-blue-600')
      expect(screen.getByPlaceholderText(/enter stock symbol \(e\.g\., aapl\)/i)).toBeInTheDocument()
    })

    it('should switch to multiple stocks mode', async () => {
      render(<StockSelectionPanel />)

      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      await user.click(multipleButton)

      expect(multipleButton).toHaveClass('bg-blue-600')
      expect(screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)).toBeInTheDocument()
    })

    it('should switch to sector analysis mode', async () => {
      render(<StockSelectionPanel />)

      const sectorButton = screen.getByRole('button', { name: /sector analysis/i })
      await user.click(sectorButton)

      expect(sectorButton).toHaveClass('bg-blue-600')
      expect(screen.getByTestId('sector-dropdown')).toBeInTheDocument()
    })

    it('should clear inputs when switching modes', async () => {
      render(<StockSelectionPanel />)

      // Enter single stock input
      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')

      // Switch to multiple stocks mode
      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      await user.click(multipleButton)

      // Input should be cleared
      const newInput = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      expect(newInput).toHaveValue('')
    })

    it('should focus input after mode change', async () => {
      render(<StockSelectionPanel />)

      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      await user.click(multipleButton)

      // Wait for focus timeout
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
        expect(input).toHaveFocus()
      }, { timeout: 200 })
    })
  })

  describe('Single Stock Mode', () => {
    beforeEach(() => {
      render(<StockSelectionPanel />)
    })

    it('should handle single stock input correctly', async () => {
      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'aapl123')

      // Should only keep alphabetic characters and convert to uppercase
      expect(input).toHaveValue('AAPL')
      expect(screen.getByText(/ready to analyze: AAPL/i)).toBeInTheDocument()
    })

    it('should limit input length', async () => {
      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'VERYLONGSYMBOL')

      // Should be limited by maxLength attribute
      expect(input.value.length).toBeLessThanOrEqual(10)
    })

    it('should analyze single stock on button click', async () => {
      mockUseStockSelection.analyzeStock.mockResolvedValue(mockSuccessResponse)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')

      const analyzeButton = screen.getByRole('button', { name: /analyze/i })
      await user.click(analyzeButton)

      expect(mockUseStockSelection.analyzeStock).toHaveBeenCalledWith('AAPL', expect.any(Object))
    })

    it('should analyze single stock on Enter key press', async () => {
      mockUseStockSelection.analyzeStock.mockResolvedValue(mockSuccessResponse)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')
      await user.keyboard('{Enter}')

      expect(mockUseStockSelection.analyzeStock).toHaveBeenCalledWith('AAPL', expect.any(Object))
    })

    it('should not analyze with empty input', async () => {
      const analyzeButton = screen.getByRole('button', { name: /analyze/i })
      expect(analyzeButton).toBeDisabled()
    })

    it('should call onSelectionChange callback on successful analysis', async () => {
      mockUseStockSelection.analyzeStock.mockResolvedValue(mockSuccessResponse)

      render(<StockSelectionPanel onSelectionChange={mockOnSelectionChange} />)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')

      const analyzeButton = screen.getByRole('button', { name: /analyze/i })
      await user.click(analyzeButton)

      await waitFor(() => {
        expect(mockOnSelectionChange).toHaveBeenCalledWith(mockSuccessResponse)
      })
    })
  })

  describe('Multiple Stocks Mode', () => {
    beforeEach(async () => {
      render(<StockSelectionPanel />)
      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      await user.click(multipleButton)
    })

    it('should parse comma-separated symbols', async () => {
      const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      await user.type(input, 'AAPL, GOOGL, MSFT')

      // Should show parsed symbols
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
      expect(screen.getByText('MSFT')).toBeInTheDocument()
    })

    it('should add stock on Enter key press', async () => {
      const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      await user.type(input, 'AAPL')
      await user.keyboard('{Enter}')

      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(input).toHaveValue('')
    })

    it('should remove stock when X button is clicked', async () => {
      const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      await user.type(input, 'AAPL, GOOGL')

      const removeButton = screen.getByLabelText(/remove AAPL/i)
      await user.click(removeButton)

      expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
    })

    it('should not add duplicate symbols', async () => {
      const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      await user.type(input, 'AAPL')
      await user.keyboard('{Enter}')

      // Try to add AAPL again
      await user.type(input, 'AAPL')
      await user.keyboard('{Enter}')

      // Should only have one AAPL
      const appleElements = screen.getAllByText('AAPL')
      expect(appleElements).toHaveLength(1)
    })

    it('should filter invalid symbols', async () => {
      const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      await user.type(input, 'AAPL, 123INVALID, GOOGL')

      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
      expect(screen.queryByText('123INVALID')).not.toBeInTheDocument()
    })

    it('should analyze multiple stocks', async () => {
      mockUseStockSelection.analyzeStocks.mockResolvedValue(mockSuccessResponse)

      const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      await user.type(input, 'AAPL, GOOGL, MSFT')

      const analyzeButton = screen.getByRole('button', { name: /analyze/i })
      await user.click(analyzeButton)

      expect(mockUseStockSelection.analyzeStocks).toHaveBeenCalledWith(['AAPL', 'GOOGL', 'MSFT'], expect.any(Object))
    })

    it('should show count of selected stocks', async () => {
      const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      await user.type(input, 'AAPL, GOOGL')

      expect(screen.getByText(/selected 2 stock\(s\)/i)).toBeInTheDocument()
    })
  })

  describe('Sector Analysis Mode', () => {
    beforeEach(async () => {
      render(<StockSelectionPanel />)
      const sectorButton = screen.getByRole('button', { name: /sector analysis/i })
      await user.click(sectorButton)
    })

    it('should handle sector selection', async () => {
      const sectorSelect = screen.getByTestId('sector-select')
      await user.selectOptions(sectorSelect, 'technology')

      expect(sectorSelect).toHaveValue('technology')
    })

    it('should analyze sector when selected', async () => {
      mockUseStockSelection.analyzeSector.mockResolvedValue(mockSuccessResponse)

      const sectorSelect = screen.getByTestId('sector-select')
      await user.selectOptions(sectorSelect, 'technology')

      const analyzeButton = screen.getByRole('button', { name: /analyze/i })
      await user.click(analyzeButton)

      expect(mockUseStockSelection.analyzeSector).toHaveBeenCalledWith(
        { value: 'technology', label: 'technology' },
        expect.any(Object)
      )
    })

    it('should not analyze without sector selection', async () => {
      const analyzeButton = screen.getByRole('button', { name: /analyze/i })
      expect(analyzeButton).toBeDisabled()
    })

    it('should disable sector dropdown when loading', () => {
      mockUseStockSelection.isLoading = true

      render(<StockSelectionPanel />)

      const sectorSelect = screen.getByTestId('sector-select')
      expect(sectorSelect).toBeDisabled()
    })
  })

  describe('Advanced Options', () => {
    beforeEach(() => {
      render(<StockSelectionPanel />)
    })

    it('should toggle advanced options', async () => {
      const advancedButton = screen.getByRole('button', { name: /advanced options/i })

      // Should be hidden initially
      expect(screen.queryByTestId('algorithm-selector')).not.toBeInTheDocument()

      await user.click(advancedButton)

      // Should be visible after click
      expect(screen.getByTestId('algorithm-selector')).toBeInTheDocument()

      await user.click(advancedButton)

      // Should be hidden again
      expect(screen.queryByTestId('algorithm-selector')).not.toBeInTheDocument()
    })

    it('should update algorithm options', async () => {
      const advancedButton = screen.getByRole('button', { name: /advanced options/i })
      await user.click(advancedButton)

      const algorithmSelect = screen.getByTestId('algorithm-select')
      await user.selectOptions(algorithmSelect, AlgorithmType.TECHNICAL)

      const riskInput = screen.getByTestId('risk-tolerance-input')
      await user.clear(riskInput)
      await user.type(riskInput, 'aggressive')

      const realTimeCheckbox = screen.getByTestId('real-time-checkbox')
      await user.click(realTimeCheckbox)

      // Verify options are updated in subsequent analysis calls
      mockUseStockSelection.analyzeStock.mockResolvedValue(mockSuccessResponse)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')

      const analyzeButton = screen.getByRole('button', { name: /analyze/i })
      await user.click(analyzeButton)

      expect(mockUseStockSelection.analyzeStock).toHaveBeenCalledWith('AAPL', expect.objectContaining({
        algorithmId: AlgorithmType.TECHNICAL,
        riskTolerance: 'aggressive',
        useRealTimeData: true
      }))
    })
  })

  describe('Loading States and Actions', () => {
    it('should show loading state during analysis', () => {
      mockUseStockSelection.isLoading = true

      render(<StockSelectionPanel />)

      const analyzeButton = screen.getByRole('button', { name: /analyzing/i })
      expect(analyzeButton).toBeDisabled()
      expect(screen.getByText('Analyzing...')).toBeInTheDocument()
    })

    it('should show cancel button during loading', () => {
      mockUseStockSelection.isLoading = true

      render(<StockSelectionPanel />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should call cancelAnalysis when cancel button is clicked', async () => {
      mockUseStockSelection.isLoading = true

      render(<StockSelectionPanel />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockUseStockSelection.cancelAnalysis).toHaveBeenCalled()
    })

    it('should show clear button when results exist', () => {
      mockUseStockSelection.result = mockSuccessResponse

      render(<StockSelectionPanel />)

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })

    it('should call clearResults when clear button is clicked', async () => {
      mockUseStockSelection.result = mockSuccessResponse

      render(<StockSelectionPanel />)

      const clearButton = screen.getByRole('button', { name: /clear/i })
      await user.click(clearButton)

      expect(mockUseStockSelection.clearResults).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should display error message', () => {
      mockUseStockSelection.error = 'Network connection failed'

      render(<StockSelectionPanel />)

      expect(screen.getByText(/error: network connection failed/i)).toBeInTheDocument()
    })

    it('should show retry button when error occurs', () => {
      mockUseStockSelection.error = 'Network connection failed'
      mockUseStockSelection.retryAnalysis = jest.fn()

      render(<StockSelectionPanel />)

      expect(screen.getByRole('button', { name: /retry analysis/i })).toBeInTheDocument()
    })

    it('should call retryAnalysis when retry button is clicked', async () => {
      mockUseStockSelection.error = 'Network connection failed'
      mockUseStockSelection.retryAnalysis = jest.fn()

      render(<StockSelectionPanel />)

      const retryButton = screen.getByRole('button', { name: /retry analysis/i })
      await user.click(retryButton)

      expect(mockUseStockSelection.retryAnalysis).toHaveBeenCalled()
    })

    it('should handle analysis errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockUseStockSelection.analyzeStock.mockRejectedValue(new Error('Analysis failed'))

      render(<StockSelectionPanel />)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')

      const analyzeButton = screen.getByRole('button', { name: /analyze/i })
      await user.click(analyzeButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Analysis failed:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Real-time Connection Status', () => {
    it('should show connection indicator when connected', () => {
      mockUseStockSelection.isConnected = true

      render(<StockSelectionPanel />)

      expect(screen.getByText(/real-time updates enabled/i)).toBeInTheDocument()
    })

    it('should not show connection indicator when disconnected', () => {
      mockUseStockSelection.isConnected = false

      render(<StockSelectionPanel />)

      expect(screen.queryByText(/real-time updates enabled/i)).not.toBeInTheDocument()
    })
  })

  describe('Results Integration', () => {
    it('should pass correct props to SelectionResults', () => {
      mockUseStockSelection.result = mockSuccessResponse
      mockUseStockSelection.isLoading = true
      mockUseStockSelection.error = 'Test error'
      mockUseStockSelection.executionTime = 1500
      mockUseStockSelection.lastUpdate = 1234567890

      render(<StockSelectionPanel />)

      const resultsComponent = screen.getByTestId('selection-results')
      expect(resultsComponent).toBeInTheDocument()

      // Check that child component receives correct data
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
      expect(screen.getByTestId('error-display')).toHaveTextContent('Test error')
      expect(screen.getByTestId('execution-time')).toHaveTextContent('1500ms')
      expect(screen.getByTestId('last-update')).toHaveTextContent('1234567890')
      expect(screen.getByTestId('result-data')).toHaveTextContent(JSON.stringify(mockSuccessResponse))
    })
  })

  describe('Keyboard Navigation and Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<StockSelectionPanel />)

      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      fireEvent.click(multipleButton)

      // Add a stock and check remove button has proper label
      const input = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      fireEvent.change(input, { target: { value: 'AAPL' } })
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' })

      const removeButton = screen.getByLabelText(/remove AAPL/i)
      expect(removeButton).toBeInTheDocument()
    })

    it('should handle Enter key correctly in different contexts', async () => {
      render(<StockSelectionPanel />)

      // Single stock mode - should analyze
      mockUseStockSelection.analyzeStock.mockResolvedValue(mockSuccessResponse)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')
      await user.keyboard('{Enter}')

      expect(mockUseStockSelection.analyzeStock).toHaveBeenCalled()

      // Switch to multiple stocks mode
      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      await user.click(multipleButton)

      // Multiple stocks mode with input - should add stock
      const multiInput = screen.getByPlaceholderText(/enter stock symbols.*comma-separated/i)
      await user.type(multiInput, 'GOOGL')
      await user.keyboard('{Enter}')

      expect(screen.getByText('GOOGL')).toBeInTheDocument()
    })

    it('should prevent default on Enter key press', async () => {
      render(<StockSelectionPanel />)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')

      const enterEvent = new KeyboardEvent('keypress', { key: 'Enter', bubbles: true })
      const preventDefaultSpy = jest.spyOn(enterEvent, 'preventDefault')

      fireEvent.keyPress(input, enterEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should not trigger actions when loading', async () => {
      mockUseStockSelection.isLoading = true

      render(<StockSelectionPanel />)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')
      await user.keyboard('{Enter}')

      // Should not call analysis while loading
      expect(mockUseStockSelection.analyzeStock).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Validation', () => {
    it('should handle empty analysis attempts gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<StockSelectionPanel />)

      // Force analysis with empty input by manipulating the component
      const analyzeButton = screen.getByRole('button', { name: /analyze/i })

      // Try to trigger analysis without proper input
      // This should be prevented by disabled state, but let's test error handling

      consoleSpy.mockRestore()
    })

    it('should handle rapid mode switching', async () => {
      render(<StockSelectionPanel />)

      const singleButton = screen.getByRole('button', { name: /single stock/i })
      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      const sectorButton = screen.getByRole('button', { name: /sector analysis/i })

      // Rapid clicking should not cause issues
      await user.click(multipleButton)
      await user.click(sectorButton)
      await user.click(singleButton)
      await user.click(multipleButton)

      // Should end up in multiple stocks mode
      expect(multipleButton).toHaveClass('bg-blue-600')
    })

    it('should handle long symbol names gracefully', async () => {
      render(<StockSelectionPanel />)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'VERYLONGSYMBOLNAME')

      // Should be limited by maxLength
      expect(input.value.length).toBeLessThanOrEqual(10)
    })

    it('should clean up special characters from input', async () => {
      render(<StockSelectionPanel />)

      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'A@A#P$L%')

      expect(input).toHaveValue('AAPL')
    })
  })

  describe('Component Integration', () => {
    it('should maintain state consistency across interactions', async () => {
      render(<StockSelectionPanel />)

      // Start with single stock
      const input = screen.getByPlaceholderText(/enter stock symbol/i)
      await user.type(input, 'AAPL')

      // Switch to advanced options
      const advancedButton = screen.getByRole('button', { name: /advanced options/i })
      await user.click(advancedButton)

      // Change algorithm
      const algorithmSelect = screen.getByTestId('algorithm-select')
      await user.selectOptions(algorithmSelect, AlgorithmType.TECHNICAL)

      // Switch to multiple stocks and back
      const multipleButton = screen.getByRole('button', { name: /multiple stocks/i })
      await user.click(multipleButton)

      const singleButton = screen.getByRole('button', { name: /single stock/i })
      await user.click(singleButton)

      // Algorithm options should persist
      expect(screen.getByTestId('algorithm-select')).toHaveValue(AlgorithmType.TECHNICAL)

      // But input should be cleared
      const newInput = screen.getByPlaceholderText(/enter stock symbol/i)
      expect(newInput).toHaveValue('')
    })

    it('should work with all prop combinations', () => {
      const allProps = {
        className: 'test-class',
        onSelectionChange: mockOnSelectionChange,
        defaultMode: SelectionMode.SECTOR_ANALYSIS,
        showAdvancedOptions: true
      }

      render(<StockSelectionPanel {...allProps} />)

      // Should render correctly with all props
      expect(screen.getByRole('button', { name: /sector analysis/i })).toHaveClass('bg-blue-600')
      expect(screen.getByTestId('algorithm-selector')).toBeInTheDocument()
    })
  })
})