/**
 * Playwright test for Polygon server toggle functionality
 * Tests the complete user workflow: admin toggle -> verify blocking -> re-enable
 */

import { test, expect } from '@playwright/test'

test.describe('Polygon Server Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin page
    await page.goto('/admin')

    // Mock authentication if needed
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'mock-admin-token')
    })

    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('should properly disable and enable Polygon server', async ({ page }) => {
    // Test 1: Find Polygon server toggle
    await test.step('Locate Polygon server toggle', async () => {
      const polygonSection = page.locator('text=Polygon.io MCP')
      await expect(polygonSection).toBeVisible()

      // Find the toggle switch for Polygon
      const polygonToggle = page.locator('[role="switch"][aria-label*="Polygon"]')
      await expect(polygonToggle).toBeVisible()
    })

    // Test 2: Disable Polygon server
    await test.step('Disable Polygon server', async () => {
      const polygonToggle = page.locator('[role="switch"][aria-label*="Polygon"]')

      // Check if currently enabled and click to disable
      const isEnabled = await polygonToggle.getAttribute('aria-checked')
      if (isEnabled === 'true') {
        await polygonToggle.click()

        // Wait for toggle to complete
        await page.waitForTimeout(500)

        // Verify toggle state changed
        await expect(polygonToggle).toHaveAttribute('aria-checked', 'false')

        // Verify status text shows "Offline"
        const statusText = page.locator('text=Offline').first()
        await expect(statusText).toBeVisible()

        console.log('✅ Polygon server disabled successfully')
      }
    })

    // Test 3: Navigate to stock intelligence and try to use Polygon
    await test.step('Test stock selection with Polygon disabled', async () => {
      // Navigate to stock intelligence page
      await page.goto('/stock-intelligence')
      await page.waitForLoadState('networkidle')

      // Look for data source configuration
      const dataSourceSection = page.locator('text=Data Sources').first()
      if (await dataSourceSection.isVisible()) {
        // If Polygon is in the list, it should show as disabled/offline
        const polygonSource = page.locator('text=Polygon').first()
        if (await polygonSource.isVisible()) {
          const polygonStatus = polygonSource.locator('..').locator('text=offline')
          await expect(polygonStatus).toBeVisible()
          console.log('✅ Polygon shows as offline in stock intelligence')
        }
      }

      // Try to perform a stock analysis
      const symbolInput = page.locator('input[placeholder*="symbol"], input[placeholder*="ticker"]').first()
      if (await symbolInput.isVisible()) {
        await symbolInput.fill('AAPL')

        // Look for analyze/search button
        const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("Search"), button:has-text("Go")').first()
        if (await analyzeButton.isVisible()) {
          await analyzeButton.click()

          // Wait for response and check if Polygon was blocked
          await page.waitForTimeout(2000)

          // Check for any error messages about disabled servers
          const errorText = page.locator('text=disabled').first()
          const successWithoutPolygon = page.locator('text=success').first()

          // Either should show error about disabled server OR succeed with other sources
          const hasExpectedBehavior = await errorText.isVisible() || await successWithoutPolygon.isVisible()
          expect(hasExpectedBehavior).toBeTruthy()

          console.log('✅ Stock analysis behaved correctly with Polygon disabled')
        }
      }
    })

    // Test 4: Return to admin and re-enable Polygon
    await test.step('Re-enable Polygon server', async () => {
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      const polygonToggle = page.locator('[role="switch"][aria-label*="Polygon"]')

      // Click to enable
      await polygonToggle.click()

      // Wait for toggle to complete
      await page.waitForTimeout(500)

      // Verify toggle state changed
      await expect(polygonToggle).toHaveAttribute('aria-checked', 'true')

      // Verify status text shows "Online"
      const statusText = page.locator('text=Online').first()
      await expect(statusText).toBeVisible()

      console.log('✅ Polygon server re-enabled successfully')
    })

    // Test 5: Verify Polygon works when enabled
    await test.step('Test stock selection with Polygon enabled', async () => {
      await page.goto('/stock-intelligence')
      await page.waitForLoadState('networkidle')

      // Try the same analysis as before
      const symbolInput = page.locator('input[placeholder*="symbol"], input[placeholder*="ticker"]').first()
      if (await symbolInput.isVisible()) {
        await symbolInput.fill('AAPL')

        const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("Search"), button:has-text("Go")').first()
        if (await analyzeButton.isVisible()) {
          await analyzeButton.click()

          // Wait for response
          await page.waitForTimeout(2000)

          // Should now succeed (no disabled errors)
          const errorText = page.locator('text=disabled').first()
          const hasDisabledError = await errorText.isVisible()
          expect(hasDisabledError).toBeFalsy()

          console.log('✅ Stock analysis works correctly with Polygon enabled')
        }
      }
    })
  })

  test('should persist server toggle state across page reloads', async ({ page }) => {
    await test.step('Disable Polygon and reload page', async () => {
      // Disable Polygon
      const polygonToggle = page.locator('[role="switch"][aria-label*="Polygon"]')
      await polygonToggle.click()
      await page.waitForTimeout(500)

      // Reload page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Check that Polygon is still disabled
      await expect(polygonToggle).toHaveAttribute('aria-checked', 'false')

      console.log('✅ Polygon toggle state persisted across reload')
    })

    await test.step('Re-enable Polygon', async () => {
      const polygonToggle = page.locator('[role="switch"][aria-label*="Polygon"]')
      await polygonToggle.click()
      await page.waitForTimeout(500)
      await expect(polygonToggle).toHaveAttribute('aria-checked', 'true')
    })
  })

  test('should show correct server status in admin dashboard', async ({ page }) => {
    await test.step('Verify server status indicators', async () => {
      // Check that Polygon server info is displayed
      const polygonName = page.locator('text=Polygon.io MCP')
      await expect(polygonName).toBeVisible()

      // Check for status indicators
      const statusIndicator = page.locator('text=Online, text=Offline').first()
      await expect(statusIndicator).toBeVisible()

      // Check for rate limit info
      const rateLimitInfo = page.locator('text=1000').first() // Polygon rate limit
      await expect(rateLimitInfo).toBeVisible()

      console.log('✅ Server status information displayed correctly')
    })
  })
})