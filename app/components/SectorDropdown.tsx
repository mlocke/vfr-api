'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './SectorDropdown.module.css'

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
    <div className={`${styles.container} ${isOpen ? styles.active : ''} sector-dropdown`} ref={dropdownRef}>
      {/* Modern Glass-morphism Button */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        aria-label="Select market sector or index"
        aria-expanded={isOpen}
        className={`${styles.triggerButton} ${disabled || loading ? styles.loading : ''} ${loading ? styles.loadingPulse : ''}`}
      >
        <span>
          {loading ? 'Loading sectors...' : (currentSector ? currentSector.label : 'Select Market Sector')}
        </span>
        <span className={`${styles.arrow} ${isOpen ? styles.open : ''}`}>
          ▼
        </span>
      </button>

      {/* Modern Glass Dropdown Menu */}
      {isOpen && !disabled && !loading && (
        <div className={styles.dropdownMenu}>
          {/* Industry Sectors Group */}
          <div className={styles.groupSection}>
            <div className={styles.groupHeader}>🏢 Industry Sectors</div>
            {sectorGroups.sectors.map((sector) => (
              <button
                key={sector.id}
                onClick={() => handleSectorSelect(sector)}
                className={styles.optionButton}
              >
                {sector.label}
              </button>
            ))}
          </div>
          
          {/* Market Indices Group */}
          <div className={styles.groupSection}>
            <div className={styles.groupHeader}>📊 Market Indices</div>
            {sectorGroups.indices.map((index) => (
              <button
                key={index.id}
                onClick={() => handleSectorSelect(index)}
                className={styles.optionButton}
              >
                {index.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description Display */}
      {currentSector && !loading && (
        <div className={styles.description}>
          <div className={styles.descriptionContent}>
            <span className={styles.categoryIcon}>
              {currentSector.category === 'index' ? '📊' : '🏢'}
            </span>
            <span className={styles.descriptionText}>{currentSector.description}</span>
          </div>
        </div>
      )}
    </div>
  )
}