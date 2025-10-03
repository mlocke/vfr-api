#!/usr/bin/env node

/**
 * Debug and fix Treasury Service URL Construction
 */

const TREASURY_BASE_URL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";

const ENDPOINTS = {
	debtToPenny: "/v2/accounting/od/debt_to_penny",
	exchangeRates: "/v1/accounting/od/rates_of_exchange",
	operatingCash: "/v1/accounting/dts/operating_cash_balance",
};

async function debugTreasuryURLs() {
	console.log("🔧 Testing Treasury URL Construction Methods");

	for (const [name, endpoint] of Object.entries(ENDPOINTS)) {
		console.log(`\n📊 Testing: ${name}`);
		console.log(`Endpoint: ${endpoint}`);

		const params = {
			sort: "-record_date",
			"page[size]": 5,
		};

		// Method 1: Using new URL() constructor (what our service does)
		console.log("\n🔹 Method 1: new URL() constructor");
		try {
			const url1 = new URL(endpoint, TREASURY_BASE_URL);
			Object.entries(params).forEach(([key, value]) => {
				url1.searchParams.set(key, String(value));
			});
			console.log(`URL: ${url1.toString()}`);

			const response1 = await fetch(url1.toString(), {
				headers: { Accept: "application/json" },
			});
			console.log(`Status: ${response1.status}`);
		} catch (error) {
			console.log(`Error: ${error.message}`);
		}

		// Method 2: Simple string concatenation (what should work)
		console.log("\n🔹 Method 2: String concatenation");
		try {
			const url2 = `${TREASURY_BASE_URL}${endpoint}`;
			const searchParams = new URLSearchParams(params);
			const fullUrl2 = `${url2}?${searchParams.toString()}`;
			console.log(`URL: ${fullUrl2}`);

			const response2 = await fetch(fullUrl2, {
				headers: { Accept: "application/json" },
			});
			console.log(`Status: ${response2.status}`);

			if (response2.status === 200) {
				const data = await response2.json();
				console.log(`✅ SUCCESS: ${data.data?.length || 0} records`);
				break; // Stop after first success
			}
		} catch (error) {
			console.log(`Error: ${error.message}`);
		}

		await new Promise(resolve => setTimeout(resolve, 300));
	}

	console.log("\n📝 SOLUTION: The issue is URL construction!");
	console.log("Use string concatenation instead of new URL() constructor.");
}

debugTreasuryURLs().catch(console.error);
