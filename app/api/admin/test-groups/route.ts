/**
 * Admin API Endpoints - Group Testing
 * POST /api/admin/test-groups - Test server groups
 * Protected route requiring admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../services/admin/ServerConfigManager'

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}))
    const groupType = body.groupType || 'all'

    // Validate group type
    const validGroupTypes = ['commercial', 'government', 'free', 'all']
    if (!validGroupTypes.includes(groupType)) {
      return NextResponse.json(
        { error: `Invalid group type. Must be one of: ${validGroupTypes.join(', ')}` },
        { status: 400 }
      )
    }

    try {
      const testResult = await serverConfigManager.testServerGroup(groupType)

      return NextResponse.json({
        success: true,
        data: testResult
      })

    } catch (error) {
      return NextResponse.json(
        {
          error: 'Group test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error testing server group:', error)
    return NextResponse.json(
      {
        error: 'Failed to execute group test',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}