/**
 * Simple formatting utilities for stock analysis components
 * Following KISS principles - straightforward number formatting
 */

/**
 * Format market cap to human-readable format
 * Examples: $1.43T, $500.2B, $50.5M
 * Handles both number and string inputs
 */
export const formatMarketCap = (marketCap: number | string): string => {
  // Convert string to number if needed
  const value = typeof marketCap === 'string' ? parseFloat(marketCap) : marketCap

  // Handle invalid values
  if (isNaN(value) || value === 0) {
    return 'N/A'
  }

  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`
  }
  return `$${value.toFixed(2)}`
}
