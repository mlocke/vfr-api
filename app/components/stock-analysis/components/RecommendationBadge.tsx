/**
 * RecommendationBadge - Display BUY/SELL/HOLD recommendation with confidence
 * Cyberpunk-themed component with gradient backgrounds and animations
 */

'use client'

import React from 'react'
import { RecommendationBadgeProps } from '../types'

/**
 * Get action-specific styling
 * PHASE 1 CALIBRATION: 7-tier recommendation system
 */
function getActionStyles(action: 'STRONG_BUY' | 'BUY' | 'MODERATE_BUY' | 'HOLD' | 'MODERATE_SELL' | 'SELL' | 'STRONG_SELL', size: 'small' | 'medium' | 'large') {
  const baseStyles = {
    STRONG_BUY: {
      background: 'linear-gradient(135deg, rgba(0, 230, 64, 1), rgba(0, 180, 50, 1))',
      border: '2px solid rgba(0, 255, 85, 0.8)',
      color: 'white',
      shadow: '0 6px 20px rgba(0, 230, 64, 0.5)'
    },
    BUY: {
      background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
      border: '1px solid rgba(0, 200, 83, 0.5)',
      color: 'white',
      shadow: '0 4px 15px rgba(0, 200, 83, 0.3)'
    },
    MODERATE_BUY: {
      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))',
      border: '1px solid rgba(34, 197, 94, 0.4)',
      color: 'white',
      shadow: '0 4px 12px rgba(34, 197, 94, 0.25)'
    },
    HOLD: {
      background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.9), rgba(200, 150, 0, 0.9))',
      border: '1px solid rgba(255, 193, 7, 0.5)',
      color: 'white',
      shadow: '0 4px 15px rgba(255, 193, 7, 0.3)'
    },
    MODERATE_SELL: {
      background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.8), rgba(234, 88, 12, 0.8))',
      border: '1px solid rgba(251, 146, 60, 0.4)',
      color: 'white',
      shadow: '0 4px 12px rgba(251, 146, 60, 0.25)'
    },
    SELL: {
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(200, 40, 40, 0.9))',
      border: '1px solid rgba(239, 68, 68, 0.5)',
      color: 'white',
      shadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
    },
    STRONG_SELL: {
      background: 'linear-gradient(135deg, rgba(255, 0, 0, 1), rgba(180, 0, 0, 1))',
      border: '2px solid rgba(255, 50, 50, 0.8)',
      color: 'white',
      shadow: '0 6px 20px rgba(255, 0, 0, 0.5)'
    }
  }

  const sizeConfig = {
    small: {
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      borderRadius: '8px'
    },
    medium: {
      padding: '0.75rem 1rem',
      fontSize: '1rem',
      borderRadius: '10px'
    },
    large: {
      padding: '0.75rem 1.25rem',
      fontSize: '1rem',
      borderRadius: '12px'
    }
  }

  return {
    ...baseStyles[action],
    ...sizeConfig[size]
  }
}

/**
 * Get confidence level description
 */
function getConfidenceLevel(confidence: number): {
  level: 'Low' | 'Medium' | 'High' | 'Very High'
  color: string
} {
  if (confidence >= 0.8) {
    return { level: 'Very High', color: 'rgba(0, 200, 83, 0.9)' }
  } else if (confidence >= 0.6) {
    return { level: 'High', color: 'rgba(0, 200, 83, 0.9)' }
  } else if (confidence >= 0.4) {
    return { level: 'Medium', color: 'rgba(255, 193, 7, 0.9)' }
  } else {
    return { level: 'Low', color: 'rgba(239, 68, 68, 0.9)' }
  }
}

/**
 * RecommendationBadge Component
 */
export const RecommendationBadge: React.FC<RecommendationBadgeProps> = ({
  action,
  confidence,
  size = 'medium',
  showConfidence = true
}) => {
  const actionStyles = getActionStyles(action, size)
  const confidenceInfo = getConfidenceLevel(confidence)

  return (
    <div
      className="recommendation-badge"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minWidth: size === 'large' ? '120px' : size === 'medium' ? '100px' : '80px',
        background: actionStyles.background,
        border: actionStyles.border,
        borderRadius: actionStyles.borderRadius,
        padding: actionStyles.padding,
        boxShadow: actionStyles.shadow,
        position: 'relative',
        transition: 'all 0.3s ease',
        cursor: 'default',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = actionStyles.shadow.replace('15px', '20px')
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = actionStyles.shadow
      }}
    >
      {/* Action Label */}
      <div
        style={{
          fontSize: actionStyles.fontSize,
          fontWeight: '700',
          color: actionStyles.color,
          marginBottom: showConfidence ? '0.25rem' : '0',
          letterSpacing: '0.5px'
        }}
      >
        {action}
      </div>

      {/* Confidence Information */}
      {showConfidence && (
        <>
          {/* Confidence Percentage */}
          <div
            style={{
              fontSize: size === 'large' ? '0.75rem' : '0.7rem',
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '0.25rem',
              fontWeight: '500'
            }}
          >
            {Math.round(confidence * 100)}% confidence
          </div>

          {/* Confidence Level Indicator */}
          <div
            style={{
              fontSize: size === 'large' ? '0.65rem' : '0.6rem',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {confidenceInfo.level}
          </div>

          {/* Confidence Bar */}
          <div
            style={{
              width: '100%',
              height: '3px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              marginTop: '0.5rem',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: `${confidence * 100}%`,
                height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                borderRadius: '2px',
                transition: 'width 0.6s ease',
                position: 'relative'
              }}
            >
              {/* Animated shimmer effect */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
                  animation: 'shimmer 2s infinite'
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Pulse animation for high confidence */}
      {confidence >= 0.8 && (
        <div
          style={{
            position: 'absolute',
            top: '-2px',
            left: '-2px',
            right: '-2px',
            bottom: '-2px',
            borderRadius: actionStyles.borderRadius,
            border: '2px solid rgba(255, 255, 255, 0.3)',
            animation: 'pulse 2s infinite',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* CSS animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }

        @keyframes pulse {
          0% {
            opacity: 0;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.05);
          }
          100% {
            opacity: 0;
            transform: scale(1.1);
          }
        }

        .recommendation-badge:hover {
          animation: none;
        }

        .recommendation-badge:hover > div:last-child {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}

export default RecommendationBadge