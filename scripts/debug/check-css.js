const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const path = require("path");

async function checkCSS() {
	const browser = await puppeteer.launch({
		headless: false,
		defaultViewport: { width: 1920, height: 1080 },
	});

	const page = await browser.newPage();

	try {
		console.log("📸 Taking screenshot to check CSS...");

		// Navigate to homepage
		await page.goto("http://localhost:3001", {
			waitUntil: "networkidle2",
			timeout: 30000,
		});

		// Wait a moment for any dynamic styles
		await page.waitForTimeout(2000);

		// Take screenshot
		const screenshotDir = path.join(__dirname, "docs", "screenshots");
		await fs.mkdir(screenshotDir, { recursive: true });

		await page.screenshot({
			path: path.join(screenshotDir, "css-check-homepage.png"),
			fullPage: true,
		});

		console.log("✅ Homepage screenshot saved");

		// Check Market Intelligence page
		await page.goto("http://localhost:3001/stock-intelligence", {
			waitUntil: "networkidle2",
			timeout: 30000,
		});

		await page.waitForTimeout(2000);

		await page.screenshot({
			path: path.join(screenshotDir, "css-check-market-intelligence.png"),
			fullPage: true,
		});

		console.log("✅ Market Intelligence screenshot saved");

		// Check if styles are loading by inspecting computed styles
		const hasBackground = await page.evaluate(() => {
			const body = document.body;
			const computedStyle = window.getComputedStyle(body);
			return computedStyle.background || computedStyle.backgroundColor;
		});

		const hasLogos = await page.evaluate(() => {
			const logos = document.querySelectorAll('img[src*="veritak_logo"]');
			return logos.length > 0;
		});

		const hasFonts = await page.evaluate(() => {
			const body = document.body;
			const computedStyle = window.getComputedStyle(body);
			return computedStyle.fontFamily.includes("Inter");
		});

		console.log("\n🔍 CSS Status Check:");
		console.log(`Background styles: ${hasBackground ? "✅" : "❌"}`);
		console.log(`Logo images: ${hasLogos ? "✅" : "❌"}`);
		console.log(`Custom fonts (Inter): ${hasFonts ? "✅" : "❌"}`);

		// Check for CSS errors in console
		const logs = await page.evaluate(() => {
			return window.performance
				.getEntriesByType("resource")
				.filter(entry => entry.name.includes(".css"))
				.map(entry => ({
					url: entry.name,
					status: entry.responseStatus || "loaded",
				}));
		});

		console.log("\n📄 CSS Files Status:");
		logs.forEach(log => {
			console.log(`${log.status === "loaded" ? "✅" : "❌"} ${log.url}`);
		});
	} catch (error) {
		console.error("❌ Error checking CSS:", error.message);
	} finally {
		await browser.close();
	}
}

checkCSS();
