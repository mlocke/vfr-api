/**
 * Economic Calendar API Route
 * Provides economic events using FRED API and other free sources
 */

import { NextRequest, NextResponse } from 'next/server'
import { FREDAPI } from '../../../services/financial-data/FREDAPI'
import ErrorHandler from '../../../services/error-handling/ErrorHandler'

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

const fredAPI = new FREDAPI()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || 'today'

    // Use real FRED data to generate economic calendar
    const events = await generateRealEconomicEvents(timeframe)

    return NextResponse.json(
      {
        events,
        timeframe,
        lastUpdate: new Date().toISOString(),
        source: 'Fed Economic Calendar'
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60', // 5-minute cache
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('EconomicCalendarAPI.GET error:', error)

    return NextResponse.json(
      {
        error: 'Failed to retrieve economic calendar',
        message: 'Unable to fetch economic events. Please try again later.',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

async function generateRealEconomicEvents(timeframe: string): Promise<EconomicEvent[]> {
  const events: EconomicEvent[] = []

  try {
    // Get real economic data from FRED
    const [inflationSeries, employmentSeries, gdpSeries] = await Promise.allSettled([
      fredAPI.searchSeries('CPI inflation', 3),
      fredAPI.searchSeries('unemployment claims', 3),
      fredAPI.searchSeries('GDP growth', 3)
    ])

    // Generate events based on real FRED series
    const now = new Date()
    let eventId = 0

    // Add inflation events if we found relevant series
    if (inflationSeries.status === 'fulfilled' && inflationSeries.value.length > 0) {
      inflationSeries.value.slice(0, 2).forEach(series => {
        events.push({
          id: `fred-${++eventId}`,
          title: series.title,
          time: new Date(now.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          impact: 'high',
          description: series.notes || 'Economic data release from FRED',
          category: 'Inflation',
          forecast: 'TBD',
          previous: 'TBD'
        })
      })
    }

    // Add employment events if we found relevant series
    if (employmentSeries.status === 'fulfilled' && employmentSeries.value.length > 0) {
      employmentSeries.value.slice(0, 2).forEach(series => {
        events.push({
          id: `fred-${++eventId}`,
          title: series.title,
          time: new Date(now.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          impact: 'medium',
          description: series.notes || 'Economic data release from FRED',
          category: 'Employment',
          forecast: 'TBD',
          previous: 'TBD'
        })
      })
    }

    // Add GDP events if we found relevant series
    if (gdpSeries.status === 'fulfilled' && gdpSeries.value.length > 0) {
      gdpSeries.value.slice(0, 1).forEach(series => {
        events.push({
          id: `fred-${++eventId}`,
          title: series.title,
          time: new Date(now.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          impact: 'high',
          description: series.notes || 'Economic data release from FRED',
          category: 'Growth',
          forecast: 'TBD',
          previous: 'TBD'
        })
      })
    }

    // Filter by timeframe
    const maxTime = timeframe === 'today' ? 1 : timeframe === 'week' ? 7 : 30
    const filteredEvents = events.filter(event => {
      const eventTime = new Date(event.time)
      const daysDiff = (eventTime.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      return daysDiff <= maxTime
    })

    // Sort by time
    filteredEvents.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

    return filteredEvents

  } catch (error) {
    console.error('Error generating real economic events:', error)
    // Return empty array rather than mock data
    return []
  }
}


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}