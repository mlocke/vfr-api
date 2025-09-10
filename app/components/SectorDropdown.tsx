'use client'

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
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    const selectedSector = MARKET_SECTORS.find(sector => sector.id === selectedId)
    if (selectedSector) {
      onSectorChange(selectedSector)
    }
  }

  const sectorGroups = {
    sectors: MARKET_SECTORS.filter(s => s.category === 'sector'),
    indices: MARKET_SECTORS.filter(s => s.category === 'index')
  }

  return (
    <div className="sector-dropdown w-full min-h-[50px]">
      {/* Standard HTML Select */}
      <select
        value={currentSector?.id || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        aria-label="Select market sector or index"
        className={`
          w-full px-4 py-3 min-h-[50px] bg-gray-900 border-2 border-cyan-500 rounded-lg 
          text-white font-medium text-sm appearance-none
          hover:bg-gray-800 hover:border-cyan-400 
          focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50
          transition-all duration-300
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <option value="" disabled className="text-gray-400">
          {loading ? 'Loading sectors...' : 'Select Market Sector'}
        </option>
        
        {/* Industry Sectors Group */}
        <optgroup label="🏢 Industry Sectors" className="font-semibold">
          {sectorGroups.sectors.map((sector) => (
            <option 
              key={sector.id} 
              value={sector.id}
              className="bg-gray-800 text-white py-1"
            >
              {sector.label}
            </option>
          ))}
        </optgroup>
        
        {/* Market Indices Group */}
        <optgroup label="📊 Market Indices" className="font-semibold">
          {sectorGroups.indices.map((index) => (
            <option 
              key={index.id} 
              value={index.id}
              className="bg-gray-800 text-white py-1"
            >
              {index.label}
            </option>
          ))}
        </optgroup>
      </select>

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