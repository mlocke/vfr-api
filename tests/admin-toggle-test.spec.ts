import { test, expect } from '@playwright/test';

test.describe('Admin Toggle Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001/admin');
    await page.waitForLoadState('networkidle');
  });

  test('should display toggle switches for MCP servers', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('MCP Server Admin');

    const serverCards = page.locator('[data-testid="server-card"]');
    await expect(serverCards).toHaveCount(6);

    const expectedServers = ['alphavantage', 'fmp', 'polygon', 'sec_edgar', 'yahoo', 'treasury'];

    for (const serverId of expectedServers) {
      const serverCard = page.locator(`[data-testid="server-card"][data-server-id="${serverId}"]`);
      await expect(serverCard).toBeVisible();

      const toggleButton = serverCard.locator('button[data-testid="toggle-button"]');
      await expect(toggleButton).toBeVisible();
    }
  });

  test('should successfully toggle server state and update UI', async ({ page }) => {
    const polygonCard = page.locator('[data-testid="server-card"][data-server-id="polygon"]');
    const toggleButton = polygonCard.locator('button[data-testid="toggle-button"]');

    const initialState = await toggleButton.getAttribute('aria-checked');
    console.log('Initial toggle state:', initialState);

    await page.route('/api/admin/server-config/toggle', async route => {
      const request = route.request();
      const postData = request.postDataJSON();

      console.log('Toggle API called with:', postData);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            serverId: postData.serverId,
            enabled: !JSON.parse(initialState || 'false'),
            message: `Server ${postData.serverId} toggled successfully`
          }
        })
      });
    });

    await toggleButton.click();

    await page.waitForTimeout(500);

    const newState = await toggleButton.getAttribute('aria-checked');
    console.log('New toggle state:', newState);

    expect(newState).not.toBe(initialState);
  });

  test('should handle toggle API errors gracefully', async ({ page }) => {
    const polygonCard = page.locator('[data-testid="server-card"][data-server-id="polygon"]');
    const toggleButton = polygonCard.locator('button[data-testid="toggle-button"]');

    const initialState = await toggleButton.getAttribute('aria-checked');

    await page.route('/api/admin/server-config/toggle', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Server error'
        })
      });
    });

    await toggleButton.click();

    await page.waitForTimeout(500);

    const finalState = await toggleButton.getAttribute('aria-checked');
    expect(finalState).toBe(initialState);
  });

  test('should update visual state correctly when toggled', async ({ page }) => {
    const polygonCard = page.locator('[data-testid="server-card"][data-server-id="polygon"]');
    const toggleButton = polygonCard.locator('button[data-testid="toggle-button"]');
    const statusText = polygonCard.locator('[data-testid="server-status"]');

    const initialStatus = await statusText.textContent();
    console.log('Initial status text:', initialStatus);

    const isCurrentlyEnabled = initialStatus?.includes('Online');

    await page.route('/api/admin/server-config/toggle', async route => {
      const request = route.request();
      const postData = request.postDataJSON();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            serverId: postData.serverId,
            enabled: !isCurrentlyEnabled,
            message: `Server ${postData.serverId} toggled successfully`
          }
        })
      });
    });

    await toggleButton.click();

    await page.waitForTimeout(1000);

    const newStatus = await statusText.textContent();
    console.log('New status text:', newStatus);

    if (isCurrentlyEnabled) {
      expect(newStatus).toContain('Offline');
    } else {
      expect(newStatus).toContain('Online');
    }
  });

  test('should check current API response structure', async ({ page }) => {
    let apiResponse: any = null;

    page.on('response', async response => {
      if (response.url().includes('/api/admin/server-config/toggle')) {
        try {
          apiResponse = await response.json();
          console.log('Actual API Response:', JSON.stringify(apiResponse, null, 2));
        } catch (e) {
          console.log('Failed to parse API response:', e);
        }
      }
    });

    const polygonCard = page.locator('[data-testid="server-card"][data-server-id="polygon"]');
    const toggleButton = polygonCard.locator('button[data-testid="toggle-button"]');

    await toggleButton.click();

    await page.waitForTimeout(1000);

    if (apiResponse) {
      console.log('API Response structure check:');
      console.log('Has success field:', 'success' in apiResponse);
      console.log('Has data field:', 'data' in apiResponse);
      console.log('Has enabled field:', 'enabled' in apiResponse);
      console.log('Has data.enabled field:', apiResponse.data && 'enabled' in apiResponse.data);
    }
  });
});