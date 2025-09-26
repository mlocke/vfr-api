'use client'

import React from 'react'

interface RiskOpportunity {
  title: string
  description: string
  type: 'risk' | 'opportunity'
  severity: 'low' | 'medium' | 'high'
  category: string
}

interface RisksOpportunitiesProps {
  risks: string[]
  opportunities: string[]
  isExpanded: boolean
  onToggle: () => void
}

// Convert simple string arrays to structured risk/opportunity objects
const processRisksAndOpportunities = (
  risks: string[],
  opportunities: string[]
): RiskOpportunity[] => {
  const items: RiskOpportunity[] = []

  // Process risks
  risks.forEach((risk, index) => {
    // Determine severity based on keywords
    let severity: 'low' | 'medium' | 'high' = 'medium'
    const riskLower = risk.toLowerCase()

    if (riskLower.includes('high') || riskLower.includes('significant') || riskLower.includes('major')) {
      severity = 'high'
    } else if (riskLower.includes('low') || riskLower.includes('minor') || riskLower.includes('limited')) {
      severity = 'low'
    }

    // Determine category based on keywords
    let category = 'General'
    if (riskLower.includes('debt') || riskLower.includes('financial') || riskLower.includes('cash')) {
      category = 'Financial'
    } else if (riskLower.includes('market') || riskLower.includes('competition')) {
      category = 'Market'
    } else if (riskLower.includes('regulation') || riskLower.includes('legal')) {
      category = 'Regulatory'
    } else if (riskLower.includes('operational') || riskLower.includes('management')) {
      category = 'Operational'
    }

    items.push({
      title: risk,
      description: risk,
      type: 'risk',
      severity,
      category
    })
  })

  // Process opportunities
  opportunities.forEach((opportunity, index) => {
    // Determine severity (for opportunities, this represents potential impact)
    let severity: 'low' | 'medium' | 'high' = 'medium'
    const oppLower = opportunity.toLowerCase()

    if (oppLower.includes('significant') || oppLower.includes('major') || oppLower.includes('strong')) {
      severity = 'high'
    } else if (oppLower.includes('limited') || oppLower.includes('modest')) {
      severity = 'low'
    }

    // Determine category
    let category = 'General'
    if (oppLower.includes('growth') || oppLower.includes('expansion')) {
      category = 'Growth'
    } else if (oppLower.includes('market') || oppLower.includes('share')) {
      category = 'Market'
    } else if (oppLower.includes('product') || oppLower.includes('innovation')) {
      category = 'Innovation'
    } else if (oppLower.includes('efficiency') || oppLower.includes('cost')) {
      category = 'Efficiency'
    }

    items.push({
      title: opportunity,
      description: opportunity,
      type: 'opportunity',
      severity,
      category
    })
  })

  // Add default items if arrays are empty
  if (items.length === 0) {
    items.push(
      {
        title: 'Market Volatility Risk',
        description: 'General market conditions may impact stock performance',
        type: 'risk',
        severity: 'medium',
        category: 'Market'
      },
      {
        title: 'Growth Potential',
        description: 'Company positioned for potential growth in current market environment',
        type: 'opportunity',
        severity: 'medium',
        category: 'Growth'
      }
    )
  }

  return items
}

