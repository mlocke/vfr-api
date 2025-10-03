const puppeteer = require("puppeteer");
const path = require("path");

async function takeScreenshot(filename, description) {
	let browser;
	try {
		console.log(`📸 Taking ${description}...`);

		browser = await puppeteer.launch({
			headless: "new",
			args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
		});

		const page = await browser.newPage();
		await page.setViewport({ width: 1920, height: 1080 });

		// Navigate to the homepage
		await page.goto("http://localhost:3000", {
			waitUntil: "networkidle2",
			timeout: 30000,
		});

		// Wait a bit for animations to settle
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Take screenshot
		const screenshotPath = path.join(__dirname, filename);
		await page.screenshot({
			path: screenshotPath,
			fullPage: false,
			type: "png",
		});

		console.log(`✅ Screenshot saved: ${screenshotPath}`);
		return screenshotPath;
	} catch (error) {
		console.error(`❌ Error taking ${description}:`, error.message);
		throw error;
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

async function main() {
	const args = process.argv.slice(2);
	const screenshotType = args[0] || "after";

	if (screenshotType === "before") {
		await takeScreenshot("homepage-before.png", "before screenshot");
	} else {
		await takeScreenshot("homepage-after.png", "after screenshot");
	}
}

main().catch(console.error);
