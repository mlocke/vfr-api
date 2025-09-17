/**
 * Admin API Endpoints - Server Toggle Operations
 * PUT /api/admin/servers/[serverId]/toggle - Toggle server enabled/disabled
 * Protected route requiring admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../../../services/admin/ServerConfigManager'
import { authService } from '../../../../../services/auth/AuthService'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
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

    const { serverId } = await params

    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      )
    }

    // Toggle the server
    const result = await serverConfigManager.toggleServer(serverId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        serverId,
        enabled: result.enabled,
        message: result.message
      }
    })

  } catch (error) {
    console.error('Error toggling server:', error)
    return NextResponse.json(
      {
        error: 'Failed to toggle server',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
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

    const { serverId } = await params

    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      )
    }

    // Get server enabled status
    const enabled = serverConfigManager.isServerEnabled(serverId)

    return NextResponse.json({
      success: true,
      data: {
        serverId,
        enabled
      }
    })

  } catch (error) {
    console.error('Error getting server status:', error)
    return NextResponse.json(
      {
        error: 'Failed to get server status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}