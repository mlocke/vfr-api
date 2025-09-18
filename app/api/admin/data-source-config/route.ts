/**
 * Admin API - Data Source Configuration Endpoint
 * GET /api/admin/data-source-config
 * Returns the configuration and status of all API data sources
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../services/admin/ServerConfigManager'

export async function GET(request: NextRequest) {
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    // Validate admin access
    const isAdmin = await serverConfigManager.validateAdminAccess(token)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Administrator access required' },
        { status: 403 }
      )
    }

    // Get all data source configurations
    const dataSources = await serverConfigManager.getAllServers()
    const enabledDataSources = dataSources
      .filter(ds => ds.enabled)
      .map(ds => ds.id)

    return NextResponse.json({
      success: true,
      enabledDataSources,
      dataSources,
      totalCount: dataSources.length,
      enabledCount: enabledDataSources.length,
      lastUpdated: Date.now()
    })

  } catch (error) {
    console.error('Error fetching data source configuration:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch data source configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}