const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function takeScreenshots() {
	const browser = await chromium.launch({ headless: false });
	const page = await browser.newPage();

	// Set viewport size
	await page.setViewportSize({ width: 1400, height: 900 });

	try {
		// Navigate to the application
		console.log("Navigating to localhost:3000...");
		await page.goto("http://localhost:3000");

		// Wait for the page to load completely
		await page.waitForTimeout(3000);

		// Take screenshot of the closed state (default view)
		console.log("Taking screenshot of market selector - closed state...");
		await page.screenshot({
			path: "docs/project/screenshots/cyberpunk-market-selector-closed.png",
			fullPage: false,
		});

		// Find and click the market selector button to open dropdown
		console.log("Opening market selector dropdown...");

		// Try different selectors to find the dropdown trigger
		const selectors = [
			"[data-headlessui-state]",
			'button[role="combobox"]',
			'button[aria-expanded="false"]',
			".market-selector button",
			'button:has-text("Technology")',
			'button:has-text("Select")',
		];

		let clicked = false;
		for (const selector of selectors) {
			try {
				const element = await page.locator(selector).first();
				if (await element.isVisible()) {
					console.log(`Found dropdown trigger with selector: ${selector}`);
					await element.click();
					clicked = true;
					break;
				}
			} catch (e) {
				console.log(`Selector ${selector} not found, trying next...`);
			}
		}

		if (!clicked) {
			// Fallback: try to find any button that might be the selector
			console.log("Trying to find any button that could be the market selector...");
			const buttons = await page.locator("button").all();
			console.log(`Found ${buttons.length} buttons on the page`);

			for (let i = 0; i < buttons.length; i++) {
				const button = buttons[i];
				const text = await button.textContent();
				console.log(`Button ${i}: "${text}"`);

				if (
					text &&
					(text.includes("Technology") ||
						text.includes("Select") ||
						text.includes("Market"))
				) {
					console.log(`Clicking button with text: "${text}"`);
					await button.click();
					clicked = true;
					break;
				}
			}
		}

		if (clicked) {
			// Wait for dropdown animation to complete
			await page.waitForTimeout(1000);

			// Take screenshot of the open state
			console.log("Taking screenshot of market selector - open state...");
			await page.screenshot({
				path: "docs/project/screenshots/cyberpunk-market-selector-open.png",
				fullPage: false,
			});

			// Take a focused screenshot of just the dropdown area
			console.log("Taking focused screenshot of dropdown...");

			// Try to find the dropdown container
			const dropdownSelectors = [
				'[role="listbox"]',
				".absolute.z-50",
				'[data-headlessui-state="open"]',
				".dropdown-container",
				".market-selector-dropdown",
			];

			for (const selector of dropdownSelectors) {
				try {
					const dropdown = await page.locator(selector).first();
					if (await dropdown.isVisible()) {
						console.log(`Found dropdown with selector: ${selector}`);
						await dropdown.screenshot({
							path: "docs/project/screenshots/cyberpunk-market-selector-dropdown-detail.png",
						});
						break;
					}
				} catch (e) {
					console.log(`Dropdown selector ${selector} not found`);
				}
			}

			// Test search functionality if there's a search input
			try {
				const searchInput = await page.locator('input[type="text"]').first();
				if (await searchInput.isVisible()) {
					console.log("Testing search functionality...");
					await searchInput.fill("Tech");
					await page.waitForTimeout(500);

					await page.screenshot({
						path: "docs/project/screenshots/cyberpunk-market-selector-search.png",
						fullPage: false,
					});
				}
			} catch (e) {
				console.log("No search input found");
			}
		} else {
			console.log("Could not find or click the market selector dropdown trigger");
		}

		// Take a final full-page screenshot for context
		console.log("Taking full-page context screenshot...");
		await page.screenshot({
			path: "docs/project/screenshots/cyberpunk-market-selector-full-context.png",
			fullPage: true,
		});
	} catch (error) {
		console.error("Error taking screenshots:", error);
	} finally {
		await browser.close();
		console.log("Screenshots completed!");
	}
}

takeScreenshots();
