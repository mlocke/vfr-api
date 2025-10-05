"use client";

import { useState } from "react";
import AnalysisControls from "./AnalysisControls";
import AnalysisResults from "./AnalysisResults";

export interface AnalysisRequest {
	mode: "single" | "sector" | "multiple";
	symbols?: string[];
	sector?: string;
	limit?: number;
	include_ml?: boolean; // Enable ML predictions
	ml_horizon?: "1h" | "4h" | "1d" | "1w" | "1m";
}

export interface AnalysisResponse {
	success: boolean;
	data?: {
		stocks: any[];
		metadata: {
			mode: string;
			count: number;
			timestamp: number;
			sources: string[];
			technicalAnalysisEnabled?: boolean;
			fundamentalDataEnabled?: boolean;
			analystDataEnabled?: boolean;
			sentimentAnalysisEnabled?: boolean;
			macroeconomicAnalysisEnabled?: boolean;
			esgAnalysisEnabled?: boolean;
			shortInterestAnalysisEnabled?: boolean;
			extendedMarketDataEnabled?: boolean;
			analysisInputServices?: {
				[serviceName: string]: {
					enabled: boolean;
					status: "active" | "unavailable" | "disabled";
					description: string;
					components: {
						[componentName: string]: any;
					};
					utilizationInResults: string;
					weightInCompositeScore?: string;
					weightInTechnicalScore?: string;
				};
			};
		};
	};
	error?: string;
}

export default function AnalysisEngineTest() {
	const [isRunning, setIsRunning] = useState(false);
	const [results, setResults] = useState<AnalysisResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleRunAnalysis = async (request: AnalysisRequest) => {
		setIsRunning(true);
		setError(null);
		setResults(null);

		try {
			const response = await fetch("/api/stocks/analyze", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(request),
			});

			const data = await response.json();
			setResults(data);

			if (!data.success) {
				setError(data.error || "Analysis failed");
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Network error";
			setError(errorMessage);
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<div
			style={{
				background: "rgba(255, 255, 255, 0.08)",
				backdropFilter: "blur(10px)",
				border: "1px solid rgba(255, 255, 255, 0.15)",
				borderRadius: "20px",
				padding: "2rem",
				boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
				marginTop: "2rem",
			}}
		>
			<h2
				style={{
					fontSize: "1.8rem",
					fontWeight: "700",
					color: "white",
					marginBottom: "2rem",
					display: "flex",
					alignItems: "center",
					gap: "0.75rem",
				}}
			>
				🧪 Analysis Engine Test
			</h2>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "400px 1fr",
					gap: "2rem",
					minHeight: "500px",
				}}
			>
				<AnalysisControls onRunAnalysis={handleRunAnalysis} isRunning={isRunning} />

				<AnalysisResults results={results} error={error} isRunning={isRunning} />
			</div>
		</div>
	);
}
