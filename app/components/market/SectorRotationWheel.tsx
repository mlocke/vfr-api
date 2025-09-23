'use client'

import { useState, useEffect, useRef } from 'react'

interface SectorData {
  symbol: string
  name: string
  performance: number
  volume: number
  marketCap: number
  momentum: 'strong-up' | 'up' | 'neutral' | 'down' | 'strong-down'
}

interface SectorRotationWheelProps {
  className?: string
}

export default function SectorRotationWheel({ className = '' }: SectorRotationWheelProps) {
  const [sectorData, setSectorData] = useState<SectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSector, setSelectedSector] = useState<SectorData | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    fetchSectorData()
    const interval = setInterval(fetchSectorData, 120000) // Update every 2 minutes

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (sectorData.length > 0 && canvasRef.current) {
      drawRotationWheel()
    }
  }, [sectorData, selectedSector])

  const fetchSectorData = async () => {
    console.log('🔄 SectorRotationWheel: Starting to fetch sector data...')
    try {
      const response = await fetch('/api/market/sectors')
      console.log('📡 SectorRotationWheel: Response status:', response.status)

      const data = await response.json()
      console.log('📊 SectorRotationWheel: Received data:', data)

      const sectors = data.sectors || []
      console.log('🎯 SectorRotationWheel: Sectors count:', sectors.length)

      setSectorData(sectors)

      if (sectors.length === 0) {
        console.warn('⚠️ SectorRotationWheel: No sectors received, setting error state')
        setError('Sector data temporarily unavailable')
      } else {
        console.log('✅ SectorRotationWheel: Successfully loaded', sectors.length, 'sectors')
        setError(null)
      }
    } catch (err) {
      console.error('❌ SectorRotationWheel: Error fetching sector data:', err)
      setSectorData([])
      setError('Unable to connect to server')
    } finally {
      console.log('🏁 SectorRotationWheel: Finished loading, setting loading to false')
      setLoading(false)
    }
  }


  const drawRotationWheel = () => {
    console.log('🎨 SectorRotationWheel: Starting to draw wheel with', sectorData.length, 'sectors')
    const canvas = canvasRef.current
    if (!canvas) {
      console.warn('⚠️ SectorRotationWheel: Canvas ref is null, cannot draw')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.warn('⚠️ SectorRotationWheel: Cannot get 2D context from canvas')
      return
    }

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 40

    console.log('🎨 SectorRotationWheel: Canvas dimensions:', canvas.width, 'x', canvas.height, 'radius:', radius)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw sectors
    const angleStep = (2 * Math.PI) / sectorData.length

    sectorData.forEach((sector, index) => {
      const startAngle = index * angleStep - Math.PI / 2
      const endAngle = (index + 1) * angleStep - Math.PI / 2

      // Calculate sector radius based on performance
      const performanceRadius = radius * (0.6 + Math.max(0, sector.performance) * 0.01)

      // Get color based on performance
      const sectorColor = getSectorColor(sector.performance)
      const isSelected = selectedSector?.symbol === sector.symbol

      // Draw sector
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, performanceRadius, startAngle, endAngle)
      ctx.closePath()

      // Fill sector
      ctx.fillStyle = isSelected ? sectorColor : sectorColor + '80'
      ctx.fill()

      // Draw border
      ctx.strokeStyle = isSelected ? '#ffffff' : sectorColor
      ctx.lineWidth = isSelected ? 3 : 1
      ctx.stroke()

      // Add glow effect for positive performance
      if (sector.performance > 0) {
        ctx.shadowBlur = 15
        ctx.shadowColor = sectorColor
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Draw sector label
      const labelAngle = startAngle + angleStep / 2
      const labelRadius = performanceRadius + 20
      const labelX = centerX + Math.cos(labelAngle) * labelRadius
      const labelY = centerY + Math.sin(labelAngle) * labelRadius

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px Inter'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(sector.symbol, labelX, labelY)

      // Draw performance text
      const perfText = `${sector.performance > 0 ? '+' : ''}${sector.performance.toFixed(1)}%`
      ctx.font = '9px Inter'
      ctx.fillStyle = sectorColor
      ctx.fillText(perfText, labelX, labelY + 12)
    })

    // Draw center circle
    ctx.beginPath()
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI)
    ctx.fillStyle = 'rgba(17, 24, 39, 0.9)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw center text
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px Inter'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SECTORS', centerX, centerY)
  }

  const getSectorColor = (performance: number): string => {
    if (performance >= 2) return '#10b981' // Emerald
    if (performance >= 1) return '#22c55e' // Green
    if (performance >= 0) return '#84cc16' // Lime
    if (performance >= -1) return '#f59e0b' // Amber
    return '#ef4444' // Red
  }

  const getMomentumIcon = (momentum: string): string => {
    switch (momentum) {
      case 'strong-up': return '🚀'
      case 'up': return '📈'
      case 'neutral': return '➡️'
      case 'down': return '📉'
      case 'strong-down': return '💥'
      default: return '➡️'
    }
  }

  const handleSectorClick = (sector: SectorData) => {
    setSelectedSector(selectedSector?.symbol === sector.symbol ? null : sector)
  }

  const formatMarketCap = (value: number): string => {
    return `$${(value / 1000000000).toFixed(1)}B`
  }

  const formatVolume = (value: number): string => {
    return `${(value / 1000000).toFixed(1)}M`
  }

  if (loading) {
    return (
      <div className={`sector-rotation-wheel ${className}`}>
        <div className="wheel-header">
          <h3 className="wheel-title">Sector Rotation</h3>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading Sector Data...</div>
        </div>

        <style jsx>{`
          .sector-rotation-wheel {
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(15px);
            border-radius: 16px;
            border: 1px solid rgba(99, 102, 241, 0.3);
            padding: 1.5rem;
            color: rgba(255, 255, 255, 0.9);
            min-height: 500px;
          }

          .wheel-header {
            margin-bottom: 1.5rem;
            text-align: center;
          }

          .wheel-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
          }

          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 300px;
            gap: 1rem;
          }

          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(99, 102, 241, 0.3);
            border-top: 3px solid rgba(99, 102, 241, 0.8);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          .loading-text {
            color: rgba(99, 102, 241, 0.9);
            font-size: 14px;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Add error state handling
  if (error) {
    return (
      <div className={`sector-rotation-wheel ${className}`}>
        <div className="wheel-header">
          <h3 className="wheel-title">Sector Rotation</h3>
        </div>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{error}</div>
          <button
            className="retry-button"
            onClick={() => {
              setError(null)
              setLoading(true)
              fetchSectorData()
            }}
          >
            Retry
          </button>
        </div>

        <style jsx>{`
          .sector-rotation-wheel {
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(15px);
            border-radius: 16px;
            border: 1px solid rgba(99, 102, 241, 0.3);
            padding: 1.5rem;
            color: rgba(255, 255, 255, 0.9);
            min-height: 500px;
          }

          .wheel-header {
            margin-bottom: 1.5rem;
            text-align: center;
          }

          .wheel-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
          }

          .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 300px;
            gap: 1rem;
          }

          .error-icon {
            font-size: 2rem;
          }

          .error-text {
            color: rgba(239, 68, 68, 0.9);
            font-size: 14px;
            text-align: center;
          }

          .retry-button {
            background: rgba(99, 102, 241, 0.8);
            border: none;
            border-radius: 8px;
            color: white;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
          }

          .retry-button:hover {
            background: rgba(99, 102, 241, 1);
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`sector-rotation-wheel ${className}`}>
      <div className="wheel-header">
        <h3 className="wheel-title">Sector Rotation</h3>
        <div className="wheel-subtitle">Real-time sector performance analysis</div>
      </div>

      <div className="wheel-container">
        <canvas
          ref={canvasRef}
          width={350}
          height={350}
          className="rotation-canvas"
          onClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect()
            if (!rect) return

            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const centerX = rect.width / 2
            const centerY = rect.height / 2

            const angle = Math.atan2(y - centerY, x - centerX) + Math.PI / 2
            const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle
            const sectorIndex = Math.floor(normalizedAngle / (2 * Math.PI / sectorData.length))

            if (sectorIndex >= 0 && sectorIndex < sectorData.length) {
              handleSectorClick(sectorData[sectorIndex])
            }
          }}
        />

        {selectedSector && (
          <div className="sector-details">
            <div className="details-header">
              <span className="sector-icon">{getMomentumIcon(selectedSector.momentum)}</span>
              <div className="sector-info">
                <h4 className="sector-name">{selectedSector.name}</h4>
                <div className="sector-symbol">{selectedSector.symbol}</div>
              </div>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Performance</span>
                <span
                  className={`detail-value ${selectedSector.performance >= 0 ? 'positive' : 'negative'}`}
                >
                  {selectedSector.performance > 0 ? '+' : ''}{selectedSector.performance.toFixed(2)}%
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Volume</span>
                <span className="detail-value">{formatVolume(selectedSector.volume)}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Market Cap</span>
                <span className="detail-value">{formatMarketCap(selectedSector.marketCap)}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Momentum</span>
                <span className="detail-value">{selectedSector.momentum.replace('-', ' ').toUpperCase()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sector-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
          <span>Strong (+2%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#22c55e' }}></div>
          <span>Up (+1%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#84cc16' }}></div>
          <span>Positive (0%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
          <span>Down (-1%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
          <span>Weak (-2%)</span>
        </div>
      </div>

      <style jsx>{`
        .sector-rotation-wheel {
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(15px);
          border-radius: 16px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 1.5rem;
          color: rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .wheel-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .wheel-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
          margin-bottom: 0.25rem;
        }

        .wheel-subtitle {
          font-size: 0.8rem;
          color: rgba(156, 163, 175, 0.8);
        }

        .wheel-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .rotation-canvas {
          cursor: pointer;
          transition: transform 0.2s;
        }

        .rotation-canvas:hover {
          transform: scale(1.02);
        }

        .sector-details {
          background: rgba(31, 41, 55, 0.8);
          border-radius: 12px;
          padding: 1rem;
          border: 1px solid rgba(99, 102, 241, 0.3);
          min-width: 280px;
          animation: fadeIn 0.3s ease;
        }

        .details-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(99, 102, 241, 0.2);
        }

        .sector-icon {
          font-size: 1.5rem;
        }

        .sector-info {
          flex: 1;
        }

        .sector-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          margin-bottom: 0.25rem;
        }

        .sector-symbol {
          font-size: 0.8rem;
          color: rgba(156, 163, 175, 0.8);
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .detail-label {
          font-size: 0.75rem;
          color: rgba(156, 163, 175, 0.7);
        }

        .detail-value {
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .detail-value.positive {
          color: rgba(34, 197, 94, 0.9);
        }

        .detail-value.negative {
          color: rgba(239, 68, 68, 0.9);
        }

        .sector-legend {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(99, 102, 241, 0.2);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: rgba(156, 163, 175, 0.8);
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .rotation-canvas {
            width: 280px;
            height: 280px;
          }

          .sector-legend {
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}