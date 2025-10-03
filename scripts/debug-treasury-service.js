#!/usr/bin/env node

/**
 * Debug Treasury Service URL Construction
 */

const TREASURY_BASE_URL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";

const ENDPOINTS = {
	debtToPenny: "/v2/accounting/od/debt_to_penny",
	exchangeRates: "/v1/accounting/od/rates_of_exchange",
	operatingCash: "/v1/accounting/dts/operating_cash_balance",
	monthlyOverview: "/v1/accounting/mts/mts_table_1",
};

async function debugTreasuryService() {
	console.log("🔍 Debugging Treasury Service URL Construction");
	console.log(`Base URL: ${TREASURY_BASE_URL}`);

	for (const [name, endpoint] of Object.entries(ENDPOINTS)) {
		console.log(`\n📊 Testing: ${name}`);
		console.log(`Endpoint: ${endpoint}`);

		// Simulate the URL construction from TreasuryFiscalService
		const params = {
			sort: "-record_date",
			"page[size]": 5,
		};

		const url = new URL(endpoint, TREASURY_BASE_URL);

		// Add query parameters
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				url.searchParams.set(key, String(value));
			}
		});

		console.log(`Full URL: ${url.toString()}`);

		try {
			const response = await fetch(url.toString(), {
				method: "GET",
				headers: {
					Accept: "application/json",
					"User-Agent": "Treasury-Debug-Script",
				},
			});

			console.log(`Status: ${response.status} ${response.statusText}`);

			if (response.status === 200) {
				const data = await response.json();
				console.log(`✅ Success: ${data.data?.length || 0} records`);
			} else {
				const errorText = await response.text();
				console.log(`❌ Error: ${errorText.slice(0, 100)}...`);
			}
		} catch (error) {
			console.log(`❌ Network Error: ${error.message}`);
		}

		// Rate limiting
		await new Promise(resolve => setTimeout(resolve, 300));
	}
}

debugTreasuryService().catch(console.error);
