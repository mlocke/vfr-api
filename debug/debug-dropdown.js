const { chromium } = require("playwright");

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();

	// Navigate to the page
	await page.goto("http://localhost:3000");

	// Wait for the page to load
	await page.waitForTimeout(3000);

	// Check if the dropdown exists in DOM
	const dropdownExists = await page.locator(".sector-selection-container").count();
	console.log(`Dropdown container found: ${dropdownExists > 0 ? "YES" : "NO"}`);

	const selectExists = await page.locator("select").count();
	console.log(`Select element found: ${selectExists > 0 ? "YES" : "NO"}`);

	// Get the computed styles and position
	const containerInfo = await page.evaluate(() => {
		const container = document.querySelector(".sector-selection-container");
		if (container) {
			const styles = window.getComputedStyle(container);
			const rect = container.getBoundingClientRect();
			return {
				display: styles.display,
				visibility: styles.visibility,
				top: styles.top,
				left: styles.left,
				right: styles.right,
				zIndex: styles.zIndex,
				position: styles.position,
				rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
			};
		}
		return null;
	});

	console.log("Container info:", containerInfo);

	// Take full page screenshot
	await page.screenshot({ path: "debug-dropdown-full.png", fullPage: true });
	console.log("✅ Full page screenshot: debug-dropdown-full.png");

	// Take viewport screenshot
	await page.screenshot({ path: "debug-dropdown-viewport.png" });
	console.log("✅ Viewport screenshot: debug-dropdown-viewport.png");

	await browser.close();
})().catch(console.error);
