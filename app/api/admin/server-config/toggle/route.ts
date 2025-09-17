/**
 * Legacy API endpoint for server toggle functionality
 * This endpoint exists to maintain compatibility with existing tests
 * that expect POST /api/admin/server-config/toggle with serverId in body
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../../services/admin/ServerConfigManager'

export async function POST(request: NextRequest) {
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required', success: false },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate admin access
    const isAdmin = await serverConfigManager.validateAdminAccess(token)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Administrator access required', success: false },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const body = await request.json()
    const { serverId } = body

    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required in request body', success: false },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Toggle the server
    const result = await serverConfigManager.toggleServer(serverId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, success: false },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return NextResponse.json({
      success: true,
      enabled: result.enabled,
      serverId,
      message: result.message
    }, { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('❌ Server config toggle API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to toggle server',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}