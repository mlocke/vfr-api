'use client'

import { useState, useEffect } from 'react'

interface EconomicEvent {
  id: string
  title: string
  time: string
  impact: 'high' | 'medium' | 'low'
  actual?: string
  forecast?: string
  previous?: string
  description: string
  category: string
}

interface EconomicCalendarProps {
  className?: string
}

export default function EconomicCalendar({ className = '' }: EconomicCalendarProps) {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'month'>('today')

  useEffect(() => {
    fetchEconomicEvents()
    const interval = setInterval(fetchEconomicEvents, 300000) // Update every 5 minutes

    return () => clearInterval(interval)
  }, [selectedTimeframe])

  const fetchEconomicEvents = async () => {
    try {
      const response = await fetch(`/api/economic/calendar?timeframe=${selectedTimeframe}`)
      if (!response.ok) throw new Error('Failed to fetch economic events')

      const data = await response.json()
      setEvents(data.events || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching economic events:', err)
      setError('Unable to load economic events - API unavailable')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }


  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'high': return 'rgba(239, 68, 68, 0.8)' // Red
      case 'medium': return 'rgba(251, 146, 60, 0.8)' // Orange
      case 'low': return 'rgba(156, 163, 175, 0.8)' // Gray
      default: return 'rgba(156, 163, 175, 0.8)'
    }
  }

  const getImpactGlow = (impact: string): string => {
    switch (impact) {
      case 'high': return '0 0 15px rgba(239, 68, 68, 0.4)'
      case 'medium': return '0 0 15px rgba(251, 146, 60, 0.4)'
      case 'low': return '0 0 15px rgba(156, 163, 175, 0.4)'
      default: return '0 0 15px rgba(156, 163, 175, 0.4)'
    }
  }

  const getCategoryIcon = (category: string): string => {
    switch (category.toLowerCase()) {
      case 'monetary policy': return '🏦'
      case 'inflation': return '📈'
      case 'employment': return '👥'
      case 'growth': return '📊'
      case 'consumer': return '🛒'
      default: return '📰'
    }
  }

  const formatTime = (timeString: string): string => {
    const eventTime = new Date(timeString)
    const now = new Date()
    const diffMs = eventTime.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffMs < 0) return 'Past'
    if (diffHours < 1) return 'Soon'
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays === 1) return 'Tomorrow'
    return `${diffDays}d`
  }

  const formatDate = (timeString: string): string => {
    const eventTime = new Date(timeString)
    return eventTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (timeString: string): string => {
    const eventTime = new Date(timeString)
    return eventTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  const isUpcoming = (timeString: string): boolean => {
    const eventTime = new Date(timeString)
    const now = new Date()
    const diffMs = eventTime.getTime() - now.getTime()
    return diffMs > 0 && diffMs < 24 * 60 * 60 * 1000 // Next 24 hours
  }

  if (loading) {
    return (
      <div className={`economic-calendar ${className}`}>
        <div className="calendar-header">
          <h3 className="calendar-title">Economic Calendar</h3>
        </div>
        <div className="loading-container">
          <div className="cyber-loading">
            <div className="loading-text">Loading Economic Events...</div>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <style jsx>{`
          .economic-calendar {
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(15px);
            border-radius: 16px;
            border: 1px solid rgba(99, 102, 241, 0.3);
            padding: 1.5rem;
            color: rgba(255, 255, 255, 0.9);
            min-height: 400px;
          }

          .calendar-header {
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid rgba(99, 102, 241, 0.2);
          }

          .calendar-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
          }

          .loading-container {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
          }

          .cyber-loading {
            text-align: center;
            color: rgba(99, 102, 241, 0.9);
          }

          .loading-text {
            font-size: 14px;
            margin-bottom: 1rem;
            animation: pulse 2s infinite;
          }

          .loading-dots {
            display: flex;
            gap: 0.5rem;
            justify-content: center;
          }

          .loading-dots span {
            width: 8px;
            height: 8px;
            background: rgba(99, 102, 241, 0.8);
            border-radius: 50%;
            animation: bounce 1.5s infinite;
          }

          .loading-dots span:nth-child(2) {
            animation-delay: 0.2s;
          }

          .loading-dots span:nth-child(3) {
            animation-delay: 0.4s;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`economic-calendar ${className}`}>
      <div className="calendar-header">
        <h3 className="calendar-title">Economic Calendar</h3>
        <div className="timeframe-selector">
          <button
            className={`timeframe-btn ${selectedTimeframe === 'today' ? 'active' : ''}`}
            onClick={() => setSelectedTimeframe('today')}
          >
            Today
          </button>
          <button
            className={`timeframe-btn ${selectedTimeframe === 'week' ? 'active' : ''}`}
            onClick={() => setSelectedTimeframe('week')}
          >
            Week
          </button>
          <button
            className={`timeframe-btn ${selectedTimeframe === 'month' ? 'active' : ''}`}
            onClick={() => setSelectedTimeframe('month')}
          >
            Month
          </button>
        </div>
      </div>

      <div className="events-container">
        {events.length === 0 ? (
          <div className="no-events">
            <div className="no-events-icon">📅</div>
            <div className="no-events-text">
              No economic events scheduled for {selectedTimeframe}
              <div className="timeframe-hint">
                Try switching to "Week" or "Month" view for upcoming events
              </div>
            </div>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={`event-card ${isUpcoming(event.time) ? 'upcoming' : ''}`}
              style={{
                borderLeftColor: getImpactColor(event.impact),
                boxShadow: isUpcoming(event.time) ? getImpactGlow(event.impact) : 'none'
              }}
            >
              <div className="event-header">
                <div className="event-meta">
                  <span className="event-icon">{getCategoryIcon(event.category)}</span>
                  <div className="event-timing">
                    <span className="event-date">{formatDate(event.time)}</span>
                    <span className="event-time">{formatTime(event.time)}</span>
                  </div>
                  <span
                    className={`impact-badge impact-${event.impact}`}
                    style={{ backgroundColor: getImpactColor(event.impact) }}
                  >
                    {event.impact.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="event-content">
                <h4 className="event-title">{event.title}</h4>
                <p className="event-description">{event.description}</p>

                {(event.forecast || event.previous) && (
                  <div className="event-data">
                    {event.forecast && (
                      <div className="data-item">
                        <span className="data-label">Forecast:</span>
                        <span className="data-value">{event.forecast}</span>
                      </div>
                    )}
                    {event.previous && (
                      <div className="data-item">
                        <span className="data-label">Previous:</span>
                        <span className="data-value">{event.previous}</span>
                      </div>
                    )}
                    {event.actual && (
                      <div className="data-item">
                        <span className="data-label">Actual:</span>
                        <span className="data-value actual">{event.actual}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .economic-calendar {
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(15px);
          border-radius: 16px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 1.5rem;
          color: rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(99, 102, 241, 0.2);
        }

        .calendar-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
        }

        .timeframe-selector {
          display: flex;
          gap: 0.5rem;
        }

        .timeframe-btn {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: rgba(255, 255, 255, 0.7);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .timeframe-btn:hover,
        .timeframe-btn.active {
          background: rgba(99, 102, 241, 0.3);
          color: rgba(255, 255, 255, 0.95);
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
        }

        .events-container {
          max-height: 400px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
        }

        .events-container::-webkit-scrollbar {
          width: 6px;
        }

        .events-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .events-container::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.3);
          border-radius: 3px;
        }

        .event-card {
          background: rgba(31, 41, 55, 0.6);
          border-radius: 10px;
          border-left: 4px solid;
          padding: 1rem;
          margin-bottom: 1rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }

        .event-card:hover {
          background: rgba(31, 41, 55, 0.8);
          transform: translateX(4px);
        }

        .event-card.upcoming {
          animation: pulse-upcoming 3s infinite;
        }

        .event-header {
          margin-bottom: 0.75rem;
        }

        .event-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .event-icon {
          font-size: 1.2rem;
        }

        .event-timing {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .event-date {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
        }

        .event-time {
          font-size: 0.75rem;
          color: rgba(156, 163, 175, 0.8);
          font-weight: 500;
        }

        .impact-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        .event-content {
          padding-left: 0.5rem;
        }

        .event-title {
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .event-description {
          font-size: 0.85rem;
          color: rgba(156, 163, 175, 0.9);
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }

        .event-data {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .data-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .data-label {
          font-size: 0.75rem;
          color: rgba(156, 163, 175, 0.7);
        }

        .data-value {
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .data-value.actual {
          color: rgba(34, 197, 94, 0.9);
          text-shadow: 0 0 5px rgba(34, 197, 94, 0.3);
        }

        .no-events {
          text-align: center;
          padding: 3rem 1rem;
          color: rgba(156, 163, 175, 0.7);
        }

        .no-events-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .no-events-text {
          font-size: 1rem;
        }

        .timeframe-hint {
          font-size: 0.9rem;
          color: rgba(99, 102, 241, 0.8);
          margin-top: 0.5rem;
          font-weight: 500;
        }

        @keyframes pulse-upcoming {
          0%, 100% {
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
          }
          50% {
            box-shadow: 0 0 25px rgba(239, 68, 68, 0.5);
          }
        }

        @media (max-width: 640px) {
          .calendar-header {
            flex-direction: column;
            gap: 1rem;
          }

          .event-data {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}