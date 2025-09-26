/**
 * AnalysisLoadingOverlay - Enhanced loading state for financial analysis
 * Provides comprehensive user feedback during multi-source data analysis
 */

'use client'

import React, { useState, useEffect } from 'react'

/**
 * Analysis stage configurations with timing estimates
 */
const ANALYSIS_STAGES = {
  initializing: {
    icon: '🚀',
    title: 'Initializing Analysis',
    description: 'Preparing data source connections...',
    color: 'rgba(59, 130, 246, 0.8)',
    duration: 2000,
    progress: 5
  },
  fetching: {
    icon: '🔍',
    title: 'Fetching Market Data',
    description: 'Connecting to 15+ financial data sources...',
    color: 'rgba(168, 85, 247, 0.8)',
    duration: 8000,
    progress: 35
  },
  analyzing: {
    icon: '🧠',
    title: 'Processing Analysis',
    description: 'Running AI algorithms on market data...',
    color: 'rgba(0, 200, 83, 0.8)',
    duration: 6000,
    progress: 75
  },
  finalizing: {
    icon: '⚡',
    title: 'Generating Insights',
    description: 'Creating recommendations and insights...',
    color: 'rgba(255, 193, 7, 0.8)',
    duration: 3000,
    progress: 95
  }
}

/**
 * Data source status indicators
 */
const DATA_SOURCES = [
  { name: 'Market Data', status: 'connecting' },
  { name: 'SEC Filings', status: 'pending' },
  { name: 'Sentiment Analysis', status: 'pending' },
  { name: 'Economic Data', status: 'pending' },
  { name: 'Technical Indicators', status: 'pending' }
]

interface AnalysisLoadingOverlayProps {
  analysisType: 'sector' | 'tickers' | null
  selectedSector?: { label: string }
  selectedSymbols?: string[]
  onCancel: () => void
}

/**
 * Animated progress bar with cyberpunk styling
 */
const CyberpunkProgressBar: React.FC<{ progress: number; stage: string }> = ({ progress, stage }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid rgba(0, 200, 83, 0.3)'
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          background: `linear-gradient(90deg,
            rgba(0, 200, 83, 0.8),
            rgba(59, 130, 246, 0.8),
            rgba(168, 85, 247, 0.8)
          )`,
          borderRadius: '3px',
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          boxShadow: '0 0 10px rgba(0, 200, 83, 0.5)'
        }}
      >
        {/* Animated shimmer effect */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
            animation: 'shimmer 2s infinite'
          }}
        />
      </div>

      {/* Glowing pulse effect */}
      <div
        style={{
          position: 'absolute',
          top: '-2px',
          left: `${progress - 2}%`,
          width: '4px',
          height: '12px',
          backgroundColor: 'rgba(0, 200, 83, 0.9)',
          borderRadius: '2px',
          boxShadow: '0 0 8px rgba(0, 200, 83, 0.8)',
          animation: 'pulse 1.5s infinite'
        }}
      />
    </div>
  )
}

/**
 * Data source status indicator
 */
const DataSourceIndicator: React.FC<{ source: { name: string; status: string } }> = ({ source }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'rgba(0, 200, 83, 0.8)'
      case 'connecting': return 'rgba(255, 193, 7, 0.8)'
      case 'pending': return 'rgba(100, 100, 100, 0.5)'
      case 'error': return 'rgba(239, 68, 68, 0.8)'
      default: return 'rgba(100, 100, 100, 0.5)'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅'
      case 'connecting': return '🔄'
      case 'pending': return '⏳'
      case 'error': return '❌'
      default: return '⏳'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '0.85rem',
        transition: 'all 0.3s ease'
      }}
    >
      <span style={{ animation: source.status === 'connecting' ? 'spin 2s linear infinite' : 'none' }}>
        {getStatusIcon(source.status)}
      </span>
      <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
        {source.name}
      </span>
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(source.status),
          marginLeft: 'auto',
          animation: source.status === 'connecting' ? 'pulse 2s infinite' : 'none'
        }}
      />
    </div>
  )
}

/**
 * Main loading overlay component
 */
