/**
 * Admin API Endpoints - Individual Server Management
 * GET /api/admin/servers/[serverId] - Get detailed server configuration
 * Protected route requiring admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../../services/admin/ServerConfigManager'

export async function GET(
  request: NextRequest,
  { params }: { params: { serverId: string } }
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
    const isAdmin = await serverConfigManager.validateAdminAccess(token)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Administrator access required' },
        { status: 403 }
      )
    }

    const { serverId } = params

    try {
      const serverConfig = serverConfigManager.getServerConfiguration(serverId)

      return NextResponse.json({
        success: true,
        data: serverConfig
      })

    } catch (error) {
      return NextResponse.json(
        {
          error: 'Server not found',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('Error fetching server configuration:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch server configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}