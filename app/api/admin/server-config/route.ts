/**
 * API endpoint for getting server configuration and status
 * Used by admin dashboard to display current server states
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../services/admin/ServerConfigManager'
import { authService } from '../../../services/auth/AuthService'

export async function GET(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required', success: false },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.substring(7)

    // Validate admin access
    const hasAdminAccess = await serverConfigManager.validateAdminAccess(token)
    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: 'Admin access required', success: false },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get all servers with current status
    const servers = await serverConfigManager.getAllServers()
    const enabledServers = serverConfigManager.getEnabledServers()

    return NextResponse.json({
      success: true,
      servers,
      enabledServers,
      timestamp: Date.now()
    }, { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Server config API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}