"use client";

import { useState } from 'react';
import { formatMarketCap } from './stock-analysis/utils/formatters';

interface StockRecommendationCardProps {
  stock: {
    symbol: string;
    price?: number;
    priceChange?: number;
    priceChangePercent?: number;
    recommendation?: string;
    confidence?: number;
    compositeScore?: number;
    sector?: string;
    marketCap?: string;
    technicalScore?: number;
    fundamentalScore?: number;
    macroScore?: number;
    sentimentScore?: number;
    esgScore?: number;
    analystScore?: number;
    insights?: {
      positive?: string[];
      risks?: string[];
    };
    reasoning?: string | {
      primaryFactors?: string[];
      warnings?: string[];
      opportunities?: string[];
      optionsAnalysis?: any;
    };
  };
}

export default function StockRecommendationCard({ stock }: StockRecommendationCardProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const getRecommendationColor = (rec?: string) => {
    switch (rec?.toUpperCase()) {
      case 'BUY':
      case 'STRONG BUY':
        return { bg: 'rgba(34, 197, 94, 0.2)', text: 'rgba(34, 197, 94, 0.9)', border: 'rgba(34, 197, 94, 0.5)' };
      case 'SELL':
      case 'STRONG SELL':
        return { bg: 'rgba(239, 68, 68, 0.2)', text: 'rgba(239, 68, 68, 0.9)', border: 'rgba(239, 68, 68, 0.5)' };
      default:
        return { bg: 'rgba(251, 191, 36, 0.2)', text: 'rgba(251, 191, 36, 0.9)', border: 'rgba(251, 191, 36, 0.5)' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'rgba(34, 197, 94, 0.9)';
    if (score >= 50) return 'rgba(251, 191, 36, 0.9)';
    if (score >= 30) return 'rgba(251, 191, 36, 0.7)';
    return 'rgba(239, 68, 68, 0.9)';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Strong';
    if (score >= 50) return 'Moderate';
    if (score >= 30) return 'Weak';
    return 'Extreme';
  };

  const recColors = getRecommendationColor(stock.recommendation);
  const compositeScore = stock.compositeScore || 0;

  // Helper function to normalize scores to 0-100 scale
  const normalizeScore = (score: number): number => {
    // If score is already in 0-100 range (>1), return as is
    if (score > 1) return score;
    // If score is in 0-1 range (decimal percentage), convert to 0-100
    return score * 100;
  };

  // Calculate score metrics with fallbacks and normalization
  const scoreMetrics = [
    { label: 'Technical', value: normalizeScore(stock.technicalScore || 0), key: 'technical' },
    { label: 'Fundamental', value: normalizeScore(stock.fundamentalScore || 0), key: 'fundamental' },
    { label: 'Macro', value: normalizeScore(stock.macroScore || 0), key: 'macro' },
    { label: 'Sentiment', value: normalizeScore(stock.sentimentScore || 0), key: 'sentiment' },
    { label: 'ESG', value: normalizeScore(stock.esgScore || 0), key: 'esg' },
    { label: 'Analyst', value: normalizeScore(stock.analystScore || 0), key: 'analyst' },
  ];

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Helper function to format camelCase factor names to display names
  const formatFactorName = (factor: string): string => {
    // Handle common factor names
    const factorMap: Record<string, string> = {
      'fundamentalScore': 'Fundamental Score',
      'technicalScore': 'Technical Score',
      'macroScore': 'Macro Score',
      'sentimentScore': 'Sentiment Score',
      'esgScore': 'ESG Score',
      'analystScore': 'Analyst Score',
      'momentum_composite': 'Momentum Composite',
      'quality_composite': 'Quality Composite',
      'value_composite': 'Value Composite',
      'composite': 'Composite Score',
    };

    // Return mapped name if exists
    if (factorMap[factor]) {
      return factorMap[factor];
    }

    // Otherwise, convert camelCase to Title Case
    return factor
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/_/g, ' ') // Replace underscores with spaces
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%)',
      border: `2px solid ${recColors.border}`,
      borderRadius: '20px',
      padding: '2rem',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 200, 83, 0.1)',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      {/* Header Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.5rem',
      }}>
        <div>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: 'white',
            margin: 0,
            letterSpacing: '0.5px',
          }}>
            {stock.symbol}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            {stock.price && (
              <span style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.9)',
              }}>
                ${stock.price.toFixed(2)}
              </span>
            )}
            {stock.priceChangePercent !== undefined && (
              <span style={{
                background: stock.priceChangePercent >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: stock.priceChangePercent >= 0 ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
              }}>
                {stock.priceChangePercent >= 0 ? '+' : ''}{stock.priceChangePercent.toFixed(2)}%
              </span>
            )}
          </div>
          {stock.sector && (
            <div style={{
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.6)',
              marginTop: '0.25rem',
            }}>
              {stock.sector} {stock.marketCap && `| Market Cap: ${formatMarketCap(stock.marketCap)}`}
            </div>
          )}
        </div>

        {/* Recommendation Badge */}
        <div style={{
          background: recColors.bg,
          border: `2px solid ${recColors.border}`,
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          minWidth: '120px',
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: recColors.text,
            letterSpacing: '0.5px',
          }}>
            {stock.recommendation?.toUpperCase() || 'HOLD'}
          </div>
          {stock.confidence && (
            <div style={{
              fontSize: '0.85rem',
              fontWeight: '600',
              color: recColors.text,
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
            }}>
              {stock.confidence}%
            </div>
          )}
        </div>
      </div>

      {/* Overall Score Section */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}>
          <span style={{
            fontSize: '0.9rem',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.8)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Overall Score: {Math.round(compositeScore)}/100
          </span>
          <span style={{
            fontSize: '0.85rem',
            color: getScoreColor(compositeScore),
            fontWeight: '600',
          }}>
            {getScoreLabel(compositeScore)}
          </span>
        </div>

        {/* Score Bar */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          height: '12px',
          overflow: 'hidden',
          marginBottom: '1rem',
        }}>
          <div style={{
            background: `linear-gradient(90deg, ${getScoreColor(compositeScore)}, rgba(0, 200, 83, 0.6))`,
            height: '100%',
            width: `${compositeScore}%`,
            borderRadius: '20px',
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Score Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
        }}>
          {scoreMetrics.map((metric) => (
            <div key={metric.key} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            }}>
              <span style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}>
                {metric.label}
              </span>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}>
                <span style={{
                  fontSize: '1rem',
                  fontWeight: '700',
                  color: getScoreColor(metric.value),
                }}>
                  {Math.round(metric.value)}
                </span>
                <div style={{
                  width: '50px',
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginTop: '0.25rem',
                }}>
                  <div style={{
                    background: getScoreColor(metric.value),
                    height: '100%',
                    width: `${metric.value}%`,
                    borderRadius: '2px',
                  }} />
                </div>
              </div>
              <span style={{
                fontSize: '0.65rem',
                color: getScoreColor(metric.value),
                fontWeight: '500',
              }}>
                {getScoreLabel(metric.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Insights */}
      {stock.insights?.positive && stock.insights.positive.length > 0 && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <h4 style={{
            fontSize: '0.9rem',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: '0 0 0.75rem 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Quick Insights
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stock.insights.positive.slice(0, 3).map((insight, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span style={{ color: 'rgba(34, 197, 94, 0.9)', fontSize: '1rem' }}>✓</span>
                <span style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: '1.4',
                }}>
                  {insight}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Sections */}
      {stock.reasoning && (
        <>
          <div
            onClick={() => toggleSection('reasoning')}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{
              fontSize: '0.9rem',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Why This Recommendation
            </span>
            <span style={{
              fontSize: '1.2rem',
              color: 'rgba(255, 255, 255, 0.6)',
              transform: expandedSection === 'reasoning' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
            }}>
              ›
            </span>
          </div>
          {expandedSection === 'reasoning' && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '0.75rem',
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: '1.6',
            }}>
              {typeof stock.reasoning === 'string' ? (
                stock.reasoning
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {stock.reasoning.primaryFactors && stock.reasoning.primaryFactors.length > 0 && (
                    <div>
                      <h5 style={{
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        Primary Factors
                      </h5>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}>
                        {stock.reasoning.primaryFactors.map((factor, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>
                            {formatFactorName(factor)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {stock.reasoning.opportunities && stock.reasoning.opportunities.length > 0 && (
                    <div>
                      <h5 style={{
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: 'rgba(34, 197, 94, 0.9)',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        Opportunities
                      </h5>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}>
                        {stock.reasoning.opportunities.map((opp, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>
                            {opp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {stock.reasoning.warnings && stock.reasoning.warnings.length > 0 && (
                    <div>
                      <h5 style={{
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: 'rgba(251, 191, 36, 0.9)',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        Warnings
                      </h5>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}>
                        {stock.reasoning.warnings.map((warning, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {stock.insights?.risks && stock.insights.risks.length > 0 && (
        <>
          <div
            onClick={() => toggleSection('risks')}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{
              fontSize: '0.9rem',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Risks & Opportunities
            </span>
            <span style={{
              fontSize: '1.2rem',
              color: 'rgba(255, 255, 255, 0.6)',
              transform: expandedSection === 'risks' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
            }}>
              ›
            </span>
          </div>
          {expandedSection === 'risks' && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '0.75rem',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stock.insights.risks.map((risk, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    <span style={{ color: 'rgba(251, 191, 36, 0.9)', fontSize: '1rem' }}>⚠</span>
                    <span style={{
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.8)',
                      lineHeight: '1.4',
                    }}>
                      {risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Timestamp */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '0.75rem',
        color: 'rgba(255, 255, 255, 0.4)',
        textAlign: 'right',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.5rem',
      }}>
        <span>⏱</span>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}