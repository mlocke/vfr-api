/**
 * Admin API Endpoints - Data Source Management
 * GET /api/admin/data-sources - List all API data sources with status
 * Protected route requiring admin authentication
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'commercial' | 'government' | 'free' | null
    const category = searchParams.get('category') as 'stock_data' | 'economic_data' | 'web_intelligence' | 'filings' | null

    // Fetch data sources based on filters
    let dataSources
    if (type) {
      dataSources = await serverConfigManager.getServersByType(type)
    } else {
      dataSources = await serverConfigManager.getAllServers()
    }

    // Apply category filter if specified
    if (category) {
      dataSources = dataSources.filter(dataSource => dataSource.category === category)
    }

    return NextResponse.json({
      success: true,
      data: {
        dataSources,
        totalCount: dataSources.length,
        filters: { type, category }
      }
    })

  } catch (error) {
    console.error('Error fetching data sources:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch data source information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}