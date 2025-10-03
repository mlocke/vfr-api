const axios = require("axios");

const API_KEYS = {
	polygon: process.env.POLYGON_API_KEY,
	alphaVantage: process.env.AV_API_KEY,
	fmp: process.env.FMP_API_KEY,
	twelveData: process.env.TWELVEDATA_API_KEY,
};

const symbol = "GRE";

async function testGREData() {
	console.log("================================================================================");
	console.log(`COMPREHENSIVE DATA SOURCE ANALYSIS FOR ${symbol}`);
	console.log("================================================================================");

	const results = [];

	// 1. Test Polygon.io
	console.log("\n1. POLYGON.IO");
	console.log("----------------------------------------");
	try {
		const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${API_KEYS.polygon}`;
		const response = await axios.get(url, { timeout: 10000 });

		if (response.data.status === "OK" && response.data.results?.[0]) {
			const data = response.data.results[0];
			results.push({
				source: "Polygon.io",
				success: true,
				data: {
					symbol: symbol,
					close: data.c,
					volume: data.v,
					high: data.h,
					low: data.l,
					date: new Date(data.t).toISOString(),
					transactions: data.n,
				},
			});
			console.log(`✅ SUCCESS - Retrieved data`);
			console.log(`  Close: $${data.c}`);
			console.log(`  Volume: ${data.v?.toLocaleString()}`);
			console.log(`  High: $${data.h}`);
			console.log(`  Low: $${data.l}`);
			console.log(`  Transactions: ${data.n}`);
		} else {
			results.push({ source: "Polygon.io", success: false, error: "No data found" });
			console.log(`❌ NO DATA - Symbol might be delisted or invalid`);
		}
	} catch (error) {
		results.push({ source: "Polygon.io", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 2. Test Alpha Vantage
	console.log("\n2. ALPHA VANTAGE");
	console.log("----------------------------------------");
	try {
		const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEYS.alphaVantage}`;
		const response = await axios.get(url, { timeout: 10000 });

		if (
			response.data["Global Quote"] &&
			Object.keys(response.data["Global Quote"]).length > 0
		) {
			const data = response.data["Global Quote"];
			results.push({
				source: "Alpha Vantage",
				success: true,
				data: {
					symbol: data["01. symbol"],
					price: parseFloat(data["05. price"]),
					change: parseFloat(data["09. change"]),
					changePercent: data["10. change percent"],
					volume: parseInt(data["06. volume"]),
					previousClose: parseFloat(data["08. previous close"]),
				},
			});
			console.log(`✅ SUCCESS - Retrieved data`);
			console.log(`  Price: $${data["05. price"]}`);
			console.log(`  Change: ${data["09. change"]} (${data["10. change percent"]})`);
			console.log(`  Volume: ${parseInt(data["06. volume"]).toLocaleString()}`);
		} else if (response.data["Note"]) {
			results.push({ source: "Alpha Vantage", success: false, error: "Rate limit reached" });
			console.log(`⚠️ RATE LIMIT: ${response.data["Note"]}`);
		} else {
			results.push({ source: "Alpha Vantage", success: false, error: "No data found" });
			console.log(`❌ NO DATA - Symbol might be invalid or delisted`);
		}
	} catch (error) {
		results.push({ source: "Alpha Vantage", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 3. Test FMP
	console.log("\n3. FINANCIAL MODELING PREP (FMP)");
	console.log("----------------------------------------");
	try {
		const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${API_KEYS.fmp}`;
		const response = await axios.get(url, { timeout: 10000 });

		if (response.data && response.data.length > 0) {
			const data = response.data[0];
			results.push({
				source: "FMP",
				success: true,
				data: {
					symbol: data.symbol,
					name: data.name,
					price: data.price,
					change: data.change,
					changePercent: data.changesPercentage,
					volume: data.volume,
					marketCap: data.marketCap,
					pe: data.pe,
					eps: data.eps,
				},
			});
			console.log(`✅ SUCCESS - Retrieved data`);
			console.log(`  Name: ${data.name}`);
			console.log(`  Price: $${data.price}`);
			console.log(`  Volume: ${data.volume?.toLocaleString()}`);
			console.log(`  Market Cap: $${data.marketCap?.toLocaleString()}`);
			console.log(`  P/E: ${data.pe || "N/A"}`);
		} else {
			results.push({ source: "FMP", success: false, error: "No data found" });
			console.log(`❌ NO DATA - Symbol might be invalid`);
		}
	} catch (error) {
		results.push({ source: "FMP", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 4. Test Twelve Data
	console.log("\n4. TWELVE DATA");
	console.log("----------------------------------------");
	try {
		const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${API_KEYS.twelveData}`;
		const response = await axios.get(url, { timeout: 10000 });

		if (response.data && !response.data.code) {
			const data = response.data;
			results.push({
				source: "TwelveData",
				success: true,
				data: {
					symbol: data.symbol,
					name: data.name,
					exchange: data.exchange,
					currency: data.currency,
					close: parseFloat(data.close),
					change: parseFloat(data.change),
					changePercent: parseFloat(data.percent_change),
					volume: parseInt(data.volume),
					previousClose: parseFloat(data.previous_close),
				},
			});
			console.log(`✅ SUCCESS - Retrieved data`);
			console.log(`  Name: ${data.name}`);
			console.log(`  Exchange: ${data.exchange}`);
			console.log(`  Price: $${data.close}`);
			console.log(`  Volume: ${parseInt(data.volume || 0).toLocaleString()}`);
		} else {
			results.push({
				source: "TwelveData",
				success: false,
				error: data.message || "No data found",
			});
			console.log(`❌ ERROR: ${data.message || "Symbol not found"}`);
		}
	} catch (error) {
		results.push({ source: "TwelveData", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 5. Test Yahoo Finance (via API)
	console.log("\n5. YAHOO FINANCE (via yfapi.net)");
	console.log("----------------------------------------");
	try {
		const url = `https://yfapi.net/v6/finance/quote?region=US&lang=en&symbols=${symbol}`;
		const response = await axios.get(url, {
			headers: {
				"X-API-KEY": process.env.YAHOO_FINANCE_API_KEY || "demo",
				Accept: "application/json",
			},
			timeout: 10000,
		});

		if (response.data.quoteResponse?.result?.length > 0) {
			const data = response.data.quoteResponse.result[0];
			results.push({
				source: "Yahoo Finance",
				success: true,
				data: {
					symbol: data.symbol,
					name: data.longName || data.shortName,
					price: data.regularMarketPrice,
					change: data.regularMarketChange,
					changePercent: data.regularMarketChangePercent,
					volume: data.regularMarketVolume,
					marketCap: data.marketCap,
				},
			});
			console.log(`✅ SUCCESS - Retrieved data`);
			console.log(`  Name: ${data.longName || data.shortName}`);
			console.log(`  Price: $${data.regularMarketPrice}`);
			console.log(`  Volume: ${data.regularMarketVolume?.toLocaleString()}`);
		} else {
			results.push({ source: "Yahoo Finance", success: false, error: "No data found" });
			console.log(`❌ NO DATA - Symbol not found`);
		}
	} catch (error) {
		results.push({ source: "Yahoo Finance", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 6. Test SEC EDGAR
	console.log("\n6. SEC EDGAR");
	console.log("----------------------------------------");
	try {
		const url = `https://data.sec.gov/submissions/CIK${symbol.padStart(10, "0")}.json`;
		const response = await axios.get(url, {
			headers: {
				"User-Agent": "Veritak Financial Research (admin@veritak.com)",
			},
			timeout: 10000,
		});

		if (response.data.filings?.recent) {
			const recent = response.data.filings.recent;
			const totalFilings = recent.form.length;
			results.push({
				source: "SEC EDGAR",
				success: true,
				data: {
					cik: response.data.cik,
					entityName: response.data.entityName,
					totalFilings: totalFilings,
					latestForm: recent.form[0],
					latestDate: recent.filingDate[0],
				},
			});
			console.log(`✅ SUCCESS - Found entity`);
			console.log(`  Entity: ${response.data.entityName}`);
			console.log(`  CIK: ${response.data.cik}`);
			console.log(`  Total Filings: ${totalFilings}`);
			console.log(`  Latest: ${recent.form[0]} on ${recent.filingDate[0]}`);
		} else {
			results.push({ source: "SEC EDGAR", success: false, error: "No filings found" });
			console.log(`❌ NO DATA - No SEC filings found`);
		}
	} catch (error) {
		if (error.response?.status === 404) {
			// Try searching by ticker
			console.log(`  Attempting ticker search...`);
			try {
				const searchUrl = `https://www.sec.gov/cgi-bin/browse-edgar?CIK=${symbol}&action=getcompany&output=json`;
				const searchResponse = await axios.get(searchUrl, {
					headers: {
						"User-Agent": "Veritak Financial Research (admin@veritak.com)",
					},
					timeout: 10000,
				});
				console.log(
					`  Search response: ${JSON.stringify(searchResponse.data).substring(0, 200)}`
				);
			} catch (searchError) {
				console.log(`  Search also failed: ${searchError.message}`);
			}
		}
		results.push({ source: "SEC EDGAR", success: false, error: "Not found or invalid ticker" });
		console.log(
			`❌ ERROR: ${error.response?.status === 404 ? "Company not found in SEC database" : error.message}`
		);
	}

	// SUMMARY
	console.log(
		"\n================================================================================"
	);
	console.log("ANALYSIS SUMMARY");
	console.log("================================================================================");

	const successful = results.filter(r => r.success);
	const failed = results.filter(r => !r.success);

	console.log(`\n📊 Results Overview:`);
	console.log(`  Total Sources: ${results.length}`);
	console.log(`  Successful: ${successful.length}`);
	console.log(`  Failed: ${failed.length}`);

	if (successful.length > 0) {
		console.log("\n✅ Successful Data Sources:");
		successful.forEach(r => {
			console.log(`  • ${r.source}`);
			if (r.data.price) console.log(`    Price: $${r.data.price}`);
			if (r.data.volume) console.log(`    Volume: ${r.data.volume.toLocaleString()}`);
		});
	}

	if (failed.length > 0) {
		console.log("\n❌ Failed Data Sources:");
		failed.forEach(r => {
			console.log(`  • ${r.source}: ${r.error}`);
		});
	}

	// DATA DISCREPANCY ANALYSIS
	if (successful.length > 1) {
		console.log(
			"\n================================================================================"
		);
		console.log("DATA DISCREPANCY ANALYSIS");
		console.log(
			"================================================================================"
		);

		const priceData = successful
			.filter(r => r.data.price || r.data.close)
			.map(r => ({
				source: r.source,
				price: r.data.price || r.data.close,
			}));

		if (priceData.length > 1) {
			const prices = priceData.map(p => p.price);
			const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
			const minPrice = Math.min(...prices);
			const maxPrice = Math.max(...prices);
			const variance = (((maxPrice - minPrice) / avgPrice) * 100).toFixed(2);

			console.log("\n📈 Price Comparison:");
			priceData.forEach(p => {
				const deviation = (((p.price - avgPrice) / avgPrice) * 100).toFixed(2);
				const flag = Math.abs(deviation) > 5 ? "⚠️ " : "  ";
				console.log(`${flag}${p.source}: $${p.price.toFixed(2)} (${deviation}% from avg)`);
			});

			console.log(`\n  Average Price: $${avgPrice.toFixed(2)}`);
			console.log(`  Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
			console.log(`  Variance: ${variance}%`);

			if (parseFloat(variance) > 5) {
				console.log(`\n⚠️  WARNING: High price variance detected (${variance}%)`);
				console.log("  This may indicate:");
				console.log("  • Stale data from some sources");
				console.log("  • Different quote times (real-time vs delayed)");
				console.log("  • Data quality issues");
				console.log("  • Symbol might be delisted on some exchanges");
			}
		}
	}

	// ANOMALY DETECTION
	console.log(
		"\n================================================================================"
	);
	console.log("ANOMALY DETECTION");
	console.log("================================================================================");

	const anomalies = [];

	// Check if majority of sources failed
	if (failed.length > successful.length) {
		anomalies.push("🚨 Majority of data sources failed - symbol may be delisted or invalid");
	}

	// Check for zero or very low volume
	const volumes = successful.filter(r => r.data.volume !== undefined).map(r => r.data.volume);

	if (volumes.length > 0) {
		const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
		if (avgVolume < 1000) {
			anomalies.push("⚠️  Very low trading volume detected - liquidity concerns");
		}
	}

	// Check for missing fundamental data
	const fundamentalData = successful.filter(r => r.data.pe || r.data.marketCap);
	if (successful.length > 0 && fundamentalData.length === 0) {
		anomalies.push("📊 No fundamental data (P/E, Market Cap) available");
	}

	if (anomalies.length > 0) {
		console.log("\nDetected Anomalies:");
		anomalies.forEach(a => console.log(`  ${a}`));
	} else {
		console.log("\n✅ No significant anomalies detected");
	}

	console.log(
		"\n================================================================================"
	);
	console.log("ANALYSIS COMPLETE");
	console.log("================================================================================");
}

// Load environment variables
require("dotenv").config();

// Run the test
testGREData().catch(console.error);
