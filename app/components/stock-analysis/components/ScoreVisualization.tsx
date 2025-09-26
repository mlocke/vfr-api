'use client'

import React from 'react'

interface ScoreVisualizationProps {
  scores: {
    overall: number
    technical: number
    fundamental: number
    sentiment: number
    macro?: number
    alternative?: number
  }
  symbol: string
}

interface ScoreCategory {
  label: string
  value: number
  color: string
  description: string
}

const CircularProgress: React.FC<{
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
}> = ({ percentage, size = 160, strokeWidth = 8, color = 'rgba(0, 200, 83, 0.8)' }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.6s ease-out'
          }}
        />
      </svg>
      {/* Score text */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'white',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}
        >
          {Math.round(percentage)}
        </div>
        <div
          style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)'
          }}
        >
          /100
        </div>
      </div>
    </div>
  )
}

const HorizontalBar: React.FC<{
  category: ScoreCategory
  index: number
}> = ({ category, index }) => {
  const percentage = Math.round(category.value * 100)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '0.75rem',
        opacity: 0,
        animation: `fadeInUp 0.6s ease-out ${0.1 + index * 0.1}s forwards`
      }}
    >
      {/* Label */}
      <div
        style={{
          width: '80px',
          fontSize: '0.875rem',
          color: 'rgba(255, 255, 255, 0.8)',
          fontWeight: '500'
        }}
        title={category.description}
      >
        {category.label}
      </div>

      {/* Progress bar container */}
      <div
        style={{
          flex: 1,
          height: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            background: category.color,
            borderRadius: '4px',
            transition: `width 0.8s ease-out ${0.2 + index * 0.1}s`,
            boxShadow: `0 0 8px ${category.color}40`
          }}
        />
      </div>

      {/* Percentage */}
      <div
        style={{
          width: '40px',
          textAlign: 'right',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: 'rgba(255, 255, 255, 0.9)'
        }}
      >
        {percentage}%
      </div>
    </div>
  )
}

const ScoreVisualization: React.FC<ScoreVisualizationProps> = ({ scores, symbol }) => {
  const overallScore = Math.round((scores.overall || 0) * 100)

  // Define score categories with colors and descriptions
  const scoreCategories: ScoreCategory[] = [
    {
      label: 'Technical',
      value: scores.technical || 0,
      color: 'rgba(0, 200, 83, 0.8)',
      description: 'Price patterns, momentum, and trading signals'
    },
    {
      label: 'Fundamental',
      value: scores.fundamental || 0,
      color: 'rgba(59, 130, 246, 0.8)',
      description: 'Financial health, valuation, and business metrics'
    },
    {
      label: 'Macro',
      value: scores.macro || 0.65, // Fallback value if not available
      color: 'rgba(168, 85, 247, 0.8)',
      description: 'Economic environment and market conditions'
    },
    {
      label: 'Sentiment',
      value: scores.sentiment || 0,
      color: 'rgba(245, 158, 11, 0.8)',
      description: 'News sentiment and market psychology'
    },
    {
      label: 'Alternative',
      value: scores.alternative || 0.55, // Fallback value if not available
      color: 'rgba(239, 68, 68, 0.8)',
      description: 'ESG factors and alternative data signals'
    }
  ]

  // Determine overall score color
  const getOverallScoreColor = (score: number): string => {
    if (score >= 80) return 'rgba(0, 200, 83, 0.8)' // Green
    if (score >= 60) return 'rgba(245, 158, 11, 0.8)' // Yellow
    return 'rgba(239, 68, 68, 0.8)' // Red
  }

  return (
    <>
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .score-container {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 2rem;
          margin-bottom: 2rem;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .score-grid {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 2rem;
          align-items: center;
        }

        .circular-score-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .breakdown-container {
          flex: 1;
        }

        .breakdown-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: white;
          margin-bottom: 1rem;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .score-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
            text-align: center;
          }

          .circular-score-container {
            margin-bottom: 1rem;
          }

          .score-container {
            padding: 1.5rem;
          }
        }

        @media (max-width: 480px) {
          .score-container {
            padding: 1rem;
          }

          .breakdown-title {
            font-size: 1.1rem;
          }

          .score-grid {
            gap: 1rem;
          }
        }
      `}</style>

      <section
        className="score-container"
        aria-labelledby="scores-heading"
      >
        <div className="score-grid">
          {/* Overall Score Circle */}
          <div className="circular-score-container">
            <CircularProgress
              percentage={overallScore}
              color={getOverallScoreColor(overallScore)}
              size={160}
              strokeWidth={8}
            />
          </div>

          {/* Score Breakdown */}
          <div className="breakdown-container">
            <h3
              className="breakdown-title"
              id="scores-heading"
            >
              Score Breakdown
            </h3>

            <div role="list" aria-label="Score categories">
              {scoreCategories.map((category, index) => (
                <div key={category.label} role="listitem">
                  <HorizontalBar
                    category={category}
                    index={index}
                  />
                </div>
              ))}
            </div>

            {/* Score Legend */}
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <h4
                style={{
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '0.5rem'
                }}
              >
                Score Interpretation
              </h4>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  lineHeight: '1.4'
                }}
              >
                <div style={{ marginBottom: '0.25rem' }}>
                  <span style={{ color: 'rgba(0, 200, 83, 0.8)' }}>80+</span> Excellent
                  <span style={{ margin: '0 0.5rem', color: 'rgba(245, 158, 11, 0.8)' }}>60-79</span> Good
                  <span style={{ margin: '0 0.5rem', color: 'rgba(239, 68, 68, 0.8)' }}>&lt;60</span> Needs Attention
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Assessment */}
        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <h4
            style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: 'white',
              marginBottom: '0.5rem'
            }}
          >
            Overall Assessment for {symbol}
          </h4>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: '1.5',
              maxWidth: '600px',
              margin: '0 auto'
            }}
          >
            {overallScore >= 80
              ? `${symbol} shows excellent performance across multiple analysis factors with strong buy signals.`
              : overallScore >= 60
              ? `${symbol} demonstrates solid fundamentals with good investment potential and balanced risk profile.`
              : `${symbol} shows mixed signals and may require careful consideration before investment decisions.`
            }
          </p>
        </div>
      </section>
    </>
  )
}

export { ScoreVisualization }
export default ScoreVisualization