export const AnalysisLoadingOverlay: React.FC<AnalysisLoadingOverlayProps> = ({
  analysisType,
  selectedSector,
  selectedSymbols,
  onCancel
}) => {
  const [currentStage, setCurrentStage] = useState<keyof typeof ANALYSIS_STAGES>('initializing')
  const [progress, setProgress] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [dataSources, setDataSources] = useState(DATA_SOURCES)

  // Simulate stage progression
  useEffect(() => {
    const stages = Object.keys(ANALYSIS_STAGES) as (keyof typeof ANALYSIS_STAGES)[]
    let currentIndex = 0
    let progressTimer: NodeJS.Timeout
    let stageTimer: NodeJS.Timeout

    const progressStage = () => {
      const stage = stages[currentIndex]
      const stageConfig = ANALYSIS_STAGES[stage]

      setCurrentStage(stage)

      // Animate progress within stage
      let currentProgress = currentIndex > 0 ? ANALYSIS_STAGES[stages[currentIndex - 1]].progress : 0
      const targetProgress = stageConfig.progress
      const progressStep = (targetProgress - currentProgress) / (stageConfig.duration / 100)

      progressTimer = setInterval(() => {
        currentProgress += progressStep
        if (currentProgress >= targetProgress) {
          currentProgress = targetProgress
          clearInterval(progressTimer)
        }
        setProgress(currentProgress)
      }, 100)

      // Update data sources status
      setTimeout(() => {
        setDataSources(prev => prev.map((source, index) => ({
          ...source,
          status: index <= currentIndex ? 'connected' : index === currentIndex + 1 ? 'connecting' : 'pending'
        })))
      }, stageConfig.duration / 3)

      // Move to next stage
      if (currentIndex < stages.length - 1) {
        stageTimer = setTimeout(() => {
          currentIndex++
          progressStage()
        }, stageConfig.duration)
      }
    }

    progressStage()

    return () => {
      clearInterval(progressTimer)
      clearTimeout(stageTimer)
    }
  }, [])

  // Track elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const stageConfig = ANALYSIS_STAGES[currentStage]

  const getAnalysisTarget = () => {
    if (analysisType === 'sector' && selectedSector) {
      return selectedSector.label
    }
    if (analysisType === 'tickers' && selectedSymbols && selectedSymbols.length > 0) {
      return selectedSymbols.join(', ')
    }
    return 'Market Data'
  }

  return (
    <>
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 200, 83, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 200, 83, 0.6); }
        }

        .loading-overlay {
          animation: fadeIn 0.4s ease-out;
        }

        .stage-icon {
          animation: float 3s ease-in-out infinite;
        }

        .main-container {
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Full Screen Overlay */}
      <div
        className="loading-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '2rem'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loading-title"
        aria-describedby="loading-description"
      >
        {/* Main Loading Container */}
        <div
          className="main-container"
          style={{
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(31, 41, 55, 0.95))',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '2px solid rgba(0, 200, 83, 0.3)',
            borderRadius: '20px',
            padding: '3rem',
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            position: 'relative'
          }}
        >
          {/* Stage Icon */}
          <div
            className="stage-icon"
            style={{
              fontSize: '4rem',
              marginBottom: '1.5rem',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))'
            }}
          >
            {stageConfig.icon}
          </div>

          {/* Stage Title */}
          <h2
            id="loading-title"
            style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'white',
              marginBottom: '0.5rem',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}
          >
            {stageConfig.title}
          </h2>

          {/* Analysis Target */}
          <p
            style={{
              fontSize: '1.2rem',
              color: stageConfig.color,
              marginBottom: '1rem',
              fontWeight: '600'
            }}
          >
            {getAnalysisTarget()}
          </p>

          {/* Stage Description */}
          <p
            id="loading-description"
            style={{
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '2rem',
              lineHeight: '1.5'
            }}
          >
            {stageConfig.description}
          </p>

          {/* Progress Bar */}
          <div style={{ marginBottom: '1rem' }}>
            <CyberpunkProgressBar progress={progress} stage={currentStage} />
          </div>

          {/* Progress Text */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.6)'
            }}
          >
            <span>{Math.round(progress)}% Complete</span>
            <span>{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} elapsed</span>
          </div>

          {/* Data Sources Status */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem'
            }}
          >
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              📡 Data Sources
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '0.75rem'
              }}
            >
              {dataSources.map((source, index) => (
                <DataSourceIndicator key={index} source={source} />
              ))}
            </div>
          </div>

          {/* Analysis Tips */}
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem',
              textAlign: 'left'
            }}
          >
            <div
              style={{
                fontWeight: '600',
                color: 'rgba(59, 130, 246, 0.9)',
                marginBottom: '0.5rem',
                fontSize: '1rem'
              }}
            >
              💡 What's happening?
            </div>
            <div
              style={{
                fontSize: '0.9rem',
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: '1.4'
              }}
            >
              {currentStage === 'initializing' && 'Setting up connections to premium financial data sources and validating access tokens...'}
              {currentStage === 'fetching' && 'Gathering real-time data from SEC filings, market APIs, sentiment sources, and economic indicators...'}
              {currentStage === 'analyzing' && 'Running advanced algorithms to analyze technical patterns, fundamental metrics, and market sentiment...'}
              {currentStage === 'finalizing' && 'Generating personalized insights and investment recommendations with confidence scoring...'}
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}
          >
            <button
              onClick={onCancel}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                color: 'rgba(239, 68, 68, 0.9)',
                fontSize: '1rem',
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
              aria-label="Cancel analysis"
            >
              Cancel Analysis
            </button>
          </div>

          {/* Estimated Time */}
          <div
            style={{
              marginTop: '1.5rem',
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.5)',
              fontStyle: 'italic'
            }}
          >
            Estimated completion: {Math.max(0, 20 - elapsedTime)}s remaining
          </div>
        </div>
      </div>
    </>
  )
}

export default AnalysisLoadingOverlay