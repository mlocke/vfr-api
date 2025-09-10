const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureDropdownScreenshots() {
  // Create screenshots directory if it doesn't exist
  const screenshotsDir = path.join(__dirname, '..', 'docs', 'project', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to the application
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for the page to load completely
    await page.waitForTimeout(3000);
    
    // Wait for the sector dropdown container to be visible
    await page.waitForSelector('.sector-selection-container', { state: 'visible' });
    
    // Take the "before" screenshot
    console.log('Taking baseline screenshot...');
    const beforeScreenshot = path.join(screenshotsDir, 'dropdown-before-move.png');
    await page.screenshot({ 
      path: beforeScreenshot,
      fullPage: false 
    });
    console.log(`✅ Baseline screenshot saved: ${beforeScreenshot}`);

    // Click on the dropdown to open it (if it's a dropdown that needs to be opened)
    try {
      const dropdownTrigger = page.locator('[role="combobox"], select, .dropdown-trigger, [data-testid="sector-dropdown"]').first();
      if (await dropdownTrigger.isVisible()) {
        await dropdownTrigger.click();
        await page.waitForTimeout(1000); // Wait for dropdown to open
        
        // Take screenshot with dropdown open
        const beforeOpenScreenshot = path.join(screenshotsDir, 'dropdown-before-open.png');
        await page.screenshot({ 
          path: beforeOpenScreenshot,
          fullPage: false 
        });
        console.log(`✅ Baseline (open) screenshot saved: ${beforeOpenScreenshot}`);
      }
    } catch (error) {
      console.log('Note: Could not interact with dropdown, but container is visible');
    }

    // Now we'll modify the positioning using JavaScript
    console.log('Adjusting dropdown positioning...');
    await page.evaluate(() => {
      const container = document.querySelector('.sector-selection-container');
      if (container) {
        // Change positioning: up 15px (80px -> 65px), right 20px (0 -> 20px)
        container.style.top = '65px';
        container.style.left = '20px';
        container.style.right = '20px'; // Maintain right margin
        console.log('Positioning updated in DOM');
      } else {
        console.log('Container not found');
      }
    });

    // Wait a moment for the change to take effect
    await page.waitForTimeout(1000);

    // Take the "after" screenshot
    console.log('Taking after screenshot...');
    const afterScreenshot = path.join(screenshotsDir, 'dropdown-after-move.png');
    await page.screenshot({ 
      path: afterScreenshot,
      fullPage: false 
    });
    console.log(`✅ After screenshot saved: ${afterScreenshot}`);

    // Verify the positioning was applied
    const newPosition = await page.evaluate(() => {
      const container = document.querySelector('.sector-selection-container');
      if (container) {
        const style = window.getComputedStyle(container);
        return {
          top: style.top,
          left: style.left,
          right: style.right,
          position: style.position
        };
      }
      return null;
    });

    console.log('✅ Current positioning:', newPosition);

    // Take a final screenshot showing the positioning change
    const finalScreenshot = path.join(screenshotsDir, 'dropdown-final-position.png');
    await page.screenshot({ 
      path: finalScreenshot,
      fullPage: false 
    });
    console.log(`✅ Final screenshot saved: ${finalScreenshot}`);

    console.log('\n📊 POSITIONING SUMMARY:');
    console.log('Original Position: top: 80px, left: 0, right: 0');
    console.log('New Position: top: 65px, left: 20px, right: 20px');
    console.log('Change: Moved up 15px, moved right 20px\n');

  } catch (error) {
    console.error('Error during screenshot capture:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  captureDropdownScreenshots();
}

module.exports = { captureDropdownScreenshots };