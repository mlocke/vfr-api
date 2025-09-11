const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  // Click the Explore Platform button to get to the stock picker interface
  console.log('Clicking Explore Platform button...');
  await page.click('text=Explore Platform');
  await page.waitForTimeout(2000);
  
  // Take initial baseline screenshot
  console.log('Taking baseline screenshot...');
  await page.screenshot({ path: 'docs/project/screenshots/screenshot-baseline-initial.png', fullPage: true });
  
  // Select a sector from the dropdown to show the industry list
  console.log('Selecting Healthcare sector from dropdown...');
  await page.selectOption('select', 'healthcare');
  await page.waitForTimeout(1000);
  
  // Take baseline screenshot with industry list visible
  console.log('Taking baseline screenshot with industry list visible...');
  await page.screenshot({ path: 'docs/project/screenshots/screenshot-baseline-with-industry.png', fullPage: true });
  
  // Take a zoomed-in screenshot of just the dropdown area
  const dropdownElement = await page.locator('.sector-dropdown');
  await dropdownElement.screenshot({ path: 'docs/project/screenshots/screenshot-baseline-dropdown-zoom.png' });
  
  // Apply CSS adjustments via JavaScript
  console.log('Applying CSS adjustments...');
  await page.evaluate(() => {
    // Find the sector description element (it's the flex container with the icon and text)
    const sectorDesc = document.querySelector('.text-xs.text-gray-400.flex.items-center');
    if (sectorDesc) {
      // Move text right from icon (find the second span which contains the description text)
      const textSpan = sectorDesc.querySelectorAll('span')[1]; // Second span is the description
      if (textSpan) {
        textSpan.style.marginLeft = '5px';
      }
      
      // Move entire element up 5px and left 5px
      sectorDesc.style.marginTop = '-5px';
      sectorDesc.style.marginLeft = '-5px';
      sectorDesc.style.position = 'relative';
      
      console.log('CSS adjustments applied successfully');
    } else {
      console.log('Could not find sector description element');
    }
  });
  
  await page.waitForTimeout(1000);
  
  // Take after screenshot
  console.log('Taking screenshot after adjustments...');
  await page.screenshot({ path: 'docs/project/screenshots/screenshot-after-adjustments.png', fullPage: true });
  
  // Take a zoomed-in screenshot of the adjusted dropdown
  const adjustedDropdown = await page.locator('.sector-dropdown');
  await adjustedDropdown.screenshot({ path: 'docs/project/screenshots/screenshot-after-dropdown-zoom.png' });
  
  console.log('Screenshots saved to docs/project/screenshots/:');
  console.log('  - screenshot-baseline-initial.png');
  console.log('  - screenshot-baseline-with-industry.png');
  console.log('  - screenshot-baseline-dropdown-zoom.png');
  console.log('  - screenshot-after-adjustments.png');
  console.log('  - screenshot-after-dropdown-zoom.png');
  
  // Keep browser open for 5 seconds to see the changes
  await page.waitForTimeout(5000);
  
  await browser.close();
})();