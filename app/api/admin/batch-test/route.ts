/**
 * Admin API Endpoints - Batch Testing
 * POST /api/admin/batch-test - Test multiple selected servers
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
    const { serverIds, testType = 'health' } = body

    // Validate input
    if (!Array.isArray(serverIds) || serverIds.length === 0) {
      return NextResponse.json(
        { error: 'Server IDs array is required and cannot be empty' },
        { status: 400 }
      )
    }

    // Validate test type
    const validTestTypes = ['connection', 'health', 'data_fetch', 'rate_limit']
    if (!validTestTypes.includes(testType)) {
      return NextResponse.json(
        { error: `Invalid test type. Must be one of: ${validTestTypes.join(', ')}` },
        { status: 400 }
      )
    }

    try {
      // Execute tests in parallel
      const testPromises = serverIds.map(async (serverId: string) => {
        try {
          const result = await serverConfigManager.testServer(serverId, testType)
          return result
        } catch (error) {
          return {
            serverId,
            success: false,
            responseTime: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
            testType
          }
        }
      })

      const results = await Promise.all(testPromises)

      // Calculate summary statistics
      const successfulTests = results.filter(r => r.success)
      const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      const successRate = successfulTests.length / results.length

      return NextResponse.json({
        success: true,
        data: {
          results,
          summary: {
            totalTests: results.length,
            successfulTests: successfulTests.length,
            failedTests: results.length - successfulTests.length,
            successRate,
            averageResponseTime,
            timestamp: Date.now()
          }
        }
      })

    } catch (error) {
      return NextResponse.json(
        {
          error: 'Batch test execution failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error executing batch test:', error)
    return NextResponse.json(
      {
        error: 'Failed to execute batch test',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}