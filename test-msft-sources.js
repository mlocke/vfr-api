const axios = require("axios");

const API_KEYS = {
	polygon: process.env.POLYGON_API_KEY,
	alphaVantage: process.env.AV_API_KEY,
	fmp: process.env.FMP_API_KEY,
	twelveData: process.env.TWELVEDATA_API_KEY,
};

const symbol = "MSFT";

async function testMSFTData() {
	console.log("================================================================================");
	console.log(`COMPREHENSIVE DATA SOURCE ANALYSIS FOR ${symbol}`);
	console.log("================================================================================");

	const results = [];

	// 1. Test Polygon.io
	console.log("\n1. POLYGON.IO");
	console.log("----------------------------------------");
	try {
		const urls = [
			`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${API_KEYS.polygon}`,
			`https://api.polygon.io/v2/reference/tickers/${symbol}?apiKey=${API_KEYS.polygon}`,
			`https://api.polygon.io/v3/snapshot/options/${symbol}?apiKey=${API_KEYS.polygon}`,
		];

		const [prevData, tickerInfo, optionsSnapshot] = await Promise.all(
			urls.map(url => axios.get(url, { timeout: 10000 }).catch(e => ({ error: e.message })))
		);

		if (prevData.data?.status === "OK" && prevData.data.results?.[0]) {
			const data = prevData.data.results[0];
			const info = tickerInfo.data?.results || {};
			results.push({
				source: "Polygon.io",
				success: true,
				data: {
					symbol: symbol,
					close: data.c,
					volume: data.v,
					high: data.h,
					low: data.l,
					vwap: data.vw,
					date: new Date(data.t).toISOString(),
					transactions: data.n,
					marketCap: info.market_cap,
					sic: info.sic_description,
				},
			});
			console.log(`✅ SUCCESS - Retrieved comprehensive data`);
			console.log(`  Close: $${data.c}`);
			console.log(`  Volume: ${data.v?.toLocaleString()}`);
			console.log(`  VWAP: $${data.vw?.toFixed(2)}`);
			console.log(`  Transactions: ${data.n?.toLocaleString()}`);
			if (info.market_cap)
				console.log(`  Market Cap: $${(info.market_cap / 1000000000).toFixed(2)}B`);
		}
	} catch (error) {
		results.push({ source: "Polygon.io", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 2. Test Alpha Vantage
	console.log("\n2. ALPHA VANTAGE");
	console.log("----------------------------------------");
	try {
		const urls = [
			`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEYS.alphaVantage}`,
			`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEYS.alphaVantage}`,
		];

		const [quoteResp, overviewResp] = await Promise.all(
			urls.map(url => axios.get(url, { timeout: 10000 }))
		);

		if (
			quoteResp.data["Global Quote"] &&
			Object.keys(quoteResp.data["Global Quote"]).length > 0
		) {
			const quote = quoteResp.data["Global Quote"];
			const overview = overviewResp.data || {};
			results.push({
				source: "Alpha Vantage",
				success: true,
				data: {
					symbol: quote["01. symbol"],
					price: parseFloat(quote["05. price"]),
					change: parseFloat(quote["09. change"]),
					changePercent: quote["10. change percent"],
					volume: parseInt(quote["06. volume"]),
					previousClose: parseFloat(quote["08. previous close"]),
					pe: parseFloat(overview.PERatio),
					eps: parseFloat(overview.EPS),
					dividend: parseFloat(overview.DividendYield),
					beta: parseFloat(overview.Beta),
					marketCap: parseInt(overview.MarketCapitalization),
				},
			});
			console.log(`✅ SUCCESS - Retrieved data with fundamentals`);
			console.log(`  Price: $${quote["05. price"]}`);
			console.log(`  P/E: ${overview.PERatio || "N/A"}`);
			console.log(`  EPS: ${overview.EPS || "N/A"}`);
			console.log(`  Beta: ${overview.Beta || "N/A"}`);
			console.log(
				`  Market Cap: $${(parseInt(overview.MarketCapitalization) / 1000000000).toFixed(2)}B`
			);
		} else if (quoteResp.data["Note"]) {
			console.log(`⚠️ RATE LIMIT: API call frequency exceeded`);
		}
	} catch (error) {
		results.push({ source: "Alpha Vantage", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 3. Test FMP
	console.log("\n3. FINANCIAL MODELING PREP (FMP)");
	console.log("----------------------------------------");
	try {
		const urls = [
			`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${API_KEYS.fmp}`,
			`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${API_KEYS.fmp}`,
			`https://financialmodelingprep.com/api/v3/ratios/${symbol}?limit=1&apikey=${API_KEYS.fmp}`,
		];

		const [quoteResp, profileResp, ratiosResp] = await Promise.all(
			urls.map(url => axios.get(url, { timeout: 10000 }).catch(e => ({ error: e.message })))
		);

		if (quoteResp.data && quoteResp.data.length > 0) {
			const quote = quoteResp.data[0];
			const profile = profileResp.data?.[0] || {};
			const ratios = ratiosResp.data?.[0] || {};
			results.push({
				source: "FMP",
				success: true,
				data: {
					symbol: quote.symbol,
					name: quote.name,
					price: quote.price,
					change: quote.change,
					changePercent: quote.changesPercentage,
					volume: quote.volume,
					avgVolume: quote.avgVolume,
					marketCap: quote.marketCap,
					pe: quote.pe,
					eps: quote.eps,
					priceToBook: ratios.priceToBookRatio,
					roe: ratios.returnOnEquityTTM,
					currentRatio: ratios.currentRatioTTM,
				},
			});
			console.log(`✅ SUCCESS - Retrieved comprehensive data`);
			console.log(`  Price: $${quote.price}`);
			console.log(`  P/E: ${quote.pe}`);
			console.log(`  Market Cap: $${(quote.marketCap / 1000000000).toFixed(2)}B`);
			console.log(`  Avg Volume: ${quote.avgVolume?.toLocaleString()}`);
			if (ratios.returnOnEquityTTM)
				console.log(`  ROE: ${(ratios.returnOnEquityTTM * 100).toFixed(2)}%`);
		}
	} catch (error) {
		results.push({ source: "FMP", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 4. Test Twelve Data
	console.log("\n4. TWELVE DATA");
	console.log("----------------------------------------");
	try {
		const urls = [
			`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${API_KEYS.twelveData}`,
			`https://api.twelvedata.com/statistics?symbol=${symbol}&apikey=${API_KEYS.twelveData}`,
		];

		const [quoteResp, statsResp] = await Promise.all(
			urls.map(url =>
				axios.get(url, { timeout: 10000 }).catch(e => ({ data: { error: e.message } }))
			)
		);

		if (quoteResp.data && !quoteResp.data.code) {
			const quote = quoteResp.data;
			const stats = statsResp.data || {};
			results.push({
				source: "TwelveData",
				success: true,
				data: {
					symbol: quote.symbol,
					name: quote.name,
					exchange: quote.exchange,
					currency: quote.currency,
					close: parseFloat(quote.close),
					change: parseFloat(quote.change),
					changePercent: parseFloat(quote.percent_change),
					volume: parseInt(quote.volume),
					high: parseFloat(quote.high),
					low: parseFloat(quote.low),
					fiftyTwoWeekHigh: parseFloat(quote.fifty_two_week?.high),
					fiftyTwoWeekLow: parseFloat(quote.fifty_two_week?.low),
				},
			});
			console.log(`✅ SUCCESS - Retrieved market data`);
			console.log(`  Exchange: ${quote.exchange}`);
			console.log(`  Price: $${quote.close}`);
			console.log(`  Day Range: $${quote.low} - $${quote.high}`);
			console.log(
				`  52W Range: $${quote.fifty_two_week?.low} - $${quote.fifty_two_week?.high}`
			);
		}
	} catch (error) {
		results.push({ source: "TwelveData", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// 5. Test SEC EDGAR
	console.log("\n5. SEC EDGAR");
	console.log("----------------------------------------");
	try {
		// Microsoft's CIK
		const cik = "0000789019";
		const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
		const response = await axios.get(url, {
			headers: {
				"User-Agent": "Veritak Financial Research (admin@veritak.com)",
			},
			timeout: 10000,
		});

		if (response.data.filings?.recent) {
			const recent = response.data.filings.recent;
			const totalFilings = recent.form.length;
			const latest10K = recent.form.findIndex(f => f === "10-K");
			const latest10Q = recent.form.findIndex(f => f === "10-Q");

			results.push({
				source: "SEC EDGAR",
				success: true,
				data: {
					cik: response.data.cik,
					entityName: response.data.entityName,
					totalFilings: totalFilings,
					latestForm: recent.form[0],
					latestDate: recent.filingDate[0],
					latest10K: latest10K >= 0 ? recent.filingDate[latest10K] : null,
					latest10Q: latest10Q >= 0 ? recent.filingDate[latest10Q] : null,
					fiscalYearEnd: response.data.fiscalYearEnd,
				},
			});
			console.log(`✅ SUCCESS - Found SEC filings`);
			console.log(`  Entity: ${response.data.entityName}`);
			console.log(`  Total Filings: ${totalFilings}`);
			console.log(`  Latest: ${recent.form[0]} on ${recent.filingDate[0]}`);
			if (latest10K >= 0) console.log(`  Latest 10-K: ${recent.filingDate[latest10K]}`);
			if (latest10Q >= 0) console.log(`  Latest 10-Q: ${recent.filingDate[latest10Q]}`);
		}
	} catch (error) {
		results.push({ source: "SEC EDGAR", success: false, error: error.message });
		console.log(`❌ ERROR: ${error.message}`);
	}

	// SUMMARY AND DISCREPANCY ANALYSIS
	console.log(
		"\n================================================================================"
	);
	console.log("DATA COLLECTION SUMMARY");
	console.log("================================================================================");

	const successful = results.filter(r => r.success);
	const failed = results.filter(r => !r.success);

	console.log(`\n📊 Results Overview:`);
	console.log(`  Total Sources: ${results.length}`);
	console.log(`  Successful: ${successful.length}`);
	console.log(`  Failed: ${failed.length}`);

	// DISCREPANCY ANALYSIS
	if (successful.length > 1) {
		console.log(
			"\n================================================================================"
		);
		console.log("DATA DISCREPANCY ANALYSIS");
		console.log(
			"================================================================================"
		);

		// Price Discrepancy
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
			const variance = (((maxPrice - minPrice) / avgPrice) * 100).toFixed(3);

			console.log("\n📈 PRICE COMPARISON:");
			console.log("  Source".padEnd(20) + "Price".padEnd(12) + "Deviation");
			console.log("  " + "-".repeat(45));
			priceData.forEach(p => {
				const deviation = (((p.price - avgPrice) / avgPrice) * 100).toFixed(3);
				const flag = Math.abs(parseFloat(deviation)) > 0.5 ? "⚠️" : "✓";
				console.log(
					`  ${p.source.padEnd(18)} $${p.price.toFixed(2).padEnd(10)} ${deviation}% ${flag}`
				);
			});
			console.log("  " + "-".repeat(45));
			console.log(`  Average: $${avgPrice.toFixed(2)}`);
			console.log(`  Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
			console.log(`  Variance: ${variance}%`);

			if (parseFloat(variance) > 1) {
				console.log(`\n  ⚠️ Price variance of ${variance}% detected`);
			}
		}

		// Volume Discrepancy
		const volumeData = successful
			.filter(r => r.data.volume)
			.map(r => ({
				source: r.source,
				volume: r.data.volume,
			}));

		if (volumeData.length > 1) {
			console.log("\n📊 VOLUME COMPARISON:");
			console.log("  Source".padEnd(20) + "Volume");
			console.log("  " + "-".repeat(45));
			volumeData.forEach(v => {
				console.log(`  ${v.source.padEnd(18)} ${v.volume.toLocaleString()}`);
			});

			const volumes = volumeData.map(v => v.volume);
			const maxVol = Math.max(...volumes);
			const minVol = Math.min(...volumes);
			const volVariance = (((maxVol - minVol) / minVol) * 100).toFixed(1);

			if (parseFloat(volVariance) > 20) {
				console.log(
					`\n  ⚠️ Volume variance of ${volVariance}% - likely different reporting periods`
				);
			}
		}

		// Market Cap Discrepancy
		const marketCapData = successful
			.filter(r => r.data.marketCap)
			.map(r => ({
				source: r.source,
				marketCap: r.data.marketCap,
			}));

		if (marketCapData.length > 1) {
			console.log("\n💰 MARKET CAP COMPARISON:");
			console.log("  Source".padEnd(20) + "Market Cap");
			console.log("  " + "-".repeat(45));
			marketCapData.forEach(m => {
				const billions = (m.marketCap / 1000000000).toFixed(2);
				console.log(`  ${m.source.padEnd(18)} $${billions}B`);
			});
		}

		// P/E Ratio Discrepancy
		const peData = successful
			.filter(r => r.data.pe)
			.map(r => ({
				source: r.source,
				pe: r.data.pe,
			}));

		if (peData.length > 1) {
			console.log("\n📊 P/E RATIO COMPARISON:");
			console.log("  Source".padEnd(20) + "P/E Ratio");
			console.log("  " + "-".repeat(45));
			peData.forEach(p => {
				console.log(`  ${p.source.padEnd(18)} ${p.pe.toFixed(2)}`);
			});
		}
	}

	// ANOMALY DETECTION
	console.log(
		"\n================================================================================"
	);
	console.log("ANOMALY DETECTION");
	console.log("================================================================================");

	const anomalies = [];

	// Check price consistency
	const pricesForCheck = successful
		.filter(r => r.data.price || r.data.close)
		.map(r => r.data.price || r.data.close);

	if (pricesForCheck.length > 0) {
		const avgPrice = pricesForCheck.reduce((sum, p) => sum + p, 0) / pricesForCheck.length;
		const priceStdDev = Math.sqrt(
			pricesForCheck.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) /
				pricesForCheck.length
		);

		if (priceStdDev / avgPrice > 0.01) {
			anomalies.push(`⚠️ Price standard deviation exceeds 1% of average price`);
		}
	}

	// Check for missing critical data
	const criticalDataMissing = [];
	if (successful.filter(r => r.data.pe).length === 0) {
		criticalDataMissing.push("P/E Ratio");
	}
	if (successful.filter(r => r.data.marketCap).length === 0) {
		criticalDataMissing.push("Market Cap");
	}

	if (criticalDataMissing.length > 0) {
		anomalies.push(`📊 Missing critical data: ${criticalDataMissing.join(", ")}`);
	}

	if (anomalies.length > 0) {
		console.log("\nDetected Anomalies:");
		anomalies.forEach(a => console.log(`  ${a}`));
	} else {
		console.log("\n✅ No significant anomalies detected");
		console.log("  Data consistency is within acceptable ranges");
	}

	console.log(
		"\n================================================================================"
	);
	console.log("ANALYSIS COMPLETE");
	console.log("================================================================================");

	return results;
}

// Load environment variables
require("dotenv").config();

// Run the test
testMSFTData().catch(console.error);
