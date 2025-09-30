const puppeteer = require('puppeteer');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 }
  });

  const page = await browser.newPage();

  console.log('📱 Navigating to Stock Intelligence page...');
  await page.goto('http://localhost:3000/stock-intelligence', { waitUntil: 'networkidle2' });

  console.log('🔍 Searching for NVDA...');
  await page.waitForSelector('input[placeholder*="Search stocks"]', { timeout: 5000 });
  await page.type('input[placeholder*="Search stocks"]', 'NVDA');

  console.log('⏳ Waiting for search results...');
  await sleep(2000);

  // Click on NVDA result
  console.log('👆 Clicking on NVDA result...');
  await page.evaluate(() => {
    const nvdaElement = Array.from(document.querySelectorAll('*')).find(el =>
      el.textContent.includes('NVDA') && el.textContent.includes('NVIDIA')
    );
    if (nvdaElement) nvdaElement.click();
  });

  console.log('▶️ Clicking Run Deep Analysis button...');
  await sleep(1000);
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(btn =>
      btn.textContent.includes('Run Deep Analysis')
    );
    if (button) button.click();
  });

  console.log('⏱️ Waiting for analysis to complete (up to 60 seconds)...');
  await sleep(60000);

  // Take screenshot
  console.log('📸 Taking screenshot...');
  await page.screenshot({ path: '/tmp/nvda-puppeteer-result.png', fullPage: true });

  // Check for errors
  const errorElement = await page.$('text/Analysis Error');
  if (errorElement) {
    console.log('❌ ERROR DETECTED ON PAGE');
    const errorText = await page.evaluate(el => el.textContent, errorElement);
    console.log('Error message:', errorText);
  } else {
    console.log('✅ No errors detected - analysis completed successfully');
  }

  // Get the results
  const results = await page.evaluate(() => {
    const resultsDiv = document.querySelector('[class*="analysis"]') || document.body;
    return resultsDiv.innerText;
  });

  console.log('\n📊 Results Preview:');
  console.log(results.substring(0, 500));

  console.log('\n✅ Test complete! Screenshot saved to /tmp/nvda-puppeteer-result.png');
  console.log('Browser will close in 5 seconds...');
  await sleep(5000);

  await browser.close();
})();
