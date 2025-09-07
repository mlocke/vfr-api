const { chromium } = require("playwright");

async function takeScreenshot() {
	const browser = await chromium.launch();
	const page = await browser.newPage();

	// Set viewport size
	await page.setViewportSize({ width: 1920, height: 1080 });

	// Navigate to iteration 1
	await page.goto("file://" + __dirname + "/iteration1.html");

	// Wait for animations to complete
	await page.waitForTimeout(3000);

	// Take full page screenshot
	await page.screenshot({
		path: "iteration1-design.png",
		fullPage: true,
	});

	await browser.close();
	console.log("Screenshot saved as current-design.png");
}

takeScreenshot().catch(console.error);
