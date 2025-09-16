/**
 * Admin API Endpoints - Server Testing
 * POST /api/admin/servers/[serverId]/test - Test individual server
 * Protected route requiring admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverConfigManager } from '../../../../../services/admin/ServerConfigManager'

export async function POST(
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
    const body = await request.json().catch(() => ({}))
    const testType = body.testType || 'health'

    // Validate test type
    const validTestTypes = ['connection', 'health', 'data_fetch', 'rate_limit']
    if (!validTestTypes.includes(testType)) {
      return NextResponse.json(
        { error: `Invalid test type. Must be one of: ${validTestTypes.join(', ')}` },
        { status: 400 }
      )
    }

    try {
      const testResult = await serverConfigManager.testServer(serverId, testType)

      return NextResponse.json({
        success: true,
        data: testResult
      })

    } catch (error) {
      return NextResponse.json(
        {
          error: 'Server test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error testing server:', error)
    return NextResponse.json(
      {
        error: 'Failed to execute server test',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}