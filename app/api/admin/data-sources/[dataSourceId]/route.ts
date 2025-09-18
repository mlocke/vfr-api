/**
 * Admin API - Individual Data Source Management
 * GET /api/admin/data-sources/[dataSourceId] - Get detailed data source configuration
 * Protected route requiring admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { dataSourceConfigManager } from '../../../../services/admin/DataSourceConfigManager'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataSourceId: string }> }
) {
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
    const isAdmin = await dataSourceConfigManager.validateAdminAccess(token)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Administrator access required' },
        { status: 403 }
      )
    }

    const { dataSourceId } = await params

    try {
      const dataSourceConfig = dataSourceConfigManager.getDataSourceConfiguration(dataSourceId)

      return NextResponse.json({
        success: true,
        data: dataSourceConfig
      })

    } catch (error) {
      return NextResponse.json(
        {
          error: 'Data source not found',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 404 }
      )
    }

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