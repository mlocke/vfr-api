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

    // Validate admin access with error handling
    let hasAdminAccess = false
    try {
      hasAdminAccess = await serverConfigManager.validateAdminAccess(token)
    } catch (authError) {
      console.warn('❌ Admin access validation failed:', authError)
      return NextResponse.json(
        { error: 'Authentication service unavailable', success: false },
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: 'Admin access required', success: false },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get all servers with current status
    let servers = []
    let enabledServers = []
    try {
      servers = await serverConfigManager.getAllServers()
      enabledServers = serverConfigManager.getEnabledServers()
    } catch (serverError) {
      console.warn('❌ Server data retrieval failed:', serverError)
      return NextResponse.json(
        { error: 'Server configuration service unavailable', success: false },
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return NextResponse.json({
      success: true,
      servers,
      enabledServers,
      timestamp: Date.now()
    }, { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('❌ Server config API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        success: false,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}