const ItemCard: React.FC<{
  item: RiskOpportunity
  index: number
}> = ({ item, index }) => {
  const isRisk = item.type === 'risk'

  const getSeverityInfo = (severity: 'low' | 'medium' | 'high', type: 'risk' | 'opportunity') => {
    if (type === 'risk') {
      const severityMap = {
        high: { label: 'High Risk', color: 'rgba(239, 68, 68, 0.9)', bg: 'rgba(239, 68, 68, 0.1)' },
        medium: { label: 'Medium Risk', color: 'rgba(255, 193, 7, 0.9)', bg: 'rgba(255, 193, 7, 0.1)' },
        low: { label: 'Low Risk', color: 'rgba(34, 197, 94, 0.9)', bg: 'rgba(34, 197, 94, 0.1)' }
      }
      return severityMap[severity]
    } else {
      const severityMap = {
        high: { label: 'High Impact', color: 'rgba(34, 197, 94, 0.9)', bg: 'rgba(34, 197, 94, 0.1)' },
        medium: { label: 'Medium Impact', color: 'rgba(59, 130, 246, 0.9)', bg: 'rgba(59, 130, 246, 0.1)' },
        low: { label: 'Low Impact', color: 'rgba(156, 163, 175, 0.9)', bg: 'rgba(156, 163, 175, 0.1)' }
      }
      return severityMap[severity]
    }
  }

  const severityInfo = getSeverityInfo(item.severity, item.type)
  const borderColor = isRisk ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'
  const iconBg = isRisk ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)'

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: `1px solid ${borderColor}`,
        borderRadius: '10px',
        padding: '1rem',
        marginBottom: '0.75rem',
        opacity: 0,
        animation: `slideInFromSide 0.4s ease-out ${0.1 + index * 0.05}s forwards`,
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
        e.currentTarget.style.borderColor = isRisk ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
        e.currentTarget.style.borderColor = borderColor
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          marginBottom: '0.75rem'
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: 'white',
            flexShrink: 0,
            marginTop: '2px'
          }}
        >
          {isRisk ? '⚠' : '↗'}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}
          >
            <h4
              style={{
                fontSize: '0.95rem',
                fontWeight: '600',
                color: 'white',
                margin: 0,
                lineHeight: '1.3'
              }}
            >
              {item.title}
            </h4>

            {/* Severity Badge */}
            <div
              style={{
                background: severityInfo.bg,
                color: severityInfo.color,
                border: `1px solid ${severityInfo.color}40`,
                borderRadius: '6px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.7rem',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}
            >
              {severityInfo.label}
            </div>
          </div>

          {/* Category */}
          <div
            style={{
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: '0.5rem'
            }}
          >
            {item.category}
          </div>

          {/* Description */}
          {item.description && item.description !== item.title && (
            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.4',
                margin: 0
              }}
            >
              {item.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const RisksOpportunities: React.FC<RisksOpportunitiesProps> = ({
  risks,
  opportunities,
  isExpanded,
  onToggle
}) => {
  const items = processRisksAndOpportunities(risks, opportunities)
  const riskItems = items.filter(item => item.type === 'risk')
  const opportunityItems = items.filter(item => item.type === 'opportunity')

  const riskCount = riskItems.length
  const opportunityCount = opportunityItems.length
  const totalItems = items.length

  return (
    <>
      <style jsx>{`
        @keyframes slideInFromSide {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes expandContent {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 1000px;
            transform: translateY(0);
          }
        }

        .section-container {
          margin-bottom: 2rem;
        }

        .section-header {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }

        .section-header:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .section-header:focus {
          outline: 2px solid rgba(255, 255, 255, 0.3);
          outline-offset: 2px;
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: white;
          margin: 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .item-counts {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .count-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .risk-count {
          background: rgba(239, 68, 68, 0.2);
          color: rgba(239, 68, 68, 0.9);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .opportunity-count {
          background: rgba(34, 197, 94, 0.2);
          color: rgba(34, 197, 94, 0.9);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .expand-icon {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.6);
          transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};
          transition: transform 0.3s ease;
        }

        .content {
          overflow: hidden;
          animation: ${isExpanded ? 'expandContent 0.3s ease-out' : 'none'};
          max-height: ${isExpanded ? '1000px' : '0'};
          opacity: ${isExpanded ? '1' : '0'};
          transition: all 0.3s ease;
        }

        .content-inner {
          padding: 1.5rem;
          padding-top: 1rem;
        }

        .items-grid {
          display: grid;
          gap: 1rem;
        }

        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          margin: 1.5rem 0;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .item-counts {
            gap: 0.75rem;
          }

          .section-title {
            font-size: 1.1rem;
          }
        }

        @media (max-width: 480px) {
          .section-header {
            padding: 1rem;
          }

          .content-inner {
            padding: 1rem;
          }

          .count-badge {
            font-size: 0.75rem;
            padding: 0.2rem 0.6rem;
          }
        }
      `}</style>

      <section
        className="section-container"
        aria-labelledby="risks-opportunities-heading"
      >
        {/* Section Header */}
        <div
          className="section-header"
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle()
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-controls="risks-opportunities-content"
        >
          <div className="header-content">
            <div className="header-left">
              <span style={{ fontSize: '1.2rem' }}>⚖️</span>
              <h3
                className="section-title"
                id="risks-opportunities-heading"
              >
                Risks & Opportunities
              </h3>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <div className="item-counts">
                <div className="count-badge risk-count">
                  {riskCount} Risk{riskCount !== 1 ? 's' : ''}
                </div>
                <div className="count-badge opportunity-count">
                  {opportunityCount} Opportunit{opportunityCount !== 1 ? 'ies' : 'y'}
                </div>
              </div>

              <div className="expand-icon" aria-hidden="true">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Content */}
        <div
          className="content"
          id="risks-opportunities-content"
          aria-hidden={!isExpanded}
        >
          <div className="content-inner">
            {/* Risks Section */}
            {riskItems.length > 0 && (
              <div>
                <h4
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: 'rgba(239, 68, 68, 0.9)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>⚠️</span>
                  Risk Factors
                </h4>
                <div className="items-grid">
                  {riskItems.map((item, index) => (
                    <ItemCard
                      key={`risk-${index}`}
                      item={item}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {riskItems.length > 0 && opportunityItems.length > 0 && (
              <div className="section-divider" />
            )}

            {/* Opportunities Section */}
            {opportunityItems.length > 0 && (
              <div>
                <h4
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: 'rgba(34, 197, 94, 0.9)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>🚀</span>
                  Opportunities
                </h4>
                <div className="items-grid">
                  {opportunityItems.map((item, index) => (
                    <ItemCard
                      key={`opportunity-${index}`}
                      item={item}
                      index={riskItems.length + index}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                textAlign: 'center'
              }}
            >
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  margin: 0,
                  lineHeight: '1.4'
                }}
              >
                Comprehensive analysis of {totalItems} key factors affecting investment potential
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export { RisksOpportunities }
export default RisksOpportunities