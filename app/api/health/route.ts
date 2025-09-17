/**
 * Health Check API Endpoint
 * Provides service health status and debugging information
 */

import { NextRequest, NextResponse } from 'next/server'
import { serviceInitializer } from '../../services/ServiceInitializer'

export async function GET(request: NextRequest) {
  try {
    // Ensure services are initialized
    await serviceInitializer.initializeServices()

    // Get health status
    const health = await serviceInitializer.healthCheck()

    const response = {
      success: true,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV,
      services: health,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    }

    const status = health.overall ? 200 : 503

    return NextResponse.json(response, {
      status,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Health check failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        timestamp: Date.now(),
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}