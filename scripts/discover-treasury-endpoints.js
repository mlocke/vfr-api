#!/usr/bin/env node

/**
 * Treasury API Endpoint Discovery Script
 *
 * Discovers working Treasury Fiscal Data API endpoints
 */

async function discoverTreasuryEndpoints() {
	console.log("🔍 Discovering Treasury API Endpoints");

	const baseUrl = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";

	// Known working endpoints from API documentation
	const candidateEndpoints = [
		// Debt endpoints
		"/v2/accounting/od/debt_to_penny",
		"/v1/accounting/od/debt_to_penny", // Alternative version

		// Exchange rates
		"/v1/accounting/od/rates_of_exchange",

		// Operating cash
		"/v1/accounting/dts/operating_cash_balance",

		// Daily Treasury Statement alternatives
		"/v1/accounting/dts/dts_table_1",
		"/v1/accounting/dts/dts_table_2",
		"/v1/accounting/dts/dts_table_3",
		"/v1/accounting/dts/operating_cash_balance",

		// Monthly Treasury Statement
		"/v1/accounting/mts/mts_table_1",
		"/v1/accounting/mts/mts_table_2",
		"/v1/accounting/mts/mts_table_3",
		"/v1/accounting/mts/mts_table_4",
		"/v1/accounting/mts/mts_table_5",

		// Other possible endpoints
		"/v1/accounting/od/avg_interest_rates",
		"/v1/accounting/od/gift_contributions",
		"/v1/accounting/od/savings_bonds_data",
		"/v2/accounting/od/securities_sales",
		"/v1/accounting/od/redemption_tables",
	];

	const workingEndpoints = [];

	for (const endpoint of candidateEndpoints) {
		console.log(`\n🔍 Testing: ${endpoint}`);

		try {
			const response = await fetch(`${baseUrl}${endpoint}?page[size]=1`, {
				headers: {
					Accept: "application/json",
					"User-Agent": "Treasury-Endpoint-Discovery",
				},
			});

			console.log(`Status: ${response.status}`);

			if (response.status === 200) {
				const data = await response.json();

				workingEndpoints.push({
					endpoint,
					recordCount: data.data?.length || 0,
					totalRecords: data.meta?.total_count,
					sampleFields: data.data?.[0] ? Object.keys(data.data[0]).slice(0, 8) : [],
				});

				console.log(`✅ WORKING - ${data.data?.length || 0} records`);
				if (data.data?.[0]) {
					console.log(`   Fields: ${Object.keys(data.data[0]).slice(0, 8).join(", ")}`);
				}
			} else if (response.status === 404) {
				console.log("❌ Not found");
			} else {
				console.log(`⚠️ Status ${response.status}: ${response.statusText}`);
			}
		} catch (error) {
			console.log(`❌ Error: ${error.message}`);
		}

		// Rate limiting - wait between requests
		await new Promise(resolve => setTimeout(resolve, 200));
	}

	console.log("\n📋 WORKING ENDPOINTS SUMMARY:");
	console.log("=".repeat(50));

	workingEndpoints.forEach((ep, i) => {
		console.log(`${i + 1}. ${ep.endpoint}`);
		console.log(`   Records: ${ep.recordCount} (Total: ${ep.totalRecords})`);
		console.log(`   Fields: ${ep.sampleFields.join(", ")}`);
		console.log();
	});

	console.log(`\n✅ Found ${workingEndpoints.length} working endpoints`);

	// Generate updated service configuration
	console.log("\n📝 UPDATED SERVICE CONFIGURATION:");
	console.log("const ENDPOINTS = {");
	workingEndpoints.forEach(ep => {
		const name = ep.endpoint
			.split("/")
			.pop()
			.replace(/[_-]/g, "")
			.replace(/table\d+/g, "")
			.toLowerCase();
		console.log(`  ${name}: '${ep.endpoint}',`);
	});
	console.log("} as const");
}

discoverTreasuryEndpoints().catch(console.error);
