const fs = require("fs");
const path = require("path");

async function takeScreenshot() {
	try {
		const { chromium } = require("playwright");

		const browser = await chromium.launch();
		const page = await browser.newPage({
			viewport: { width: 1400, height: 900 },
		});

		const filePath = path.resolve(__dirname, "economic-dashboard.html");
		const fileUrl = `file://${filePath}`;

		console.log(`Loading: ${fileUrl}`);

		await page.goto(fileUrl);
		await page.waitForTimeout(3000); // Wait for animations and chart to load

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const screenshotPath = path.resolve(
			__dirname,
			"docs/project/screenshots",
			`fred-dashboard-${timestamp}.png`
		);

		await page.screenshot({
			path: screenshotPath,
			fullPage: true,
		});

		console.log(`Screenshot saved: ${screenshotPath}`);

		await browser.close();
	} catch (error) {
		console.error("Error taking screenshot:", error);
		process.exit(1);
	}
}

takeScreenshot();
