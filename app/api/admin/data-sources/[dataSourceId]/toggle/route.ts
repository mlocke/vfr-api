/**
 * Admin API - Data Source Toggle Endpoint
 * PUT /api/admin/data-sources/{dataSourceId}/toggle
 * Enables or disables a specific API data source
 */

import { NextRequest, NextResponse } from 'next/server'
import { dataSourceConfigManager } from '../../../../../services/admin/DataSourceConfigManager'

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
    const isAdmin = await dataSourceConfigManager.validateAdminAccess(token)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Administrator access required' },
        { status: 403 }
      )
    }

    // Toggle the data source
    const result = await dataSourceConfigManager.toggleDataSource(dataSourceId)

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

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const isAdmin = await dataSourceConfigManager.validateAdminAccess(token)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Administrator access required' },
        { status: 403 }
      )
    }

    // Get data source enabled status
    const enabled = dataSourceConfigManager.isDataSourceEnabled(dataSourceId)

    return NextResponse.json({
      success: true,
      data: {
        dataSourceId,
        enabled
      }
    })

  } catch (error) {
    console.error('Error getting data source status:', error)
    return NextResponse.json(
      {
        error: 'Failed to get data source status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}