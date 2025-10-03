#!/usr/bin/env npx tsx
/**
 * Test EODHD Options API endpoint
 */

import { EODHDAPI } from "../../app/services/financial-data/EODHDAPI";

async function testEODHDOptions() {
	console.log("🧪 Testing EODHD Options API");
	console.log("=".repeat(80));

	const eodhd = new EODHDAPI();
	const testSymbol = "AAPL";

	console.log(`\n1️⃣ Testing standard options endpoint for ${testSymbol}...`);
	try {
		const options = await eodhd.getOptionsChain(testSymbol);
		console.log("✅ Standard options endpoint SUCCESS");
		console.log(`   Calls returned: ${options?.calls?.length || 0}`);
		console.log(`   Puts returned: ${options?.puts?.length || 0}`);
		if (options?.calls?.[0]) {
			console.log(`   Sample call contract:`, {
				type: options.calls[0].type,
				strike: options.calls[0].strike,
				expiration: options.calls[0].expiration,
			});
		}
	} catch (error: any) {
		console.error("❌ Standard options endpoint FAILED");
		console.error(`   Error: ${error.message}`);
		console.error(`   Status: ${error.status || "N/A"}`);
	}

	console.log(`\n2️⃣ Testing put/call ratio for ${testSymbol}...`);
	try {
		const ratio = await eodhd.getPutCallRatio(testSymbol);
		console.log("✅ Put/Call ratio SUCCESS");
		console.log(`   Ratio: ${ratio}`);
	} catch (error: any) {
		console.error("❌ Put/Call ratio FAILED");
		console.error(`   Error: ${error.message}`);
	}

	console.log(`\n3️⃣ Testing UnicornBay options (known working)...`);
	try {
		const unicornRatio = await eodhd.getUnicornBayPutCallRatio(testSymbol);
		console.log("✅ UnicornBay options SUCCESS");
		console.log(`   Ratio: ${unicornRatio}`);
	} catch (error: any) {
		console.error("❌ UnicornBay options FAILED");
		console.error(`   Error: ${error.message}`);
	}

	console.log("\n" + "=".repeat(80));
	console.log("🏁 Test complete");
}

testEODHDOptions().catch(console.error);
