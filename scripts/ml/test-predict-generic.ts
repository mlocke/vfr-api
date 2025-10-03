/**
 * Standalone test for predict-generic.py
 * Verifies real Python inference works without full integration
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

async function testPrediction() {
	console.log("🧪 Testing predict-generic.py standalone\n");

	// Check model exists
	const modelPath = path.join(process.cwd(), "models/early-signal/v1.0.0/model.txt");
	const normalizerPath = path.join(process.cwd(), "models/early-signal/v1.0.0/normalizer.json");

	if (!fs.existsSync(modelPath)) {
		console.error("❌ Model file not found:", modelPath);
		process.exit(1);
	}

	if (!fs.existsSync(normalizerPath)) {
		console.error("❌ Normalizer file not found:", normalizerPath);
		process.exit(1);
	}

	console.log("✅ Model files found");
	console.log("   Model:", modelPath);
	console.log("   Normalizer:", normalizerPath);

	// Start Python process
	console.log("\n📡 Starting Python subprocess...");
	const pythonProcess = spawn("python3", [
		path.join(process.cwd(), "scripts/ml/predict-generic.py"),
	]);

	let output = "";
	let ready = false;

	pythonProcess.stdout.on("data", data => {
		const text = data.toString();
		output += text;

		if (text.trim() && !text.includes("READY")) {
			console.log("📥 Response:", text.trim());
		}
	});

	pythonProcess.stderr.on("data", data => {
		const text = data.toString();
		if (text.includes("READY")) {
			ready = true;
			console.log("✅ Python process ready");
		} else if (text.includes("ERROR")) {
			console.error("❌ Python error:", text.trim());
		}
	});

	// Wait for READY signal
	await new Promise(resolve => {
		const checkReady = setInterval(() => {
			if (ready) {
				clearInterval(checkReady);
				resolve(null);
			}
		}, 100);

		setTimeout(() => {
			clearInterval(checkReady);
			if (!ready) {
				console.error("❌ Python process did not send READY signal");
				pythonProcess.kill();
				process.exit(1);
			}
		}, 10000);
	});

	// Test prediction with sample features
	console.log("\n📤 Sending test prediction request...");

	const testFeatures = {
		price_change_5d: 2.5,
		price_change_10d: 4.2,
		price_change_20d: -1.3,
		volume_ratio: 1.15,
		volume_trend: 0.8,
		sentiment_news_delta: 0.3,
		sentiment_reddit_accel: -0.1,
		sentiment_options_shift: 0.05,
		social_stocktwits_24h_change: 0.2,
		social_stocktwits_hourly_momentum: 0.15,
		social_stocktwits_7d_trend: 0.1,
		social_twitter_24h_change: -0.05,
		social_twitter_hourly_momentum: 0.08,
		social_twitter_7d_trend: 0.12,
		earnings_surprise: 5.2,
		revenue_growth_accel: 0.03,
		analyst_coverage_change: 2,
		rsi_momentum: 0.5,
		macd_histogram_trend: 0.02,
		fed_rate_change_30d: 0,
		unemployment_rate_change: -0.1,
		cpi_inflation_rate: 2.8,
		gdp_growth_rate: 2.1,
		treasury_yield_10y: 4.2,
		sec_insider_buying_ratio: 0.6,
		sec_institutional_ownership_change: 1.5,
		sec_8k_filing_count_30d: 3,
		analyst_price_target_change: 5.0,
		earnings_whisper_vs_estimate: 0.2,
		short_interest_change: -0.5,
		institutional_ownership_momentum: 1.2,
		options_put_call_ratio_change: -0.1,
		dividend_yield_change: 0.05,
		market_beta_30d: 1.1,
	};

	const request = {
		features: testFeatures,
		modelPath,
		normalizerPath,
	};

	pythonProcess.stdin.write(JSON.stringify(request) + "\n");

	// Wait for response with timeout
	const response = await new Promise((resolve, reject) => {
		let buffer = "";

		const onData = (data: Buffer) => {
			buffer += data.toString();

			try {
				const lines = buffer.split("\n");
				for (const line of lines) {
					if (line.trim() && !line.includes("READY")) {
						const result = JSON.parse(line);
						pythonProcess.stdout.off("data", onData);
						resolve(result);
						return;
					}
				}
			} catch (e) {
				// Continue waiting for complete JSON
			}
		};

		pythonProcess.stdout.on("data", onData);

		setTimeout(() => {
			pythonProcess.stdout.off("data", onData);
			reject(new Error("Prediction timed out after 5 seconds"));
		}, 5000);
	});

	pythonProcess.kill();

	console.log("\n✅ Prediction successful!");
	console.log("Response:", JSON.stringify(response, null, 2));

	return response;
}

testPrediction()
	.then(() => {
		console.log("\n✅ All tests passed!");
		process.exit(0);
	})
	.catch(error => {
		console.error("\n❌ Test failed:", error.message);
		process.exit(1);
	});
