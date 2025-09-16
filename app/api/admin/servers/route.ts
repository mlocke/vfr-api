/**
 * Admin API Endpoints - Server Management
 * GET /api/admin/servers - List all MCP servers with status
 * Protected route requiring admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../services/admin/ServerConfigManager'
import { authService } from '../../../services/auth/AuthService'

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

    // Fetch servers based on filters
    let servers
    if (type) {
      servers = await serverConfigManager.getServersByType(type)
    } else {
      servers = await serverConfigManager.getAllServers()
    }

    // Apply category filter if specified
    if (category) {
      servers = servers.filter(server => server.category === category)
    }

    return NextResponse.json({
      success: true,
      data: {
        servers,
        totalCount: servers.length,
        filters: { type, category }
      }
    })

  } catch (error) {
    console.error('Error fetching servers:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch server information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}