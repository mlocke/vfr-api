const puppeteer = require('puppeteer');
const fs = require('fs');

async function takeScreenshot() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the page
    console.log('📸 Loading page...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take full page screenshot
    console.log('📸 Taking full page screenshot...');
    await page.screenshot({ 
      path: 'header-with-tagline-full.png',
      fullPage: true
    });
    
    // Take header-focused screenshot
    console.log('📸 Taking header-focused screenshot...');
    await page.screenshot({ 
      path: 'header-with-tagline-header.png',
      clip: { x: 0, y: 0, width: 1920, height: 600 }
    });
    
    console.log('✅ Screenshots saved successfully!');
    
  } catch (error) {
    console.error('❌ Error taking screenshot:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshot();