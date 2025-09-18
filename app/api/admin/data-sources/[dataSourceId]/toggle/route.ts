/**
 * Admin API - Data Source Toggle Endpoint
 * PUT /api/admin/data-sources/{dataSourceId}/toggle
 * Enables or disables a specific API data source
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../../../services/admin/ServerConfigManager'

interface RouteParams {
  params: {
    dataSourceId: string
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { dataSourceId } = params

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

    // Toggle the data source
    const result = await serverConfigManager.toggleServer(dataSourceId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to toggle data source' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        dataSourceId,
        enabled: result.enabled,
        status: result.status || 'unknown',
        message: `Data source ${result.enabled ? 'enabled' : 'disabled'} successfully`
      }
    })

  } catch (error) {
    console.error(`Error toggling data source ${params.dataSourceId}:`, error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}