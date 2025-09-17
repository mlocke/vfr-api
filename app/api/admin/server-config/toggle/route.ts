/**
 * API endpoint for toggling server enabled/disabled state
 * Used by admin dashboard to control server availability
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../../services/admin/ServerConfigManager'
import { authService } from '../../../../services/auth/AuthService'

export async function POST(request: NextRequest) {
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

    // Parse request body with error handling
    let requestBody
    try {
      requestBody = await request.json()
    } catch (parseError) {
      console.warn('❌ Invalid JSON in request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body', success: false },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { serverId } = requestBody
    if (!serverId || typeof serverId !== 'string') {
      return NextResponse.json(
        { error: 'Server ID is required', success: false },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Toggle the server with error handling
    let result
    try {
      result = await serverConfigManager.toggleServer(serverId)
    } catch (toggleError) {
      console.warn('❌ Server toggle failed:', toggleError)
      return NextResponse.json(
        { error: 'Server configuration service unavailable', success: false },
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, success: false },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return NextResponse.json({
      success: true,
      enabled: result.enabled,
      message: result.message,
      serverId
    }, { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('❌ Server toggle API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        success: false,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}