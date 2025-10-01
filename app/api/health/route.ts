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

    // Check ML services health (optional, non-blocking)
    let mlServicesHealth = {
      available: false,
      services: {},
      phase: 'Phase 1.4 - API structure only'
    }

    try {
      const { MLCacheService } = await import('../../services/ml/cache/MLCacheService')

      // Check ML cache service
      const mlCache = MLCacheService.getInstance()
      const mlCacheHealthy = await mlCache.healthCheck()

      mlServicesHealth = {
        available: true,
        services: {
          mlCache: {
            healthy: mlCacheHealthy.healthy,
            details: mlCacheHealthy
          },
          modelManager: {
            healthy: true,
            status: 'not_yet_implemented',
            phase: 'Phase 3',
            message: 'Model management will be available in Phase 3'
          }
        },
        phase: 'Phase 1.4 - Partial implementation'
      }
    } catch (error) {
      // ML services not available - this is acceptable (optional enhancement)
      console.log('ML services not available:', error instanceof Error ? error.message : 'Unknown error')
    }

    const response = {
      success: true,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV,
      services: health,
      mlServices: mlServicesHealth,
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
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}