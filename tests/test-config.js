/**
 * Test Configuration
 * Centralized configuration for all test files
 */

module.exports = {
  // Server configuration
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  authToken: 'dev-admin-token',

  // Test timeouts
  defaultTimeout: 10000,
  serverStartTimeout: 30000,
  healthCheckTimeout: 5000,

  // Test data
  testSymbol: 'AAPL',
  testServer: 'polygon',

  // API endpoints
  endpoints: {
    health: '/api/health',
    serverConfig: '/api/admin/server-config',
    serverToggle: '/api/admin/server-config/toggle',
    stockSelect: '/api/stocks/select'
  },

  // Check if server is running
  async checkServerHealth(fetch) {
    try {
      const response = await fetch(`${this.baseUrl}${this.endpoints.health}`, {
        timeout: this.healthCheckTimeout
      })
      return response.ok
    } catch (error) {
      return false
    }
  },

  // Wait for server to be ready
  async waitForServer(fetch, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.checkServerHealth(fetch)) {
        return true
      }
      console.log(`⏳ Waiting for server... (attempt ${i + 1}/${maxAttempts})`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    return false
  },

  // Create request headers
  createHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json'
    }

    if (includeAuth) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    return headers
  }
}