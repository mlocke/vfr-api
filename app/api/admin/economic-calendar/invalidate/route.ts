/**
 * Admin endpoint to invalidate Economic Calendar cache
 * Use when Fed/BLS schedules change
 */

import { NextRequest, NextResponse } from 'next/server'
import { EconomicCalendarService } from '../../../../services/financial-data/EconomicCalendarService'

const economicCalendarService = new EconomicCalendarService()

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe')

    if (timeframe && ['today', 'week', 'month'].includes(timeframe)) {
      // Invalidate specific timeframe
      economicCalendarService.invalidateTimeframe(timeframe as 'today' | 'week' | 'month')

      return NextResponse.json({
        success: true,
        message: `Economic Calendar cache invalidated for: ${timeframe}`,
        timestamp: new Date().toISOString()
      })
    } else {
      // Invalidate all cache
      economicCalendarService.invalidateCache()

      return NextResponse.json({
        success: true,
        message: 'Economic Calendar cache completely invalidated',
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Cache invalidation error:', error)

    return NextResponse.json(
      {
        error: 'Failed to invalidate cache',
        message: 'Cache invalidation operation failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}