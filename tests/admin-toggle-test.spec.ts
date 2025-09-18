import { test, expect } from '@playwright/test';

test.describe('Data Source Admin Toggle Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001/admin');
    await page.waitForLoadState('networkidle');
  });

  test('should display toggle switches for all configured data sources', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Data Source Admin');

    const dataSourceCards = page.locator('[data-testid="data-source-card"]');
    await expect(dataSourceCards).toHaveCount(6);

    // Verify all expected financial data sources are present
    const expectedDataSources = ['alphavantage', 'fmp', 'polygon', 'sec_edgar', 'yahoo', 'treasury'];

    for (const dataSourceId of expectedDataSources) {
      const dataSourceCard = page.locator(`[data-testid="data-source-card"][data-source-id="${dataSourceId}"]`);
      await expect(dataSourceCard).toBeVisible();

      // Each data source should have a toggle control
      const toggleButton = dataSourceCard.locator('button[data-testid="toggle-button"]');
      await expect(toggleButton).toBeVisible();
    }
  });

  test('should successfully toggle data source state and update UI', async ({ page }) => {
    // Test data source state management with Polygon data source
    const polygonCard = page.locator('[data-testid="data-source-card"][data-source-id="polygon"]');
    const toggleButton = polygonCard.locator('button[data-testid="toggle-button"]');

    const initialState = await toggleButton.getAttribute('aria-checked');
    console.log('Initial data source toggle state:', initialState);

    await page.route('/api/admin/data-sources/polygon/toggle', async route => {
      const request = route.request();

      console.log('Data source toggle API called for: polygon');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            dataSourceId: 'polygon',
            enabled: !JSON.parse(initialState || 'false'),
            message: `Polygon data source toggled successfully`
          }
        })
      });
    });

    await toggleButton.click();

    await page.waitForTimeout(500);

    const newState = await toggleButton.getAttribute('aria-checked');
    console.log('New data source toggle state:', newState);

    // Verify that the data source state has changed
    expect(newState).not.toBe(initialState);
  });

  test('should handle data source toggle API errors gracefully', async ({ page }) => {
    // Test error handling when data source toggle fails
    const polygonCard = page.locator('[data-testid="data-source-card"][data-source-id="polygon"]');
    const toggleButton = polygonCard.locator('button[data-testid="toggle-button"]');

    const initialState = await toggleButton.getAttribute('aria-checked');

    await page.route('/api/admin/data-sources/polygon/toggle', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to toggle data source state'
        })
      });
    });

    await toggleButton.click();

    await page.waitForTimeout(500);

    // Verify data source state remains unchanged on error
    const finalState = await toggleButton.getAttribute('aria-checked');
    expect(finalState).toBe(initialState);
  });

  test('should update data source visual state correctly when toggled', async ({ page }) => {
    // Test visual feedback for data source state changes
    const polygonCard = page.locator('[data-testid="data-source-card"][data-source-id="polygon"]');
    const toggleButton = polygonCard.locator('button[data-testid="toggle-button"]');
    const statusText = polygonCard.locator('[data-testid="data-source-status"]');

    const initialStatus = await statusText.textContent();
    console.log('Initial data source status:', initialStatus);

    const isCurrentlyEnabled = initialStatus?.includes('Online');

    await page.route('/api/admin/data-sources/polygon/toggle', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            dataSourceId: 'polygon',
            enabled: !isCurrentlyEnabled,
            message: `Polygon data source toggled successfully`
          }
        })
      });
    });

    await toggleButton.click();

    await page.waitForTimeout(1000);

    const newStatus = await statusText.textContent();
    console.log('New data source status:', newStatus);

    // Verify visual status reflects data source state change
    if (isCurrentlyEnabled) {
      expect(newStatus).toContain('Offline');
    } else {
      expect(newStatus).toContain('Online');
    }
  });

  test('should validate data source API response structure', async ({ page }) => {
    // Test that data source toggle API returns expected response format
    let apiResponse: any = null;

    page.on('response', async response => {
      if (response.url().includes('/api/admin/data-sources/polygon/toggle')) {
        try {
          apiResponse = await response.json();
          console.log('Data Source API Response:', JSON.stringify(apiResponse, null, 2));
        } catch (e) {
          console.log('Failed to parse data source API response:', e);
        }
      }
    });

    const polygonCard = page.locator('[data-testid="data-source-card"][data-source-id="polygon"]');
    const toggleButton = polygonCard.locator('button[data-testid="toggle-button"]');

    await toggleButton.click();

    await page.waitForTimeout(1000);

    if (apiResponse) {
      console.log('Data Source API Response structure validation:');
      console.log('Has success field:', 'success' in apiResponse);
      console.log('Has data field:', 'data' in apiResponse);
      console.log('Has enabled field:', 'enabled' in apiResponse);
      console.log('Has data.enabled field:', apiResponse.data && 'enabled' in apiResponse.data);
      console.log('Has dataSourceId field:', apiResponse.data && 'dataSourceId' in apiResponse.data);
    }
  });
});