'use client'

import { useState, useRef, useEffect } from 'react'

export interface SectorOption {
  id: string
  label: string
  description: string
  category: 'sector' | 'index'
}

interface SectorDropdownProps {
  onSectorChange: (sector: SectorOption) => void
  loading?: boolean
  disabled?: boolean
  currentSector?: SectorOption
}

const MARKET_SECTORS: SectorOption[] = [
  // Major Industry Sectors
  { id: 'technology', label: 'Technology', description: 'Software, hardware, semiconductors', category: 'sector' },
  { id: 'healthcare', label: 'Healthcare', description: 'Pharmaceuticals, biotech, medical devices', category: 'sector' },
  { id: 'financials', label: 'Financial Services', description: 'Banks, insurance, investment firms', category: 'sector' },
  { id: 'consumer-discretionary', label: 'Consumer Discretionary', description: 'Retail, automotive, entertainment', category: 'sector' },
  { id: 'consumer-staples', label: 'Consumer Staples', description: 'Food, beverages, household products', category: 'sector' },
  { id: 'energy', label: 'Energy', description: 'Oil, gas, renewable energy', category: 'sector' },
  { id: 'industrials', label: 'Industrials', description: 'Manufacturing, aerospace, defense', category: 'sector' },
  { id: 'utilities', label: 'Utilities', description: 'Electric, gas, water utilities', category: 'sector' },
  { id: 'materials', label: 'Materials', description: 'Mining, chemicals, forestry', category: 'sector' },
  { id: 'real-estate', label: 'Real Estate', description: 'REITs, property development', category: 'sector' },
  { id: 'communication', label: 'Communication Services', description: 'Telecom, media, internet services', category: 'sector' },
  
  // Major Market Indices
  { id: 'sp500', label: 'S&P 500', description: 'Top 500 US companies by market cap', category: 'index' },
  { id: 'nasdaq100', label: 'NASDAQ 100', description: 'Top 100 non-financial NASDAQ stocks', category: 'index' },
  { id: 'dow30', label: 'Dow Jones 30', description: '30 major US industrial companies', category: 'index' },
  { id: 'russell2000', label: 'Russell 2000', description: 'Small-cap US stock index', category: 'index' },
]

export default function SectorDropdown({ onSectorChange, loading = false, disabled = false, currentSector }: SectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleSectorSelect = (sector: SectorOption) => {
    onSectorChange(sector)
    setIsOpen(false)
  }

  const sectorGroups = {
    sectors: MARKET_SECTORS.filter(s => s.category === 'sector'),
    indices: MARKET_SECTORS.filter(s => s.category === 'index')
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="sector-dropdown w-full min-h-[50px] relative" ref={dropdownRef}>
      {/* CSS Button Dropdown Trigger */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        aria-label="Select market sector or index"
        aria-expanded={isOpen}
        className={`
          w-full px-4 py-3 min-h-[50px] bg-gray-900 border-2 border-cyan-500 rounded-lg 
          text-white font-medium text-sm text-left
          hover:bg-gray-800 hover:border-cyan-400 
          focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50
          transition-all duration-300 flex items-center justify-between
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span>
          {loading ? 'Loading sectors...' : (currentSector ? currentSector.label : 'Select Market Sector')}
        </span>
        <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && !loading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-900 border-2 border-cyan-500 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {/* Industry Sectors Group */}
          <div className="p-2 border-b border-gray-700">
            <div className="text-xs font-semibold text-cyan-400 px-2 py-1">🏢 Industry Sectors</div>
            {sectorGroups.sectors.map((sector) => (
              <button
                key={sector.id}
                onClick={() => handleSectorSelect(sector)}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-800 hover:text-cyan-400 rounded transition-colors duration-150"
              >
                {sector.label}
              </button>
            ))}
          </div>
          
          {/* Market Indices Group */}
          <div className="p-2">
            <div className="text-xs font-semibold text-cyan-400 px-2 py-1">📊 Market Indices</div>
            {sectorGroups.indices.map((index) => (
              <button
                key={index.id}
                onClick={() => handleSectorSelect(index)}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-800 hover:text-cyan-400 rounded transition-colors duration-150"
              >
                {index.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description Display */}
      {currentSector && !loading && (
        <div className="relative -mt-1 -ml-1">
          <div className="text-xs text-gray-400 flex items-center gap-2 pl-1">
            <span className="text-sm">
              {currentSector.category === 'index' ? '📊' : '🏢'}
            </span>
            <span className="ml-1">&nbsp;{currentSector.description}</span>
          </div>
        </div>
      )}
    </div>
  )
}